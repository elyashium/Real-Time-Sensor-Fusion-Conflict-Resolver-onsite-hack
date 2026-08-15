/**
 * Timestamp normalization + dedupe_key computation.
 * See implementation.md §2 (telemetry_events table) and §3 (ingestion).
 *
 * IMPORTANT: dedupe_key is derived ONLY from (drone_id, source,
 * normalized timestamp) — never from position/confidence/telemetry_data.
 * This is intentional: per the PRD, "duplicate" means same
 * drone_id+timestamp+source, full stop. Two submissions with that same
 * identity but different payload values are still duplicates (see
 * fixtures/02-duplicate-events.json, event 3) — the second one loses,
 * it does not "correct" the first.
 */
import { createHash } from "node:crypto";

export function normalizeTimestamp(rawTimestamp: string): string {
  const date = new Date(rawTimestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Cannot normalize invalid timestamp: ${rawTimestamp}`);
  }
  return date.toISOString();
}

export interface DedupeKeyInput {
  drone_id: string;
  source: string;
  timestamp: string;
}

export function computeDedupeKey({ drone_id, source, timestamp }: DedupeKeyInput): string {
  const normalized = normalizeTimestamp(timestamp);
  const raw = `${drone_id}|${source}|${normalized}`;
  return createHash("sha256").update(raw).digest("hex");
}

export interface OrderableEvent {
  id: string;
  drone_id: string;
  source: string;
  event_timestamp: string;
}

export function compareEventsForFold(a: OrderableEvent, b: OrderableEvent): number {
  if (a.event_timestamp !== b.event_timestamp) {
    return a.event_timestamp < b.event_timestamp ? -1 : 1;
  }
  if (a.source !== b.source) {
    return a.source < b.source ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
