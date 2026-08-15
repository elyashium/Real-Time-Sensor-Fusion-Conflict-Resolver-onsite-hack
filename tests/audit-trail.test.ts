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

describe("Audit Trail API Test", () => {
  const testDrone = `test-drone-audit-${Date.now()}`;
  
  beforeAll(async () => {
    // Delete might fail due to RLS, so unique ID is used instead.
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone);
  });

  it("decision records trace cleanly back to input events", async () => {
    const evtGPS = {
      drone_id: testDrone, source: "GPS", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 37, lon: -122, alt: 100 }, confidence: 0.95,
    };
    const evtLiDAR = {
      drone_id: testDrone, source: "LiDAR", timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 38, lon: -122, alt: 100 }, confidence: 0.95,
    };

    const resLidar = await POST(mockRequest(evtLiDAR));
    const jsonLidar = await resLidar.json();
    const resGps = await POST(mockRequest(evtGPS));
    const jsonGps = await resGps.json();
    
    // Check decisions
    const { data: decisions } = await supabaseAdmin
      .from("conflict_decisions")
      .select("*")
      .eq("drone_id", testDrone);
      
    expect(decisions?.length).toBeGreaterThan(0);
    const decision = decisions![0];
    
    expect(decision.input_event_ids).toContain(jsonLidar.event.id);
    expect(decision.input_event_ids).toContain(jsonGps.event.id);
    expect(decision.rule_applied).toBeDefined();
    expect(decision.output_status).toBe("resolved");
  });
});
