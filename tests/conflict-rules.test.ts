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

describe("Conflict Rules via API", () => {
  const testDrone = "test-drone-conflict-1";
  
  beforeAll(async () => {
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone);
  });

  it("handles high confidence GPS vs LiDAR conflict", async () => {
    // Both submitted exactly same time
    const evtGPS = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 37, lon: -122, alt: 100 }, confidence: 0.95, // High confidence
    };
    const evtLiDAR = {
      drone_id: testDrone, source: "LiDAR", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 38, lon: -122, alt: 100 }, confidence: 0.95,
    };

    await POST(mockRequest(evtLiDAR));
    const res = await POST(mockRequest(evtGPS)); // second event triggers conflict
    expect(res.status).toBe(200);
    const json = await res.json();
    
    // GPS should win
    expect(json.resultingState.source_of_truth).toBe("GPS");
    expect(json.resultingState.lat).toBe(37);
    expect(json.resultingState.status).toBe("resolved");
  });
  
  it("handles low confidence overall unresolved", async () => {
    const testDrone2 = "test-drone-conflict-2";
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone2);

    const evtGPS = {
      drone_id: testDrone2, source: "GPS", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 37, lon: -122, alt: 100 }, confidence: 0.5, // Low
    };
    const evtLiDAR = {
      drone_id: testDrone2, source: "LiDAR", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 38, lon: -122, alt: 100 }, confidence: 0.5,
    };

    await POST(mockRequest(evtLiDAR));
    const res = await POST(mockRequest(evtGPS)); 
    expect(res.status).toBe(200);
    const json = await res.json();
    
    // Unresolved
    expect(json.resultingState.source_of_truth).toBeNull();
    expect(json.resultingState.status).toBe("unresolved");
  });
});
