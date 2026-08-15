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

  // Group by drone_id and take the latest version, but also find the most recent valid position
  const droneMap = new Map<string, typeof versions[0]>();
  const lastKnownPosMap = new Map<string, { lat: number; lon: number; alt: number | null; conf: number | null; source: string | null }>();

  for (const v of versions) {
    // Save the absolute latest version for status
    if (!droneMap.has(v.drone_id)) {
      droneMap.set(v.drone_id, v);
    }
    // Save the most recent valid position
    if (v.lat !== null && v.lon !== null && !lastKnownPosMap.has(v.drone_id)) {
      lastKnownPosMap.set(v.drone_id, {
        lat: v.lat,
        lon: v.lon,
        alt: v.alt,
        conf: v.confidence,
        source: v.source_of_truth
      });
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

  const drones = Array.from(droneMap.entries()).map(([drone_id, v]) => {
    const pos = lastKnownPosMap.get(drone_id);
    return {
      drone_id,
      latest_lat: pos?.lat ?? null,
      latest_lon: pos?.lon ?? null,
      latest_alt: pos?.alt ?? null,
      latest_confidence: pos?.conf ?? null,
      latest_source: pos?.source ?? null,
      latest_status: v.status,
      latest_timestamp: v.effective_timestamp,
      event_count: eventCountMap.get(drone_id) ?? 0,
      unresolved_count: unresolvedMap.get(drone_id) ?? 0,
    };
  });

  return NextResponse.json({ drones });
}
