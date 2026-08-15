import { create } from "zustand";

export interface DroneState {
  drone_id: string;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_alt: number | null;
  latest_confidence: number | null;
  latest_source: string | null;
  latest_status: "resolved" | "unresolved" | "stale";
  latest_timestamp: string | null;
  event_count: number;
  unresolved_count: number;
}

interface DashboardStore {
  // Drone list (from polling)
  drones: DroneState[];
  selectedDroneId: string | null;
  pollingActive: boolean;
  lastFetchedAt: number | null;

  // UI state
  view: "dashboard" | "edit_rules";
  activeTab: "timeline" | "conflicts";
  mapVisible: boolean;

  // Actions
  setDrones: (drones: DroneState[]) => void;
  selectDrone: (id: string | null) => void;
  setPollingActive: (active: boolean) => void;
  setLastFetchedAt: (ts: number) => void;
  setView: (view: "dashboard" | "edit_rules") => void;
  setActiveTab: (tab: "timeline" | "conflicts") => void;
  setMapVisible: (v: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  drones: [],
  selectedDroneId: null,
  pollingActive: true,
  lastFetchedAt: null,
  view: "dashboard",
  activeTab: "timeline",
  mapVisible: true,

  setDrones: (drones) => set({ drones }),
  selectDrone: (id) => set({ selectedDroneId: id }),
  setPollingActive: (active) => set({ pollingActive: active }),
  setLastFetchedAt: (ts) => set({ lastFetchedAt: ts }),
  setView: (view) => set({ view }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setMapVisible: (v) => set({ mapVisible: v }),
}));
