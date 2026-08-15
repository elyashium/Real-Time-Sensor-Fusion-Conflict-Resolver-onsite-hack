/**
 * Conflict resolution rule interpreter.
 * See implementation.md §7 (Conflict detection & resolution rules).
 *
 * This is a pure, framework-free function: data in, decision out.
 * It does NOT touch the database or HTTP. The reducer calls this
 * for each timestamp bucket where multiple sources disagree.
 */
import type { TelemetrySource } from "@/lib/validation/telemetry-event";
import {
  positionsConflict,
  DEFAULT_HORIZONTAL_CONFLICT_THRESHOLD_METERS,
  DEFAULT_ALTITUDE_CONFLICT_THRESHOLD_METERS,
  DEFAULT_TIME_TOLERANCE_MS,
} from "@/lib/fusion/geo";

export type DecisionStatus = "resolved" | "unresolved";

export interface FusionEvent {
  id: string;
  drone_id: string;
  source: TelemetrySource;
  event_timestamp: string;
  lat: number;
  lon: number;
  alt: number;
  confidence: number;
}

export interface ConflictDecision {
  id: string;
  drone_id: string;
  decision_timestamp: string;
  input_event_ids: string[];
  rule_applied: string;
  rule_id: string | null;
  output_lat: number | null;
  output_lon: number | null;
  output_alt: number | null;
  output_status: DecisionStatus;
  source_of_truth: TelemetrySource | null;
}

export interface RuleConfig {
  id: string;
  when: {
    sources?: string[];
    allConfidenceBelow?: number;
  };
  then: {
    preferSource?: string;
    if?: string;
    elsePreferSource?: string;
    status?: "unresolved";
  };
}

export interface ThresholdConfig {
  horizontalThresholdMeters: number;
  altitudeThresholdMeters: number;
  timeToleranceMs: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  horizontalThresholdMeters: DEFAULT_HORIZONTAL_CONFLICT_THRESHOLD_METERS,
  altitudeThresholdMeters: DEFAULT_ALTITUDE_CONFLICT_THRESHOLD_METERS,
  timeToleranceMs: DEFAULT_TIME_TOLERANCE_MS,
};

/**
 * Groups events into timestamp buckets — events whose timestamps are
 * within timeToleranceMs of each other belong to the same bucket.
 * Events are pre-sorted by canonical order before bucketing.
 */
export function bucketEventsByTime(
  events: FusionEvent[],
  timeToleranceMs: number = DEFAULT_TIME_TOLERANCE_MS
): FusionEvent[][] {
  if (events.length === 0) return [];
  const buckets: FusionEvent[][] = [];
  let currentBucket: FusionEvent[] = [events[0]];
  let bucketStart = new Date(events[0].event_timestamp).getTime();

  for (let i = 1; i < events.length; i++) {
    const eventTime = new Date(events[i].event_timestamp).getTime();
    if (eventTime - bucketStart <= timeToleranceMs) {
      currentBucket.push(events[i]);
    } else {
      buckets.push(currentBucket);
      currentBucket = [events[i]];
      bucketStart = eventTime;
    }
  }
  buckets.push(currentBucket);
  return buckets;
}

/**
 * Checks whether a bucket of events contains a conflict:
 * multiple distinct sources whose positions differ beyond thresholds.
 */
