"use client";

import { useState, ReactNode } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import { Zap, Package, Radio, Hourglass, Rewind, AlertTriangle, RefreshCw, Loader2, CheckCircle2, XCircle } from "lucide-react";

const FIXTURES: { id: string, label: string, icon: ReactNode }[] = [
  { id: "01-basic-gps-lidar-conflict", label: "GPS vs LiDAR Conflict", icon: <Zap size={14} /> },
  { id: "02-duplicate-events", label: "Duplicates & Retries", icon: <Package size={14} /> },
  { id: "03-missing-gps-lidar-only", label: "Missing Sensor (LiDAR only)", icon: <Radio size={14} /> },
  { id: "04-late-arriving-event", label: "Late-Arriving Event", icon: <Hourglass size={14} /> },
  { id: "05-out-of-order-replay", label: "Out of Order Replay", icon: <Rewind size={14} /> },
  { id: "06-both-low-confidence-unresolved", label: "Low Confidence (Unresolved)", icon: <AlertTriangle size={14} /> },
  { id: "07-state-reverts-to-previous-position", label: "State Reversion", icon: <RefreshCw size={14} /> },
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
      const fixtureRes = await fetch(`/api/fixtures/${fixtureId}`);
      if (!fixtureRes.ok) throw new Error("Fixture not found");
      const fixture = await fixtureRes.json();

      const res = await fetch("/api/events/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: fixture.events }),
      });
      const json = await res.json();

      if (res.ok) {
        setResults((prev) => ({ ...prev, [fixtureId]: { ok: true, msg: `Loaded ${fixture.events.length} events` } }));
        trackEvent("fixture_load_success", { fixture: fixtureId });
        onLoad?.();
      } else {
        setResults((prev) => ({ ...prev, [fixtureId]: { ok: false, msg: json.error ?? "Unknown error" } }));
        trackEvent("fixture_load_error", { fixture: fixtureId, error: json.error });
      }
    } catch (e: any) {
      setResults((prev) => ({ ...prev, [fixtureId]: { ok: false, msg: e.message } }));
      trackEvent("fixture_load_error", { fixture: fixtureId, error: e.message });
    } finally {
      setLoading(null);
    }
  };

  const loadAll = async () => {
    setLoading("all");
    trackEvent("load_all_fixtures_started");
    for (const f of FIXTURES) {
      await loadFixture(f.id);
    }
    setLoading(null);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={loadAll}
        disabled={!!loading}
        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 border border-indigo-500/50 mb-4 flex items-center justify-center gap-2"
      >
        {loading === "all" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Package size={16} />
        )}
        Load All Fixtures
      </button>

      {FIXTURES.map((f) => {
        const result = results[f.id];
        return (
          <div
            key={f.id}
            className="flex flex-col p-3 rounded-xl border border-white/8 bg-white/3"
          >
            <div className="flex items-center gap-3">
              {loading === f.id ? (
                <Loader2 size={14} className="animate-spin text-zinc-500" />
              ) : result ? (
                result.ok ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <XCircle size={14} className="text-red-500" />
                )
              ) : (
                <span className="text-zinc-500">{f.icon}</span>
              )}
              <span className="text-xs font-semibold text-zinc-300 flex-1">{f.label}</span>
              <button
                id={`load-fixture-${f.id}`}
                onClick={() => loadFixture(f.id)}
                disabled={!!loading}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-xs text-zinc-300 font-semibold transition-all duration-150 disabled:opacity-50"
              >
                {loading === f.id ? "..." : "Load"}
              </button>
            </div>
            {result && (
              <div className={`mt-1.5 ml-8 text-[10px] font-mono leading-tight ${result.ok ? "text-emerald-400/80" : "text-red-400"}`}>
                {result.msg}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
