import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/events/replay/route";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

describe("Determinism Acceptance Test", () => {
  let allEvents: any[];
  
  beforeAll(async () => {
    allEvents = loadAllFixtures();
    // Clear EVERYTHING (ignore nulls or just use delete with neq)
    await supabaseAdmin.from("telemetry_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("drone_state_versions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("conflict_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }, 30000);

  it("replaying all fixtures twice yields exact deep equal database derived state", async () => {
    // 1. Replay first time
    const res1 = await POST(mockReplayRequest(allEvents));
    expect(res1.status).toBe(200);
    
    // Snapshot state
    const { data: state1 } = await supabaseAdmin.from("drone_state_versions").select("drone_id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status").order("drone_id").order("version");
    const { data: dec1 } = await supabaseAdmin.from("conflict_decisions").select("drone_id, decision_timestamp, rule_applied, output_status").order("drone_id").order("decision_timestamp");

    // 2. Truncate events table to truly replay from scratch
    await supabaseAdmin.from("telemetry_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Shuffle events (reverse order)
    const reversedEvents = [...allEvents].reverse();

    // 4. Replay second time
    const res2 = await POST(mockReplayRequest(reversedEvents));
    expect(res2.status).toBe(200);

    // Snapshot state again
    const { data: state2 } = await supabaseAdmin.from("drone_state_versions").select("drone_id, version, effective_timestamp, lat, lon, alt, confidence, source_of_truth, status").order("drone_id").order("version");
    const { data: dec2 } = await supabaseAdmin.from("conflict_decisions").select("drone_id, decision_timestamp, rule_applied, output_status").order("drone_id").order("decision_timestamp");

    // 5. Assert deep equality
    expect(state1).toBeDefined();
    expect(state2).toBeDefined();
    expect(state1!.length).toBeGreaterThan(0);
    expect(state1).toEqual(state2);

    expect(dec1).toBeDefined();
    expect(dec2).toBeDefined();
    expect(dec1).toEqual(dec2);
  }, 60000);
});
