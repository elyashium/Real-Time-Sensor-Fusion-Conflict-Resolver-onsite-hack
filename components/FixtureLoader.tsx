"use client";

import { useState } from "react";

const FIXTURES = [
  { id: "01-basic-gps-lidar-conflict", label: "GPS vs LiDAR Conflict", icon: "⚡" },
  { id: "02-duplicate-events", label: "Duplicate Events", icon: "🔁" },
  { id: "03-missing-gps-lidar-only", label: "LiDAR Only", icon: "🔴" },
  { id: "04-late-arriving-event", label: "Late Arriving Event", icon: "⏰" },
  { id: "05-out-of-order-replay", label: "Out-of-Order Replay", icon: "🔀" },
  { id: "06-both-low-confidence-unresolved", label: "Low Confidence", icon: "❓" },
  { id: "07-state-reverts-to-previous-position", label: "State Revert", icon: "↩" },
];

interface FixtureLoaderProps {
  onLoad?: () => void;
}

export default function FixtureLoader({ onLoad }: FixtureLoaderProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const loadFixture = async (fixtureId: string) => {
    setLoading(fixtureId);
    try {
      // Fetch fixture from the static files endpoint
      const fixtureRes = await fetch(`/api/fixtures/${fixtureId}`);
      if (!fixtureRes.ok) throw new Error("Fixture not found");
      const fixture = await fixtureRes.json();

      // Replay events
      const res = await fetch("/api/events/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: fixture.events }),
      });
      const json = await res.json();

      if (res.ok) {
        setResults((prev) => ({ ...prev, [fixtureId]: { ok: true, msg: `Loaded ${fixture.events.length} events` } }));
        onLoad?.();
      } else {
        setResults((prev) => ({ ...prev, [fixtureId]: { ok: false, msg: json.error ?? "Unknown error" } }));
      }
    } catch (e: any) {
      setResults((prev) => ({ ...prev, [fixtureId]: { ok: false, msg: e.message } }));
    } finally {
      setLoading(null);
    }
  };

  const loadAll = async () => {
    for (const f of FIXTURES) {
      await loadFixture(f.id);
    }
  };

  return (
    <div className="space-y-2">
      <button
        id="load-all-fixtures"
        onClick={loadAll}
        disabled={!!loading}
        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 border border-indigo-500/50 mb-4 flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="animate-spin">⟳</span>
        ) : (
          "▶"
        )}
        Load All Fixtures
      </button>

      {FIXTURES.map((f) => {
        const result = results[f.id];
        return (
          <div
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/3 group"
          >
            <span className="text-lg">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-300 truncate">{f.label}</p>
              {result && (
                <p className={`text-xs mt-0.5 ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {result.ok ? "✓" : "✗"} {result.msg}
                </p>
              )}
            </div>
            <button
              id={`load-fixture-${f.id}`}
              onClick={() => loadFixture(f.id)}
              disabled={loading === f.id}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-xs text-zinc-300 font-semibold transition-all duration-150 disabled:opacity-50"
            >
              {loading === f.id ? "⟳" : "Load"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
