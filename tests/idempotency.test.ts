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

describe("Idempotency", () => {
  const testDrone = "test-drone-idem-1";
  
  beforeAll(async () => {
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone);
  });

  it("replaying an event N times leaves state unchanged", async () => {
    const event = {
      drone_id: testDrone,
      source: "LiDAR",
      timestamp: "2026-06-01T10:15:00.000Z",
      position: { lat: 40, lon: -100, alt: 50 },
      confidence: 0.85,
    };

    // First insert
    const res1 = await POST(mockRequest(event));
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    const stateV1 = json1.resultingState.version;

    // Second insert
    const res2 = await POST(mockRequest(event));
    expect(res2.status).toBe(409);
    
    // Check DB state versions count
    const { data } = await supabaseAdmin
      .from("drone_state_versions")
      .select("*")
      .eq("drone_id", testDrone);
      
    expect(data?.length).toBe(1);
    expect(data![0].version).toBe(stateV1);
  });
});
