"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatedNumber, StatusBadge, SourceBadge } from "@/components/ui/badges";

interface Drone {
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

interface DroneListProps {
  selectedDroneId: string | null;
  onSelect: (id: string) => void;
}

export default function DroneList({ selectedDroneId, onSelect }: DroneListProps) {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrones = useCallback(async () => {
    try {
      const res = await fetch("/api/drones");
      const json = await res.json();
      setDrones(json.drones ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrones();
    const interval = setInterval(fetchDrones, 5000);
    return () => clearInterval(interval);
  }, [fetchDrones]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (drones.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <div className="text-4xl mb-3">🛸</div>
        <p className="text-sm">No drones detected yet.</p>
        <p className="text-xs mt-1">Load a fixture to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drones.map((drone) => (
        <button
          key={drone.drone_id}
          id={`drone-btn-${drone.drone_id}`}
          onClick={() => onSelect(drone.drone_id)}
          className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group
            ${selectedDroneId === drone.drone_id
              ? "bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5"
              : "bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15"
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-sm font-semibold text-white">
              {drone.drone_id}
            </span>
            <StatusBadge status={drone.latest_status} />
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {drone.latest_source && <SourceBadge source={drone.latest_source} />}
            <span className="ml-auto">
              <span className="font-semibold text-zinc-300">
                <AnimatedNumber value={drone.event_count} />
              </span>{" "}
              events
            </span>
            {drone.unresolved_count > 0 && (
              <span className="text-amber-400 font-semibold">
                ⚠ <AnimatedNumber value={drone.unresolved_count} />
              </span>
            )}
          </div>

          {drone.latest_lat != null && (
            <div className="mt-2 text-xs text-zinc-500 font-mono">
              {drone.latest_lat.toFixed(4)}, {drone.latest_lon?.toFixed(4)} @ {drone.latest_alt?.toFixed(0)}m
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