export function bucketHasConflict(
  events: FusionEvent[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): boolean {
  const sources = new Set(events.map((e) => e.source));
  if (sources.size < 2) return false;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[i].source === events[j].source) continue;
      if (
        positionsConflict(
          { lat: events[i].lat, lon: events[i].lon, alt: events[i].alt },
          { lat: events[j].lat, lon: events[j].lon, alt: events[j].alt },
          {
            horizontalThresholdMeters: thresholds.horizontalThresholdMeters,
            altitudeThresholdMeters: thresholds.altitudeThresholdMeters,
          }
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function formatConfidence(value: number): string {
  return value.toFixed(2);
}

/**
 * Resolves a single timestamp bucket using the ordered rule list.
 * Returns a ConflictDecision with a human-readable rule_applied string.
 */
export function resolveBucket(
  bucket: FusionEvent[],
  rules: RuleConfig[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
  decisionId: string
): ConflictDecision {
  const droneId = bucket[0].drone_id;
  const decisionTimestamp = bucket[0].event_timestamp;
  const inputEventIds = bucket.map((e) => e.id);

  const sources = new Set(bucket.map((e) => e.source));

  // Single source: no conflict, use it directly
  if (sources.size === 1) {
    const winner = bucket[0];
    return {
      id: decisionId,
      drone_id: droneId,
      decision_timestamp: decisionTimestamp,
      input_event_ids: inputEventIds,
      rule_applied: "single source, no conflict",
      rule_id: null,
      output_lat: winner.lat,
      output_lon: winner.lon,
      output_alt: winner.alt,
      output_status: "resolved",
      source_of_truth: winner.source,
    };
  }

  // We have a real conflict — walk the ordered rule list
  const sourceMap = new Map<string, FusionEvent>();
  for (const evt of bucket) {
    if (!sourceMap.has(evt.source)) {
      sourceMap.set(evt.source, evt);
    }
  }

  for (const rule of rules) {
    // Rule: low-confidence-unresolved (allConfidenceBelow)
    if (rule.when.allConfidenceBelow !== undefined) {
      const threshold = rule.when.allConfidenceBelow;
      const allBelow = bucket.every((e) => e.confidence < threshold);
      if (allBelow) {
        const confList = bucket
          .map((e) => `${e.source} ${formatConfidence(e.confidence)}`)
          .join(", ");
        return {
          id: decisionId,
          drone_id: droneId,
          decision_timestamp: decisionTimestamp,
          input_event_ids: inputEventIds,
          rule_applied: `unresolved: all sources below ${threshold} confidence (${confList})`,
          rule_id: rule.id,
          output_lat: null,
          output_lon: null,
          output_alt: null,
          output_status: "unresolved",
          source_of_truth: null,
        };
      }
    }

    // Rule: gps-lidar-confidence (source-pair preference)
    if (rule.when.sources && rule.then.preferSource) {
      const requiredSources = rule.when.sources;
      const hasAllSources = requiredSources.every((s) => sourceMap.has(s));
      if (!hasAllSources) continue;

      const preferSource = rule.then.preferSource;
      const preferEvent = sourceMap.get(preferSource)!;
      const condition = rule.then.if;

      // Parse condition like "GPS.confidence > 0.8"
      if (condition) {
        const match = condition.match(/^(\w+)\.confidence\s*>\s*([\d.]+)$/);
        if (match) {
          const condSource = match[1];
          const thresholdVal = parseFloat(match[2]);
          const condEvent = sourceMap.get(condSource);
          if (condEvent && condEvent.confidence > thresholdVal) {
            return {
              id: decisionId,
              drone_id: droneId,
              decision_timestamp: decisionTimestamp,
              input_event_ids: inputEventIds,
              rule_applied: `${preferSource} preferred: confidence ${formatConfidence(condEvent.confidence)} > ${thresholdVal}`,
              rule_id: rule.id,
              output_lat: preferEvent.lat,
              output_lon: preferEvent.lon,
              output_alt: preferEvent.alt,
              output_status: "resolved",
              source_of_truth: preferSource as TelemetrySource,
            };
          } else if (rule.then.elsePreferSource) {
            const elseEvent = sourceMap.get(rule.then.elsePreferSource);
            if (elseEvent) {
              const confVal = condEvent
                ? formatConfidence(condEvent.confidence)
                : "N/A";
              return {
                id: decisionId,
                drone_id: droneId,
                decision_timestamp: decisionTimestamp,
                input_event_ids: inputEventIds,
                rule_applied: `${rule.then.elsePreferSource} preferred: ${condSource} confidence ${confVal} <= ${thresholdVal}`,
                rule_id: rule.id,
                output_lat: elseEvent.lat,
                output_lon: elseEvent.lon,
                output_alt: elseEvent.alt,
                output_status: "resolved",
                source_of_truth: rule.then.elsePreferSource as TelemetrySource,
              };
            }
          }
        }
      }
    }
  }

  // No rule matched — default to unresolved for safety
  return {
    id: decisionId,
    drone_id: droneId,
    decision_timestamp: decisionTimestamp,
    input_event_ids: inputEventIds,
    rule_applied: "unresolved: no matching rule",
    rule_id: null,
    output_lat: null,
    output_lon: null,
    output_alt: null,
    output_status: "unresolved",
    source_of_truth: null,
  };
}

export const DEFAULT_RULES: RuleConfig[] = [
  {
    id: "low-confidence-unresolved",
    when: { allConfidenceBelow: 0.6 },
    then: { status: "unresolved" },
  },
  {
    id: "gps-lidar-confidence",
    when: { sources: ["GPS", "LiDAR"] },
    then: {
      preferSource: "GPS",
      if: "GPS.confidence > 0.8",
      elsePreferSource: "LiDAR",
    },
  },
];
