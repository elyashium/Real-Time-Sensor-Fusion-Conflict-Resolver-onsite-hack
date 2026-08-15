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
 * regardless of the order that FIXTURE FILES are submitted.
 *
 * Strategy:
 *   Run A: replay all fixture events grouped by file in file-name order,
 *          using drone IDs suffixed "-a"
 *   Run B: replay the SAME events grouped by file in REVERSED file-name order,
 *          using drone IDs suffixed "-b"
 *
 *   Within each fixture file, events keep their original order (preserving the
 *   fixture's intended deduplication behavior — e.g., fixture 02 wants event 1
 *   to win over event 3 regardless of which fixture file arrives first).
 *
 * Assert: drone_state_versions and conflict_decisions for drone IDs are deep-equal
 *         between run A and run B (after normalizing drone_id to strip suffixes).
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

interface Fixture { file: string; events: any[] }

function loadFixtureFiles(): Fixture[] {
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort();
  return files.map((file) => {
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, file), "utf-8"));
    return { file, events: fixture.events };
  });
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
  const suffix = `-${RUN_STAMP}-${runLabel}`;
  const normalize = (rows: any[]) =>
    (rows ?? []).map((r) => ({
      ...r,
      drone_id: r.drone_id.replace(`det-`, "").replace(suffix, ""),
    }));

  return {
    states: normalize(states ?? []),
    decisions: normalize(decisions ?? []),
  };
}

describe("Determinism Acceptance Test", () => {
  let fixtures: Fixture[];

  beforeAll(() => {
    fixtures = loadFixtureFiles();
  });

  it("replaying fixture files in two different ORDERS yields identical derived state", async () => {
    // Run A: fixture files in alphabetical order (01→07)
    const eventsA = fixtures.flatMap((f) => remapEvents(f.events, "a"));
    const resA = await POST(mockReplayRequest(eventsA));
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.accepted).toBeGreaterThan(0);

    // Run B: fixture files in REVERSE alphabetical order (07→01)
    // Within each file, events stay in original order (preserving fixture semantics)
    const eventsB = [...fixtures].reverse().flatMap((f) => remapEvents(f.events, "b"));
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
