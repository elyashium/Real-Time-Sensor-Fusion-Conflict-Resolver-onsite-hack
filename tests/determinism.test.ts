import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/events/replay/route";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The exact drone IDs present in the fixtures directory
const FIXTURE_DRONE_IDS = ["drone-alpha", "drone-bravo", "drone-charlie", "drone-delta", "drone-echo"];

function mockReplayRequest(events: any[]) {
  return new NextRequest("http://localhost/api/events/replay", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

function loadAllFixtures() {
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  let allEvents: any[] = [];
  for (const file of files) {
    const raw = readFileSync(path.join(fixturesDir, file), "utf-8");
    const fixture = JSON.parse(raw);
    allEvents = allEvents.concat(fixture.events);
  }
  return allEvents;
}

async function clearFixtureDrones() {
  for (const droneId of FIXTURE_DRONE_IDS) {
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", droneId);
    await supabaseAdmin.from("drone_state_versions").delete().eq("drone_id", droneId);
    await supabaseAdmin.from("conflict_decisions").delete().eq("drone_id", droneId);
  }
}

async function snapshotFixtureState() {
  const { data: states } = await supabaseAdmin
    .from("drone_state_versions")
    .select("drone_id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status")
    .in("drone_id", FIXTURE_DRONE_IDS)
    .order("drone_id")
    .order("version");

  const { data: decisions } = await supabaseAdmin
    .from("conflict_decisions")
    .select("drone_id, decision_timestamp, rule_applied, output_status")
    .in("drone_id", FIXTURE_DRONE_IDS)
    .order("drone_id")
    .order("decision_timestamp");

  return { states, decisions };
}

describe("Determinism Acceptance Test", () => {
  let allEvents: any[];

  beforeAll(async () => {
    allEvents = loadAllFixtures();
    await clearFixtureDrones();
  }, 30000);

  it("replaying all fixtures twice yields exact deep equal database derived state", async () => {
    // 1. Replay first time (events in fixture file order)
    const res1 = await POST(mockReplayRequest(allEvents));
    expect(res1.status).toBe(200);

    // Snapshot fixture-drone state after first replay
    const { states: state1, decisions: dec1 } = await snapshotFixtureState();

    // 2. Clear only fixture drone data, then replay in reverse order
    await clearFixtureDrones();
    const reversedEvents = [...allEvents].reverse();

    const res2 = await POST(mockReplayRequest(reversedEvents));
    expect(res2.status).toBe(200);

    // Snapshot fixture-drone state after second replay
    const { states: state2, decisions: dec2 } = await snapshotFixtureState();

    // 3. Assert deep equality — order of submission must not change derived state
    expect(state1).toBeDefined();
    expect(state2).toBeDefined();
    expect(state1!.length).toBeGreaterThan(0);
    expect(state1).toEqual(state2);

    expect(dec1).toBeDefined();
    expect(dec2).toBeDefined();
    expect(dec1).toEqual(dec2);
  }, 60000);
});
