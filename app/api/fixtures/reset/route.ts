import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

export async function POST() {
  try {
    // Truncate all telemetry data to reset the demo
    // Order matters due to foreign keys, but we can just delete from the root tables
    await supabaseAdmin.from("manual_overrides").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("drone_state_versions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("conflict_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("telemetry_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
