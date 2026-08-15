import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const droneId = params.id;

  // Fetch latest state version
  const { data: versions, error: vError } = await supabaseAdmin
    .from("drone_state_versions")
    .select("id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status, caused_by_event_id, decision_id")
    .eq("drone_id", droneId)
    .order("version", { ascending: true });

  if (vError) {
    return NextResponse.json({ error: vError.message }, { status: 500 });
  }

  // Fetch events
  const { data: events, error: eError } = await supabaseAdmin
    .from("telemetry_events")
    .select("id, source, event_timestamp, raw_timestamp, lat, lon, alt, confidence, is_replay, ingested_at")
    .eq("drone_id", droneId)
    .order("event_timestamp", { ascending: true });

  if (eError) {
    return NextResponse.json({ error: eError.message }, { status: 500 });
  }

  // Fetch conflict decisions
  const { data: decisions, error: dError } = await supabaseAdmin
    .from("conflict_decisions")
    .select("id, decision_timestamp, input_event_ids, rule_applied, rule_id, output_lat, output_lon, output_alt, output_status, created_at")
    .eq("drone_id", droneId)
    .order("decision_timestamp", { ascending: true });

  if (dError) {
    return NextResponse.json({ error: dError.message }, { status: 500 });
  }

  if ((!versions || versions.length === 0) && (!events || events.length === 0)) {
    return NextResponse.json({ error: "Drone not found" }, { status: 404 });
  }

  const latestVersion = versions && versions.length > 0 ? versions[versions.length - 1] : null;
  const unresolvedCount = versions?.filter((v) => v.status === "unresolved").length ?? 0;

  return NextResponse.json({
    drone_id: droneId,
    latest_lat: latestVersion?.lat ?? null,
    latest_lon: latestVersion?.lon ?? null,
    latest_alt: latestVersion?.alt ?? null,
    latest_confidence: latestVersion?.confidence ?? null,
    latest_source: latestVersion?.source_of_truth ?? null,
    latest_status: latestVersion?.status ?? "stale",
    latest_timestamp: latestVersion?.effective_timestamp ?? null,
    event_count: events?.length ?? 0,
    unresolved_count: unresolvedCount,
    state_versions: versions ?? [],
    events: events ?? [],
    decisions: decisions ?? [],
  });
}
