/**
 * Reconciliation: takes the pure fold output and persists it to the
 * derived tables (drone_state_versions, conflict_decisions).
 *
 * This is called synchronously from the ingestion route after every
 * successful insert. It truncates the drone's derived rows and rewrites
 * them from scratch — full recomputation per drone, every time (§3).
 */
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { foldEvents, type StateVersion } from "@/lib/fusion/reducer";
import type { ConflictDecision, FusionEvent, RuleConfig } from "@/lib/fusion/conflict";

export interface ReconcileResult {
  state_versions: StateVersion[];
  decisions: ConflictDecision[];
}

/**
 * Reconciles a single drone's state from its full event log.
 *
 * 1. Fetches all events for the drone from telemetry_events.
 * 2. Sorts + folds them through the pure reducer.
 * 3. Deletes old derived rows for this drone.
 * 4. Inserts fresh conflict_decisions and drone_state_versions.
 */
export async function reconcileDrone(
  droneId: string,
  rules: RuleConfig[]
): Promise<ReconcileResult> {
  // 1. Fetch all events for this drone
  const { data: dbEvents, error: fetchError } = await supabaseAdmin
    .from("telemetry_events")
    .select("id, drone_id, source, event_timestamp, lat, lon, alt, confidence")
    .eq("drone_id", droneId);

  if (fetchError) throw new Error(`Failed to fetch events: ${fetchError.message}`);
  if (!dbEvents || dbEvents.length === 0) {
    return { state_versions: [], decisions: [] };
  }

  // 1.5 Fetch manual overrides for this drone
  const { data: dbOverrides } = await supabaseAdmin
    .from("manual_overrides")
    .select("decision_timestamp, selected_source")
    .eq("drone_id", droneId);

  const overrides: Record<string, string> = {};
  if (dbOverrides) {
    for (const row of dbOverrides) {
      overrides[row.decision_timestamp] = row.selected_source;
    }
  }

  // 2. Map to FusionEvent shape and fold
  const fusionEvents: FusionEvent[] = dbEvents.map((e) => ({
    id: e.id,
    drone_id: e.drone_id,
    source: e.source as FusionEvent["source"],
    event_timestamp: e.event_timestamp,
    lat: e.lat,
    lon: e.lon,
    alt: e.alt,
    confidence: e.confidence,
  }));

  const foldResult = foldEvents({ events: fusionEvents, rules, overrides });

  // 3. Delete old derived rows for this drone
  await supabaseAdmin
    .from("drone_state_versions")
    .delete()
    .eq("drone_id", droneId);

  await supabaseAdmin
    .from("conflict_decisions")
    .delete()
    .eq("drone_id", droneId);

  // 4. Insert fresh conflict_decisions (only for actual conflicts)
  if (foldResult.decisions.length > 0) {
    const decisionRows = foldResult.decisions.map((d) => ({
      id: d.id,
      drone_id: d.drone_id,
      decision_timestamp: d.decision_timestamp,
      input_event_ids: d.input_event_ids,
      rule_applied: d.rule_applied,
      rule_id: d.rule_id,
      output_lat: d.output_lat,
      output_lon: d.output_lon,
      output_alt: d.output_alt,
      output_status: d.output_status,
    }));

    const { error: decError } = await supabaseAdmin
      .from("conflict_decisions")
      .insert(decisionRows);

    if (decError) throw new Error(`Failed to insert decisions: ${decError.message}`);
  }

  // 5. Insert fresh drone_state_versions
  if (foldResult.state_versions.length > 0) {
    const versionRows = foldResult.state_versions.map((v) => ({
      drone_id: v.drone_id,
      version: v.version,
      effective_timestamp: v.effective_timestamp,
      lat: v.lat,
      lon: v.lon,
      alt: v.alt,
      confidence: v.confidence,
      source_of_truth: v.source_of_truth,
      status: v.status,
      caused_by_event_id: v.caused_by_event_id,
      decision_id: v.decision_id,
    }));

    const { error: svError } = await supabaseAdmin
      .from("drone_state_versions")
      .insert(versionRows);

    if (svError) throw new Error(`Failed to insert state versions: ${svError.message}`);
  }

  return foldResult;
}

/**
 * Fetches the active resolution rules from the database.
 */
export async function getActiveRules(): Promise<RuleConfig[]> {
  const { data, error } = await supabaseAdmin
    .from("resolution_rules")
    .select("rules_json")
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch rules: ${error.message}`);
  if (!data) return [];

  return data.rules_json as RuleConfig[];
}
