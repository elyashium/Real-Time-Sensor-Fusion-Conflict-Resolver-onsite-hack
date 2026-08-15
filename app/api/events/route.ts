import { NextRequest, NextResponse } from "next/server";
import { parseTelemetryEvent } from "@/lib/validation/telemetry-event";
import { computeDedupeKey, normalizeTimestamp } from "@/lib/fusion/dedupe";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { reconcileDrone, getActiveRules } from "@/lib/fusion/reconcile";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTelemetryEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Validation failed", fields: parsed.errors }, { status: 400 });
  }

  const evt = parsed.data;
  const normalizedTs = normalizeTimestamp(evt.timestamp);
  const dedupeKey = computeDedupeKey({
    drone_id: evt.drone_id,
    source: evt.source,
    timestamp: evt.timestamp,
  });

  // Attempt insert — unique constraint on dedupe_key is the duplicate check
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

  if (insertError) {
    // Check for unique constraint violation (duplicate)
    if (insertError.code === "23505") {
      return NextResponse.json(
        { reason: "duplicate", dedupe_key: dedupeKey },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (!inserted) {
    return NextResponse.json({ error: "Insert returned no data" }, { status: 500 });
  }

  // Synchronously recompute the affected drone's state (§3)
  let resultingState = null;
  try {
    const rules = await getActiveRules();
    const result = await reconcileDrone(evt.drone_id, rules);
    const latest = result.state_versions[result.state_versions.length - 1] ?? null;
    if (latest) {
      resultingState = {
        version: latest.version,
        effective_timestamp: latest.effective_timestamp,
        lat: latest.lat,
        lon: latest.lon,
        alt: latest.alt,
        confidence: latest.confidence,
        source_of_truth: latest.source_of_truth,
        status: latest.status,
      };
    }
  } catch (reconcileErr) {
    // The event was ingested but reconciliation failed — return the event
    // with a warning. The next ingestion will re-reconcile.
    return NextResponse.json({
      event: inserted,
      resultingState: null,
      warning: "Reconciliation failed — state will be rebuilt on next event",
    });
  }

  return NextResponse.json({ event: inserted, resultingState }, { status: 200 });
}
