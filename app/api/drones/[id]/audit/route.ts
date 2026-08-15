import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const droneId = params.id;

  const [stateRes, eventsRes, decRes] = await Promise.all([
    supabaseAdmin
      .from("drone_state_versions")
      .select("*")
      .eq("drone_id", droneId)
      .order("version", { ascending: true }),
    supabaseAdmin
      .from("telemetry_events")
      .select("*")
      .eq("drone_id", droneId)
      .order("event_timestamp", { ascending: true }),
    supabaseAdmin
      .from("conflict_decisions")
      .select("*")
      .eq("drone_id", droneId)
      .order("decision_timestamp", { ascending: true }),
  ]);

  if (stateRes.error || eventsRes.error || decRes.error) {
    return NextResponse.json({ error: "Failed to fetch audit data" }, { status: 500 });
  }

  const payload = {
    drone_id: droneId,
    state_versions: stateRes.data,
    events: eventsRes.data,
    decisions: decRes.data,
    exported_at: new Date().toISOString(),
  };

  const response = new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="audit-${droneId}.json"`,
    },
  });

  return response;
}
