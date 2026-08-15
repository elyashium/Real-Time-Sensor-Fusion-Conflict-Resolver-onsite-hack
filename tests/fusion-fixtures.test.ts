import { describe, it, expect } from "vitest";
import { foldEvents, getLatestState } from "@/lib/fusion/reducer";
import { DEFAULT_RULES } from "@/lib/fusion/conflict";
import type { FusionEvent } from "@/lib/fusion/conflict";
import { readFileSync } from "node:fs";
import path from "node:path";

function loadFixture(id: string) {
  const raw = readFileSync(path.join(__dirname, "..", "fixtures", `${id}.json`), "utf-8");
  return JSON.parse(raw);
}

/**
 * Converts fixture events (which use position.lat/lon/alt) into the
 * FusionEvent shape the reducer expects, generating stable UUIDs from
 * the event identity so determinism tests can compare across runs.
 */
function toFusionEvents(
  events: Array<Record<string, unknown>>,
  fixtureId: string
): FusionEvent[] {
  return events.map((evt, idx) => {
    const pos = evt.position as { lat: number; lon: number; alt: number };
    const ts = evt.timestamp as string;
    const source = evt.source as string;
    const droneId = evt.drone_id as string;
    const stableId = `${fixtureId}-${idx}-${droneId}-${source}-${ts}`;
    return {
      id: stableId,
      drone_id: droneId,
      source: source as FusionEvent["source"],
      event_timestamp: ts,
      lat: pos.lat,
      lon: pos.lon,
      alt: pos.alt,
      confidence: evt.confidence as number,
    };
  });
}

describe("Fixture 01: basic GPS/LiDAR conflict", () => {
  const fixture = loadFixture("01-basic-gps-lidar-conflict");

  it("prefers GPS when confidence > 0.8", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });
    expect(result.state_versions).toHaveLength(2);

    const v0 = result.state_versions[0];
    expect(v0.status).toBe("resolved");
    expect(v0.source_of_truth).toBe("GPS");
    expect(v0.lat).toBe(37.7749);
    expect(v0.confidence).toBe(0.91);

    const decision = result.decisions[0];
    expect(decision).toBeDefined();
    expect(decision.rule_applied).toContain("GPS preferred");
    expect(decision.rule_applied).toContain("0.91");
  });

  it("prefers LiDAR when GPS confidence <= 0.8", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });

    const v1 = result.state_versions[1];
    expect(v1.status).toBe("resolved");
    expect(v1.source_of_truth).toBe("LiDAR");

    const decision = result.decisions[1];
    expect(decision).toBeDefined();
    expect(decision.rule_applied).toContain("LiDAR preferred");
    expect(decision.rule_applied).toContain("0.75");
  });

  it("produces exactly 2 conflict decisions", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });
    expect(result.decisions).toHaveLength(2);
  });
});

describe("Fixture 03: single source (LiDAR only, no GPS)", () => {
  const fixture = loadFixture("03-missing-gps-lidar-only");

  it("resolves every bucket to LiDAR with no conflicts", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });

    expect(result.state_versions).toHaveLength(3);
    expect(result.decisions).toHaveLength(0);

    for (const sv of result.state_versions) {
      expect(sv.status).toBe("resolved");
      expect(sv.source_of_truth).toBe("LiDAR");
      expect(sv.decision_id).toBeNull();
    }
  });
});

describe("Fixture 04: late-arriving event", () => {
  const fixture = loadFixture("04-late-arriving-event");

  it("reconstructs correct chronological order regardless of submission order", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    // Events are in _submitOrder 1,2,3 but event 3 has earliest timestamp.
    // The fold must sort by event_timestamp, not submission order.
    const result = foldEvents({ events, rules: DEFAULT_RULES });

    expect(result.state_versions).toHaveLength(3);
    expect(result.state_versions[0].effective_timestamp).toBe("2026-06-01T09:55:00.000Z");
    expect(result.state_versions[1].effective_timestamp).toBe("2026-06-01T10:05:00.000Z");
    expect(result.state_versions[2].effective_timestamp).toBe("2026-06-01T10:10:00.000Z");
  });

  it("latest state is the latest by timestamp, not last submitted", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });
    const latest = getLatestState(result.state_versions);
    expect(latest).not.toBeNull();
    expect(latest!.effective_timestamp).toBe("2026-06-01T10:10:00.000Z");
    expect(latest!.lat).toBe(37.7505);
  });
});

describe("Fixture 06: both low confidence → unresolved", () => {
  const fixture = loadFixture("06-both-low-confidence-unresolved");

  it("marks as unresolved when all sources are below 0.6", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });

    expect(result.state_versions).toHaveLength(1);
    const sv = result.state_versions[0];
    expect(sv.status).toBe("unresolved");
    expect(sv.source_of_truth).toBeNull();
    expect(sv.lat).toBeNull();

    const decision = result.decisions[0];
    expect(decision).toBeDefined();
    expect(decision.output_status).toBe("unresolved");
    expect(decision.rule_applied).toContain("unresolved");
    expect(decision.rule_applied).toContain("0.35");
    expect(decision.rule_applied).toContain("0.50");
  });
});

describe("Fixture 07: state reverts to previous position", () => {
  const fixture = loadFixture("07-state-reverts-to-previous-position");

  it("accepts the return-to-A event as a new event, not a duplicate or conflict", () => {
    const events = toFusionEvents(fixture.events, fixture.fixtureId);
    const result = foldEvents({ events, rules: DEFAULT_RULES });

    expect(result.state_versions).toHaveLength(3);
    expect(result.decisions).toHaveLength(0);

    // Third event should have same position as first but different timestamp
    const v2 = result.state_versions[2];
    expect(v2.lat).toBe(37.79);
    expect(v2.alt).toBe(90);
    expect(v2.effective_timestamp).toBe("2026-06-01T14:10:00.000Z");
  });
});

describe("Determinism: same events, different order → same output", () => {
  const fixture01 = loadFixture("01-basic-gps-lidar-conflict");
  const fixture05 = loadFixture("05-out-of-order-replay");

  it("produces identical state versions and decisions regardless of input order", () => {
    const events01 = toFusionEvents(fixture01.events, "01-basic-gps-lidar-conflict");
    const events05 = toFusionEvents(fixture05.events, "05-out-of-order-replay");

    const result01 = foldEvents({ events: events01, rules: DEFAULT_RULES });
    const result05 = foldEvents({ events: events05, rules: DEFAULT_RULES });

    // State versions should be identical (same positions, sources, statuses)
    expect(result05.state_versions).toHaveLength(result01.state_versions.length);
    for (let i = 0; i < result01.state_versions.length; i++) {
      const a = result01.state_versions[i];
      const b = result05.state_versions[i];
      expect(b.effective_timestamp).toBe(a.effective_timestamp);
      expect(b.status).toBe(a.status);
      expect(b.source_of_truth).toBe(a.source_of_truth);
      expect(b.lat).toBe(a.lat);
      expect(b.lon).toBe(a.lon);
      expect(b.alt).toBe(a.alt);
    }

    // Decisions should have identical rule_applied strings
    expect(result05.decisions).toHaveLength(result01.decisions.length);
    for (let i = 0; i < result01.decisions.length; i++) {
      expect(result05.decisions[i].rule_applied).toBe(result01.decisions[i].rule_applied);
      expect(result05.decisions[i].output_status).toBe(result01.decisions[i].output_status);
    }
  });
});
