"use client";

import { useEffect, useCallback, useState } from "react";
import { useDashboardStore } from "@/lib/store/dashboard";
import DroneList from "@/components/DroneList";
import DroneTimeline from "@/components/DroneTimeline";
import ConflictViewer from "@/components/ConflictViewer";
import FixtureLoader from "@/components/FixtureLoader";
import AlertBanner from "@/components/AlertBanner";
import RuleEditor from "@/components/RuleEditor";
import DroneMap from "@/components/DroneMap";
import { AnimatedNumber } from "@/components/ui/badges";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Crosshair, Download, List, Zap, Settings, X,
  Radio, AlertTriangle, ChevronDown, ChevronUp, Info, GripVertical
} from "lucide-react";

// ── Tutorial overlay ──────────────────────────────────────────────────────────
function Tutorial({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-foreground/30 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-lg w-full p-6 relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss tutorial"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Crosshair size={16} className="text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Getting Started</h2>
        </div>

        <div className="space-y-4 text-[11px] text-muted-foreground leading-relaxed">
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-border rounded-md p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Left — Fleet</div>
              <p>Lists every active drone. Click any entry to select it and load its telemetry history.</p>
            </div>
            <div className="border border-border rounded-md p-3 space-y-1 bg-secondary/30">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Center — Map</div>
              <p>Live spatial view. Markers reflect resolution status. Click markers to select. Amber rings = unresolved conflict zones.</p>
            </div>
            <div className="border border-border rounded-md p-3 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Right — Telemetry</div>
              <p>Shows the selected drone's state timeline and conflict decisions with full audit trail.</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="font-medium text-foreground text-[10px] uppercase tracking-wider">Quick Start</div>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Expand <strong className="text-foreground">Simulation Data</strong> in the left panel and click a fixture to load it.</li>
              <li>Drones appear on the map and in the fleet list immediately.</li>
              <li>Select a drone to inspect its resolved state history and conflict ledger.</li>
              <li>Click <strong className="text-foreground">Edit Rules</strong> in the top bar to adjust the conflict resolution ruleset.</li>
            </ol>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="mt-5 w-full py-2 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-md transition-colors"
        >
          Got it — open the dashboard
        </button>
      </div>
    </div>
  );
}

