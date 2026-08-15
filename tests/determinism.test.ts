import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/events/replay/route";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Determinism Acceptance Test
 *
 * Goal: prove that foldEvents + reconcileDrone produce the same derived state
 * regardless of the submission order of events.
 *
 * Strategy:
 *   Run A: replay all fixture events (in file order) against drone IDs suffixed "-a"
 *   Run B: replay ALL the same events (in REVERSED order) against drone IDs suffixed "-b"
 *   Assert: drone_state_versions and conflict_decisions are deep-equal between A and B
 *           (after normalizing drone_id to strip the suffix)
 *
 * We use distinct drone IDs per run so the append-only telemetry_events table
 * (which has no DELETE policy by design) never causes false duplicates.
 */

const RUN_STAMP = Date.now().toString(36);

// Canonical fixture drone IDs
const CANONICAL_DRONES = ["drone-alpha", "drone-bravo", "drone-charlie", "drone-delta", "drone-echo"];

function makeRunDroneId(canonical: string, runLabel: "a" | "b") {
  return `det-${canonical}-${RUN_STAMP}-${runLabel}`;
}

function remapEvents(events: any[], runLabel: "a" | "b"): any[] {
  return events.map((e) => ({
    ...e,
    drone_id: makeRunDroneId(e.drone_id ?? e.droneId, runLabel),
  }));
}

function mockReplayRequest(events: any[]) {
  return new NextRequest("http://localhost/api/events/replay", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

function loadAllFixtures(): any[] {
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  let all: any[] = [];
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf-8"));
    all = all.concat(fixture.events);
  }
  return all;
}

async function snapshotState(runLabel: "a" | "b") {
  const droneIds = CANONICAL_DRONES.map((d) => makeRunDroneId(d, runLabel));

  const { data: states, error: se } = await supabaseAdmin
    .from("drone_state_versions")
    .select("drone_id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status")
    .in("drone_id", droneIds)
    .order("drone_id")
    .order("version");

  const { data: decisions, error: de } = await supabaseAdmin
    .from("conflict_decisions")
    .select("drone_id, decision_timestamp, rule_applied, output_status")
    .in("drone_id", droneIds)
    .order("drone_id")
    .order("decision_timestamp");

  if (se) throw new Error(`state snapshot error: ${se.message}`);
  if (de) throw new Error(`decision snapshot error: ${de.message}`);

  // Normalize drone_id back to canonical form for comparison
  const normalize = (rows: any[], label: string) =>
    (rows ?? []).map((r) => ({
      ...r,
      drone_id: r.drone_id.replace(`-${RUN_STAMP}-${label}`, ""),
    }));

  return {
    states: normalize(states ?? [], runLabel),
    decisions: normalize(decisions ?? [], runLabel),
  };
}

describe("Determinism Acceptance Test", () => {
  let rawEvents: any[];

  beforeAll(() => {
    rawEvents = loadAllFixtures();
  });

  it("replaying all fixtures in two different orders yields identical derived state", async () => {
    // Run A: events in file order, drone IDs suffixed "-a"
    const eventsA = remapEvents(rawEvents, "a");
    const resA = await POST(mockReplayRequest(eventsA));
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.accepted).toBeGreaterThan(0);

    // Run B: same events in reverse order, drone IDs suffixed "-b"
    const eventsB = remapEvents([...rawEvents].reverse(), "b");
    const resB = await POST(mockReplayRequest(eventsB));
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    expect(jsonB.accepted).toBeGreaterThan(0);

    // Snapshot both runs
    const { states: statesA, decisions: decsA } = await snapshotState("a");
    const { states: statesB, decisions: decsB } = await snapshotState("b");

    // Assert deep equality
    expect(statesA.length).toBeGreaterThan(0);
    expect(statesA).toEqual(statesB);
    expect(decsA).toEqual(decsB);
  }, 60000);
});
