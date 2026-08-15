import { describe, it, expect } from "vitest";
import { foldEvents } from "@/lib/fusion/reducer";
import { DEFAULT_RULES } from "@/lib/fusion/conflict";
import type { FusionEvent } from "@/lib/fusion/conflict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

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
      lat: pos?.lat ?? 0,
      lon: pos?.lon ?? 0,
      alt: pos?.alt ?? 0,
      confidence: evt.confidence as number,
    };
  });
}

const fixturesDir = path.join(__dirname, "..", "fixtures");
const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

describe("Fixture Expected Outcomes Verification", () => {
  for (const file of files) {
    it(`verifies expectedOutcomes for ${file}`, () => {
      const raw = readFileSync(path.join(fixturesDir, file), "utf-8");
      const fixture = JSON.parse(raw);
      const events = toFusionEvents(fixture.events, fixture.fixtureId);
      
      const result = foldEvents({ events, rules: DEFAULT_RULES });

      const expected = fixture.expectedOutcomes;
      
      if (expected.stateVersionsCount !== undefined) {
          expect(result.state_versions.length).toBe(expected.stateVersionsCount);
      }
      
      if (expected.decisionsCount !== undefined) {
          expect(result.decisions.length).toBe(expected.decisionsCount);
      }
      
      if (expected.latestState) {
          const latest = result.state_versions[result.state_versions.length - 1];
          if (expected.latestState.status !== undefined) {
              expect(latest.status).toBe(expected.latestState.status);
          }
          if (expected.latestState.source_of_truth !== undefined) {
              expect(latest.source_of_truth).toBe(expected.latestState.source_of_truth);
          }
          if (expected.latestState.lat !== undefined) {
              expect(latest.lat).toBe(expected.latestState.lat);
          }
      }
    });
  }
});
