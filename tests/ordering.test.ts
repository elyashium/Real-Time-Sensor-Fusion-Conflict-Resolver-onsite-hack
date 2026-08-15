import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "@/app/api/events/route";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase-admin";

function mockRequest(body: any) {
  return new NextRequest("http://localhost/api/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Ordering & Late Arrival", () => {
  const testDrone = "test-drone-ordering-1";
  
  beforeAll(async () => {
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone);
  });

  it("reconstructs correct state regardless of submission order", async () => {
    // Event 1 (Latest timestamp but submitted last)
    const evtLatest = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T10:20:00.000Z",
      position: { lat: 38, lon: -121, alt: 200 }, confidence: 0.9,
    };
    // Event 2 (Earliest timestamp but submitted first)
    const evtEarliest = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 37, lon: -122, alt: 100 }, confidence: 0.9,
    };
    // Event 3 (Middle timestamp, submitted middle)
    const evtMiddle = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T10:10:00.000Z",
      position: { lat: 37.5, lon: -121.5, alt: 150 }, confidence: 0.9,
    };

    await POST(mockRequest(evtEarliest));
    await POST(mockRequest(evtMiddle));
    const res = await POST(mockRequest(evtLatest));
    
    expect(res.status).toBe(200);
    const json = await res.json();
    
    // The resulting state from the final insert should be the state for evtLatest
    expect(json.resultingState.lat).toBe(38);
    expect(json.resultingState.version).toBe(2);

    // Now insert a late-arriving event (before earliest)
    const evtLateArrival = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T09:50:00.000Z",
      position: { lat: 36, lon: -123, alt: 50 }, confidence: 0.9,
    };

    const resLate = await POST(mockRequest(evtLateArrival));
    expect(resLate.status).toBe(200);
    const jsonLate = await resLate.json();

    // The resulting state returned should STILL be the latest state by timestamp (evtLatest)
    expect(jsonLate.resultingState.lat).toBe(38);

    // Check DB state versions count
    const { data } = await supabaseAdmin
      .from("drone_state_versions")
      .select("*")
      .eq("drone_id", testDrone)
      .order("version", { ascending: true });
      
    expect(data?.length).toBe(4);
    expect(data![0].lat).toBe(36); // evtLateArrival
    expect(data![3].lat).toBe(38); // evtLatest
  });
});
