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
  { id: "08-massive-fleet-demo", label: "Massive Fleet (50 Drones)", icon: <Zap size={14} /> },
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

  const resetDemo = async () => {
    setLoading("reset");
    try {
      await fetch("/api/fixtures/reset", { method: "POST" });
      setResults({});
      onLoad?.();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-2 p-3 pb-0">
        <button
          onClick={loadAll}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-foreground text-background text-[11px] font-medium rounded hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {loading === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading === "all" ? "Loading..." : "Load All Fixtures"}
        </button>
        <button
          onClick={resetDemo}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/20 text-[11px] font-medium rounded hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          {loading === "reset" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Reset Database
        </button>
      </div>
      {FIXTURES.map((f) => {
        const result = results[f.id];
        return (
          <div
            key={f.id}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-card"
          >
            <span className="text-muted-foreground shrink-0">
              {loading === f.id ? (
                <Loader2 size={11} className="animate-spin" />
              ) : result ? (
                result.ok ? (
                  <CheckCircle2 size={11} className="text-emerald-600" />
                ) : (
                  <XCircle size={11} className="text-red-600" />
                )
              ) : (
                <span>{f.icon}</span>
              )}
            </span>
            <span className="text-[10px] font-medium text-foreground flex-1 truncate">{f.label}</span>
            <button
              id={`load-fixture-${f.id}`}
              onClick={() => loadFixture(f.id)}
              disabled={!!loading}
              className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-transparent hover:border-border hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
            >
              {loading === f.id ? "…" : "Load"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
