import { NextRequest, NextResponse } from "next/server";
import { parseTelemetryEvent } from "@/lib/validation/telemetry-event";
import { computeDedupeKey, normalizeTimestamp } from "@/lib/fusion/dedupe";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { reconcileDrone, getActiveRules } from "@/lib/fusion/reconcile";

interface ReplayItemResult {
  index: number;
  status: "accepted" | "duplicate" | "error";
  httpStatus: number;
  drone_id: string;
  timestamp: string;
  source: string;
  reason?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as any).events)) {
    return NextResponse.json(
      { error: "Body must contain an 'events' array" },
      { status: 400 }
    );
  }

  const events = (body as any).events as unknown[];
  if (events.length === 0) {
    return NextResponse.json({ error: "events array must not be empty" }, { status: 400 });
  }

  const rules = await getActiveRules();
  const results: ReplayItemResult[] = [];
  const affectedDrones = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const parsed = parseTelemetryEvent(events[i]);
    if (!parsed.ok) {
      results.push({
        index: i,
        status: "error",
        httpStatus: 400,
        drone_id: "unknown",
        timestamp: "unknown",
        source: "unknown",
        error: "Validation failed",
      });
      continue;
    }

    const evt = parsed.data;
    const normalizedTs = normalizeTimestamp(evt.timestamp);
    const dedupeKey = computeDedupeKey({
      drone_id: evt.drone_id,
      source: evt.source,
      timestamp: evt.timestamp,
    });

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("telemetry_events")
      .insert({
        drone_id: evt.drone_id,
        source: evt.source,
        event_timestamp: normalizedTs,
        raw_timestamp: evt.timestamp,
        lat: evt.position.lat,
        lon: evt.position.lon,
        alt: evt.position.alt,
        confidence: evt.confidence,
        telemetry_data: evt.telemetry_data ?? null,
        dedupe_key: dedupeKey,
        is_replay: evt.replay ?? false,
      })
      .select()
      .maybeSingle();

    if (insertError && insertError.code === "23505") {
      results.push({
        index: i,
        status: "duplicate",
        httpStatus: 409,
        drone_id: evt.drone_id,
        timestamp: evt.timestamp,
        source: evt.source,
        reason: "duplicate",
      });
      continue;
    }

    if (insertError) {
      results.push({
        index: i,
        status: "error",
        httpStatus: 500,
        drone_id: evt.drone_id,
        timestamp: evt.timestamp,
        source: evt.source,
        error: insertError.message,
      });
      continue;
    }

    affectedDrones.add(evt.drone_id);
    results.push({
      index: i,
      status: "accepted",
      httpStatus: 200,
      drone_id: evt.drone_id,
      timestamp: evt.timestamp,
      source: evt.source,
    });
  }

  // Reconcile all affected drones
  const reconciliationErrors: string[] = [];
  for (const droneId of Array.from(affectedDrones)) {
    try {
      await reconcileDrone(droneId, rules);
    } catch (err) {
      reconciliationErrors.push(`${droneId}: ${(err as Error).message}`);
    }
  }

  const accepted = results.filter((r) => r.status === "accepted").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    total: events.length,
    accepted,
    duplicates,
    errors,
    results,
    reconciliationErrors: reconciliationErrors.length > 0 ? reconciliationErrors : undefined,
  });
}
