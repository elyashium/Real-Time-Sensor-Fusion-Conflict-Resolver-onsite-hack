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
import { Crosshair, Download, List, Zap, Map as MapIcon, MapOff } from "lucide-react";

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
      // ignore
    }
  }, [setDrones, setLastFetchedAt]);

  useEffect(() => {
    fetchDrones();
    const interval = setInterval(fetchDrones, 2000);
    return () => clearInterval(interval);
  }, [fetchDrones]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="shrink-0 bg-black/30 backdrop-blur-xl border-b border-white/8 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Crosshair size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-white leading-none tracking-tight">
                Sensor Fusion Engine
              </h1>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mt-1">
                Deterministic Conflict Resolution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <RuleEditor />
          </div>
        </div>
      </header>

      <MetricsBar />
      <AlertBanner onViewDrone={(id) => { selectDrone(id); setActiveTab("conflicts"); }} />

      <div className="flex-1 flex overflow-hidden max-w-screen-2xl mx-auto w-full border-x border-white/6">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 border-r border-white/6 flex flex-col bg-black/10 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 border-b border-white/6">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
              Active Fleet
            </h2>
            <DroneList
              selectedDroneId={selectedDroneId}
              onSelect={selectDrone}
            />
          </div>
          <div className="p-4 shrink-0 bg-black/20">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Simulation Data
            </h2>
            <FixtureLoader onLoad={() => fetchDrones()} />
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-black/20">
          {/* Map Section */}
          <div className={`shrink-0 border-b border-white/6 transition-all duration-300 ${mapVisible ? "h-[45%]" : "h-0 border-none overflow-hidden"}`}>
            <DroneMap selectedDroneId={selectedDroneId} onSelectDrone={selectDrone} />
          </div>

          {/* Details Section */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            <div className="flex items-center justify-between mb-6 shrink-0">
              {selectedDroneId ? (
                <div>
                  <h2 className="text-2xl font-serif text-white tracking-tight">{selectedDroneId}</h2>
                  <p className="text-sm font-medium text-zinc-500">Historical state & decisions</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-serif text-zinc-400">Drone Telemetry</h2>
                  <p className="text-sm font-medium text-zinc-600">Select an entity to view history</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMapVisible(!mapVisible)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors flex items-center gap-2"
                >
                  {mapVisible ? <MapOff size={14} /> : <MapIcon size={14} />}
                  {mapVisible ? "Hide Map" : "Show Map"}
                </button>
                {selectedDroneId && (
                  <a
                    href={`/api/drones/${selectedDroneId}/audit`}
                    download
                    className="px-4 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-xs font-semibold text-indigo-300 border border-indigo-500/20 transition-all flex items-center gap-2"
                  >
                    <Download size={14} />
                    Export Audit
                  </a>
                )}
              </div>
            </div>

            {selectedDroneId ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex gap-2 mb-4 shrink-0">
                  <button
                    onClick={() => setActiveTab("timeline")}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2
                      ${activeTab === "timeline"
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      }`}
                  >
                    <List size={14} /> State Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab("conflicts")}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2
                      ${activeTab === "conflicts"
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      }`}
                  >
                    <Zap size={14} /> Conflict Ledger
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {activeTab === "timeline" ? (
                    <DroneTimeline droneId={selectedDroneId} />
                  ) : (
                    <ConflictViewer droneId={selectedDroneId} />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-2xl">
                <Crosshair size={48} className="text-zinc-800 mb-4" />
                <p className="text-sm font-medium text-zinc-500">Awaiting selection</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
