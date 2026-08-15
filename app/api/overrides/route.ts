import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { reconcileDrone, getActiveRules } from "@/lib/fusion/reconcile";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { drone_id, decision_timestamp, selected_source } = body;

    if (!drone_id || !decision_timestamp || !selected_source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Insert the manual override into the audit log table
    const { error: insertError } = await supabaseAdmin
      .from("manual_overrides")
      .insert({
        drone_id,
        decision_timestamp,
        selected_source,
      });

    if (insertError) {
      console.error("Error inserting manual override:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 2. Trigger the engine to rebuild the drone's timeline.
    // The engine will now pick up the manual override and apply it deterministically.
    const rules = await getActiveRules();
    await reconcileDrone(drone_id, rules);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Override error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
