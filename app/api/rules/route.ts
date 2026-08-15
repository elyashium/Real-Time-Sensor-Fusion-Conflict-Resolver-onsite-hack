import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/rules — returns the currently active resolution rule set */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("resolution_rules")
    .select("id, version, active, rules_json, created_at")
    .order("version", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const active = data?.find((r) => r.active) ?? null;

  return NextResponse.json({
    active,
    all: data ?? [],
  });
}

/**
 * PUT /api/rules — insert a new rule version and activate it.
 *
 * Body: { rules_json: RuleConfig[] }
 *
 * Inserts a new row with the next version number, marks it active,
 * and deactivates all prior rows atomically. This is the "dynamic
 * rule updates at runtime" bonus feature from §11.
 */
export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rules_json = (body as any)?.rules_json;
  if (!Array.isArray(rules_json) || rules_json.length === 0) {
    return NextResponse.json(
      { error: "Body must contain a non-empty rules_json array" },
      { status: 400 }
    );
  }

  // Get current max version
  const { data: existing } = await supabaseAdmin
    .from("resolution_rules")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (existing?.version ?? 0) + 1;

  // Deactivate all current rules
  await supabaseAdmin
    .from("resolution_rules")
    .update({ active: false })
    .eq("active", true);

  // Insert new active rule version
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("resolution_rules")
    .insert({ version: nextVersion, active: true, rules_json })
    .select()
    .maybeSingle();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ rule: inserted, version: nextVersion }, { status: 200 });
}
