"use client";

import { useEffect, useCallback } from "react";
import { useDashboardStore } from "@/lib/store/dashboard";
import DroneList from "@/components/DroneList";
import DroneTimeline from "@/components/DroneTimeline";
import ConflictViewer from "@/components/ConflictViewer";
import FixtureLoader from "@/components/FixtureLoader";

type Tab = "timeline" | "conflicts";
import { useState } from "react";

export default function Dashboard() {
  const { selectedDroneId, selectDrone, setDrones, setLastFetchedAt } = useDashboardStore();
  const [tab, setTab] = useState<Tab>("timeline");

  const fetchDrones = useCallback(async () => {
    try {
      const res = await fetch("/api/drones");
      const json = await res.json();
      setDrones(json.drones ?? []);
      setLastFetchedAt(Date.now());
    } catch {
      // ignore transient errors
    }
  }, [setDrones, setLastFetchedAt]);

  // Poll every 2 seconds as per spec §9
  useEffect(() => {
    fetchDrones();
    const interval = setInterval(fetchDrones, 2000);
    return () => clearInterval(interval);
  }, [fetchDrones]);

  const handleFixtureLoad = useCallback(() => {
    fetchDrones();
  }, [fetchDrones]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 bg-black/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-lg">
              🛸
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                Sensor Fusion Conflict Resolver
              </h1>
              <p className="text-xs text-zinc-500">Real-Time Drone Telemetry Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-400">Live · polling 2s</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-screen-xl mx-auto w-full">
        {/* Left sidebar — Drones + Fixtures */}
        <aside className="w-72 shrink-0 border-r border-white/8 overflow-y-auto flex flex-col">
          {/* Drone List */}
          <div className="p-4 border-b border-white/6">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Active Drones
            </h2>
            <DroneList
              selectedDroneId={selectedDroneId}
              onSelect={selectDrone}
            />
          </div>

          {/* Fixture Loader */}
          <div className="p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Load Fixtures
            </h2>
            <FixtureLoader onLoad={handleFixtureLoad} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {selectedDroneId ? (
            <div className="p-6">
              {/* Drone header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold font-mono text-white">{selectedDroneId}</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">Telemetry history & conflict decisions</p>
                </div>
                <a
                  href={`/api/drones/${selectedDroneId}/audit`}
                  download
                  id={`download-audit-${selectedDroneId}`}
                  className="px-4 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition-all duration-150 flex items-center gap-2"
                >
                  ↓ Export Audit
                </a>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-white/4 rounded-xl p-1 w-fit">
                {(["timeline", "conflicts"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    id={`tab-${t}`}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 capitalize
                      ${tab === t
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                        : "text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    {t === "timeline" ? "📋 State Timeline" : "⚡ Conflicts"}
                  </button>
                ))}
              </div>

              {tab === "timeline" ? (
                <DroneTimeline droneId={selectedDroneId} />
              ) : (
                <ConflictViewer droneId={selectedDroneId} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="text-6xl mb-4 opacity-30">🛸</div>
              <h3 className="text-lg font-semibold text-zinc-400 mb-2">No drone selected</h3>
              <p className="text-sm text-zinc-600 max-w-xs">
                Select a drone from the left panel, or load a fixture to populate the system with telemetry events.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
