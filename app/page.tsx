"use client";

import { useEffect, useCallback, useState } from "react";
import { useDashboardStore } from "@/lib/store/dashboard";
import DroneList from "@/components/DroneList";
import DroneTimeline from "@/components/DroneTimeline";
import ConflictViewer from "@/components/ConflictViewer";
import FixtureLoader from "@/components/FixtureLoader";
import MetricsBar from "@/components/MetricsBar";
import AlertBanner from "@/components/AlertBanner";
import RuleEditor from "@/components/RuleEditor";
import DroneMap from "@/components/DroneMap";

type Tab = "timeline" | "conflicts";

export default function Dashboard() {
  const {
    selectedDroneId,
    selectDrone,
    setDrones,
    setLastFetchedAt,
    activeTab,
    setActiveTab,
    mapVisible,
    setMapVisible,
  } = useDashboardStore();

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

  // Poll every 2 seconds
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
      <header className="bg-black/30 backdrop-blur-xl sticky top-0 z-50">
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
          <div className="flex items-center gap-4">
            <RuleEditor />
          </div>
        </div>
      </header>

      {/* Metrics Bar */}
      <MetricsBar />

      {/* Alert Banner */}
      <AlertBanner onViewDrone={(id) => { selectDrone(id); setActiveTab("conflicts"); }} />

      <div className="flex-1 flex overflow-hidden max-w-screen-xl mx-auto w-full border-x border-white/6">
        {/* Left sidebar — Drones + Fixtures */}
        <aside className="w-80 shrink-0 border-r border-white/6 overflow-y-auto flex flex-col bg-black/10">
          <div className="p-4 border-b border-white/6">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Active Drones
            </h2>
            <DroneList
              selectedDroneId={selectedDroneId}
              onSelect={selectDrone}
            />
          </div>

          <div className="p-4 mt-auto border-t border-white/6">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Load Fixtures
            </h2>
            <FixtureLoader onLoad={handleFixtureLoad} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main Map View (Always rendered so it doesn't lose state, toggled via CSS/z-index or layout) */}
          <div className={`w-full p-4 shrink-0 transition-all duration-300 ${mapVisible ? "h-[45%]" : "h-0 overflow-hidden py-0 border-none"}`}>
            <DroneMap selectedDroneId={selectedDroneId} onSelectDrone={selectDrone} />
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-black/20">
            <div className="flex items-center justify-between mb-6">
              {selectedDroneId ? (
                <div>
                  <h2 className="text-xl font-bold font-mono text-white">{selectedDroneId}</h2>
                  <p className="text-sm text-zinc-500 mt-0.5">Telemetry history & conflict decisions</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold text-zinc-400">Drone Details</h2>
                  <p className="text-sm text-zinc-600 mt-0.5">Select a drone to view timeline</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMapVisible(!mapVisible)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors"
                >
                  {mapVisible ? "Hide Map" : "Show Map"}
                </button>
                {selectedDroneId && (
                  <a
                    href={`/api/drones/${selectedDroneId}/audit`}
                    download
                    id={`download-audit-${selectedDroneId}`}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 border border-indigo-500/20 transition-all duration-150 flex items-center gap-2"
                  >
                    ↓ Export Audit
                  </a>
                )}
              </div>
            </div>

            {selectedDroneId ? (
              <>
                <div className="flex gap-1 mb-6 bg-white/4 rounded-xl p-1 w-fit">
                  <button
                    onClick={() => setActiveTab("timeline")}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 capitalize
                      ${activeTab === "timeline"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                        : "text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    📋 State Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab("conflicts")}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 capitalize
                      ${activeTab === "conflicts"
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                        : "text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    ⚡ Conflicts
                  </button>
                </div>

                {activeTab === "timeline" ? (
                  <DroneTimeline droneId={selectedDroneId} />
                ) : (
                  <ConflictViewer droneId={selectedDroneId} />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center border-2 border-dashed border-white/5 rounded-2xl">
                <div className="text-4xl mb-3 opacity-30">🛸</div>
                <p className="text-sm text-zinc-500">No drone selected</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
