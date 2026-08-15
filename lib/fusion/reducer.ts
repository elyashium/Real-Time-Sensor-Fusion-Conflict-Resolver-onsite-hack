/**
 * The reducer — a pure fold over canonically-ordered events.
 * See implementation.md §3 (architecture) and §6 (canonical ordering).
 *
 * This is THE core of the system: data in (sorted events + rule config),
 * data out (state versions + conflict decisions). No database, no HTTP.
 * Deterministic by construction — same inputs always produce same outputs.
 */
import { createHash } from "node:crypto";
import { compareEventsForFold } from "@/lib/fusion/dedupe";
import type { TelemetrySource } from "@/lib/validation/telemetry-event";
import {
  type FusionEvent,
  type ConflictDecision,
  type RuleConfig,
  type ThresholdConfig,
  resolveBucket,
  bucketEventsByTime,
  DEFAULT_THRESHOLDS,
} from "@/lib/fusion/conflict";

export interface StateVersion {
  drone_id: string;
  version: number;
  effective_timestamp: string;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  confidence: number | null;
  source_of_truth: TelemetrySource | null;
  status: "resolved" | "unresolved" | "stale";
  caused_by_event_id: string;
  decision_id: string | null;
}

export interface ReducerOutput {
  state_versions: StateVersion[];
  decisions: ConflictDecision[];
}

export interface ReducerInput {
  events: FusionEvent[];
  rules: RuleConfig[];
  thresholds?: ThresholdConfig;
  overrides?: Record<string, string>; // Record<decision_timestamp, selected_source>
}

/**
 * Folds a set of events for one drone into a sequence of state versions
 * and conflict decisions. Events are sorted into canonical order first
 * (§6), then grouped into timestamp buckets, then each bucket is resolved.
 *
 * The output is fully determined by the input events + rules — it does
 * not depend on submission order, wall-clock time, or any external state.
 */
export function foldEvents(input: ReducerInput): ReducerOutput {
  const { events, rules, thresholds = DEFAULT_THRESHOLDS } = input;

  if (events.length === 0) {
    return { state_versions: [], decisions: [] };
  }

  // Step 1: Sort into canonical order (§6)
  const sorted = [...events].sort(compareEventsForFold);

  // Step 2: Group into timestamp buckets (events within timeToleranceMs)
  const buckets = bucketEventsByTime(sorted, thresholds.timeToleranceMs);

  // Step 3: Resolve each bucket, building state versions + decisions
  const state_versions: StateVersion[] = [];
  const decisions: ConflictDecision[] = [];

  buckets.forEach((bucket, index) => {
    const sources = new Set(bucket.map((e) => e.source));
    const isConflict = sources.size > 1;

    let decisionId: string | null = null;
    let decision: ConflictDecision;

    const bucketTimestamp = bucket[0].event_timestamp;
    const manualOverrideSource = input.overrides?.[bucketTimestamp];

    if (manualOverrideSource) {
      decisionId = generateDecisionId(bucket);
      const chosenEvent = bucket.find((e) => e.source === manualOverrideSource) || bucket[0];
      decision = {
        id: decisionId,
        drone_id: bucket[0].drone_id,
        decision_timestamp: bucketTimestamp,
        input_event_ids: bucket.map((e) => e.id),
        rule_applied: `Human Manual Override: forced trust in ${manualOverrideSource}`,
        rule_id: "override",
        output_lat: chosenEvent.lat,
        output_lon: chosenEvent.lon,
        output_alt: chosenEvent.alt,
        output_status: "resolved",
        source_of_truth: manualOverrideSource as TelemetrySource,
      };
      decisions.push(decision);
    } else if (isConflict) {
      decisionId = generateDecisionId(bucket);
      decision = resolveBucket(bucket, rules, thresholds, decisionId);
      decisions.push(decision);
    } else {
      // Single source — still need a decision object to extract fields,
      // but it won't be persisted as a conflict_decisions row.
      decision = resolveBucket(bucket, rules, thresholds, "00000000-0000-4000-8000-000000000000");
    }

    // The last event in canonical order within this bucket is the
    // "caused_by" event — it's the one that triggered this state version.
    const causedByEvent = bucket[bucket.length - 1];

    state_versions.push({
      drone_id: decision.drone_id,
      version: index,
      effective_timestamp: decision.decision_timestamp,
      lat: decision.output_lat,
      lon: decision.output_lon,
      alt: decision.output_alt,
      confidence: bucket.find((e) => e.source === decision.source_of_truth)?.confidence ?? null,
      source_of_truth: decision.source_of_truth,
      status: decision.output_status,
      caused_by_event_id: causedByEvent.id,
      decision_id: decisionId,
    });
  });

  return { state_versions, decisions };
}

/**
 * Generates a deterministic decision ID from the bucket's event IDs.
 * Uses sha256 for stability and uniqueness — replaying the same events
 * always produces the same decision ID (§2 determinism).
 */
function generateDecisionId(bucket: FusionEvent[]): string {
  const ids = bucket.map((e) => e.id).sort();
  const hash = createHash("sha256").update(ids.join("|")).digest("hex");
  // Format as UUID v4-like string from the hash
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Returns the latest state version from a reducer output.
 */
export function getLatestState(versions: StateVersion[]): StateVersion | null {
  if (versions.length === 0) return null;
  return versions[versions.length - 1];
}
