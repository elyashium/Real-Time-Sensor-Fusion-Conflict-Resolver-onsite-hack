import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

export async function GET() {
  // Get all drones with their latest state version
  const { data: versions, error: vError } = await supabaseAdmin
    .from("drone_state_versions")
    .select("drone_id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status")
    .order("drone_id")
    .order("version", { ascending: false });

  if (vError) {
    return NextResponse.json({ error: vError.message }, { status: 500 });
  }

  if (!versions || versions.length === 0) {
    return NextResponse.json({ drones: [] });
  }

  // Group by drone_id and take the latest version of each
  const droneMap = new Map<string, typeof versions[0]>();
  for (const v of versions) {
    if (!droneMap.has(v.drone_id)) {
      droneMap.set(v.drone_id, v);
    }
  }

  // Get event counts and unresolved counts per drone
  const { data: eventCounts } = await supabaseAdmin
    .from("telemetry_events")
    .select("drone_id");

  const eventCountMap = new Map<string, number>();
  if (eventCounts) {
    for (const e of eventCounts) {
      eventCountMap.set(e.drone_id, (eventCountMap.get(e.drone_id) ?? 0) + 1);
    }
  }

  const { data: unresolvedCounts } = await supabaseAdmin
    .from("drone_state_versions")
    .select("drone_id")
    .eq("status", "unresolved");

  const unresolvedMap = new Map<string, number>();
  if (unresolvedCounts) {
    for (const u of unresolvedCounts) {
      unresolvedMap.set(u.drone_id, (unresolvedMap.get(u.drone_id) ?? 0) + 1);
    }
  }

  const drones = Array.from(droneMap.entries()).map(([drone_id, v]) => ({
    drone_id,
    latest_lat: v.lat,
    latest_lon: v.lon,
    latest_alt: v.alt,
    latest_confidence: v.confidence,
    latest_source: v.source_of_truth,
    latest_status: v.status,
    latest_timestamp: v.effective_timestamp,
    event_count: eventCountMap.get(drone_id) ?? 0,
    unresolved_count: unresolvedMap.get(drone_id) ?? 0,
  }));

  return NextResponse.json({ drones });
}