// ── Inline metrics strip (no separate component needed) ───────────────────────
function MetricsStrip() {
  const drones = useDashboardStore((s) => s.drones);
  const totalEvents = drones.reduce((sum, d) => sum + d.event_count, 0);
  const totalUnresolved = drones.reduce((sum, d) => sum + d.unresolved_count, 0);

  return (
    <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
      <span className="flex items-center gap-1">
        <Radio size={10} />
        <AnimatedNumber value={drones.length} /> drones
      </span>
      <span className="flex items-center gap-1">
        <Crosshair size={10} />
        <AnimatedNumber value={totalEvents} /> events
      </span>
      {totalUnresolved > 0 && (
        <span className="flex items-center gap-1 text-amber-600 font-semibold">
          <AlertTriangle size={10} />
          <AnimatedNumber value={totalUnresolved} /> conflicts
        </span>
      )}
      <span className="flex items-center gap-1 ml-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        live
      </span>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const {
    selectedDroneId,
    selectDrone,
    setDrones,
    setLastFetchedAt,
    activeTab,
    setActiveTab,
    view,
    setView,
  } = useDashboardStore();

  const [showTutorial, setShowTutorial] = useState(false);
  const [fixtureOpen, setFixtureOpen] = useState(false);

  // Show tutorial on first visit
  useEffect(() => {
    const seen = localStorage.getItem("sfcr_tutorial_seen");
    if (!seen) setShowTutorial(true);
  }, []);

  const dismissTutorial = () => {
    localStorage.setItem("sfcr_tutorial_seen", "1");
    setShowTutorial(false);
  };

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

  // ── Edit Rules full-screen view ──────────────────────────────────────────
  if (view === "edit_rules") {
    return (
      <div className="flex flex-col h-full w-full bg-background text-foreground">
        <RuleEditor />
      </div>
    );
  }

  // ── Main 3-column dashboard ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden">
      {showTutorial && <Tutorial onDismiss={dismissTutorial} />}

      {/* ── Top bar: app identity + metrics + actions ── */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 border-b border-border bg-card">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Crosshair size={14} className="text-foreground" />
          <span className="text-xs font-semibold text-foreground tracking-tight">Sensor Fusion</span>
          <span className="hidden sm:inline text-[10px] text-muted-foreground uppercase tracking-widest">/ Conflict Resolver</span>
        </div>

        <div className="w-px h-4 bg-border shrink-0" />

        {/* Inline metrics */}
        <MetricsStrip />

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowTutorial(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Show tutorial"
            title="Show tutorial"
          >
            <Info size={14} />
          </button>
          <button
            onClick={() => setView("edit_rules")}
            className="px-2.5 py-1.5 text-[11px] font-semibold rounded-md border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors flex items-center gap-1.5"
          >
            <Settings size={12} /> Edit Rules
          </button>
        </div>
      </div>

      {/* ── Alert banner ── */}
      <AlertBanner onViewDrone={(id) => { selectDrone(id); setActiveTab("conflicts"); }} />

      {/* ── Resizable 3-column layout ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* Mobile stacked (non-resizable) — show simple columns on small screens */}
        <div className="hidden lg:flex w-full h-full">
          <PanelGroup direction="horizontal" autoSaveId="sfcr-layout">

            {/* ── LEFT panel ── */}
            <Panel defaultSize={18} minSize={12} maxSize={30} className="flex flex-col border-r border-border bg-card overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-3">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Active Fleet
                </div>
                <DroneList selectedDroneId={selectedDroneId} onSelect={selectDrone} />
              </div>
              <div className="shrink-0 border-t border-border">
                <button
                  onClick={() => setFixtureOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                >
                  <span>Simulation Data</span>
                  {fixtureOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {fixtureOpen && (
                  <div className="px-3 pb-3 bg-secondary/20 overflow-y-auto max-h-[200px]">
                    <FixtureLoader onLoad={() => fetchDrones()} />
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 hover:w-1.5 transition-all bg-border hover:bg-foreground/20 flex items-center justify-center cursor-col-resize group">
              <GripVertical size={10} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </PanelResizeHandle>

            {/* ── CENTER: Map ── */}
            <Panel defaultSize={62} minSize={40} className="flex flex-col overflow-hidden bg-secondary/10">
              <DroneMap selectedDroneId={selectedDroneId} onSelectDrone={(id) => { selectDrone(id); }} />
            </Panel>

            <PanelResizeHandle className="w-1 hover:w-1.5 transition-all bg-border hover:bg-foreground/20 flex items-center justify-center cursor-col-resize group">
              <GripVertical size={10} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </PanelResizeHandle>

            {/* ── RIGHT: Telemetry detail panel ── */}
            <Panel defaultSize={20} minSize={14} maxSize={35} className="flex flex-col border-l border-border bg-card overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
                {selectedDroneId ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Crosshair size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono font-semibold text-foreground truncate">{selectedDroneId}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-medium">Select a drone</span>
                )}
                {selectedDroneId && (
                  <a
                    href={`/api/drones/${selectedDroneId}/audit`}
                    download
                    title="Export audit trail"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Download size={12} />
                  </a>
                )}
              </div>
              {selectedDroneId && (
                <div className="shrink-0 flex border-b border-border">
                  <button
                    onClick={() => setActiveTab("timeline")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                      activeTab === "timeline"
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <List size={11} /> Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab("conflicts")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                      activeTab === "conflicts"
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap size={11} /> Conflicts
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto min-h-0 p-3">
                {selectedDroneId ? (
                  activeTab === "timeline" ? (
                    <DroneTimeline droneId={selectedDroneId} />
                  ) : (
                    <ConflictViewer droneId={selectedDroneId} />
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
                    <Crosshair size={20} className="text-muted-foreground opacity-40" />
                    <p className="text-[10px] text-muted-foreground">
                      Select a drone from the fleet<br />or click a marker on the map
                    </p>
                  </div>
                )}
              </div>
            </Panel>

          </PanelGroup>
        </div>

        {/* Mobile fallback — simple stack */}
        <div className="lg:hidden flex flex-col w-full h-full">
          <aside className="w-full flex flex-col border-b border-border bg-card max-h-[40vh] overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-0 p-3">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Active Fleet</div>
              <DroneList selectedDroneId={selectedDroneId} onSelect={selectDrone} />
            </div>
            <div className="shrink-0 border-t border-border">
              <button onClick={() => setFixtureOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                <span>Simulation Data</span>
                {fixtureOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {fixtureOpen && <div className="px-3 pb-3 bg-secondary/20 overflow-y-auto max-h-[200px]"><FixtureLoader onLoad={() => fetchDrones()} /></div>}
            </div>
          </aside>
          <main className="flex-1 overflow-hidden min-h-[40vh]">
            <DroneMap selectedDroneId={selectedDroneId} onSelectDrone={(id) => { selectDrone(id); }} />
          </main>
          <aside className="w-full flex flex-col border-t border-border bg-card max-h-[45vh] overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
              {selectedDroneId ? <span className="text-xs font-mono font-semibold text-foreground truncate">{selectedDroneId}</span> : <span className="text-[10px] text-muted-foreground font-medium">Select a drone</span>}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-3">
              {selectedDroneId ? (activeTab === "timeline" ? <DroneTimeline droneId={selectedDroneId} /> : <ConflictViewer droneId={selectedDroneId} />) : null}
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}
