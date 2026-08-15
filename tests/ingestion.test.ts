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

describe("POST /api/events - Ingestion", () => {
  const testDrone = `test-drone-ingest-${Date.now()}`;

  beforeAll(async () => {
    // Delete might fail due to RLS, so unique ID is used instead.
    await supabaseAdmin.from("telemetry_events").delete().eq("drone_id", testDrone);
  });

  it("returns 400 on malformed body", async () => {
    const req = mockRequest({ drone_id: testDrone }); // missing fields
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 200 on successful ingest and computes resultingState", async () => {
    const event = {
      drone_id: testDrone,
      source: "GPS",
      timestamp: "2026-06-01T10:00:00.000Z",
      position: { lat: 37, lon: -122, alt: 100 },
      confidence: 0.9,
    };
    const req = mockRequest(event);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.event).toBeDefined();
    expect(json.resultingState).toBeDefined();
    expect(json.resultingState.lat).toBe(37);
  });

  it("returns 409 on duplicate dedupe_key", async () => {
    const event = {
      drone_id: testDrone,
      source: "GPS",
      timestamp: "2026-06-01T10:00:00.000Z", // exact same event
      position: { lat: 37, lon: -122, alt: 100 },
      confidence: 0.9,
    };
    const req = mockRequest(event);
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.reason).toBe("duplicate");
  });
});
