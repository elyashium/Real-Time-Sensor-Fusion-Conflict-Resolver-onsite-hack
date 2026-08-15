"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { useDashboardStore as useStore } from "@/lib/store/dashboard";

interface AlertBannerProps {
  onViewDrone: (id: string) => void;
}

export default function AlertBanner({ onViewDrone }: AlertBannerProps) {
  const drones = useDashboardStore((s) => s.drones);
  const unresolvedDrones = drones.filter((d) => d.unresolved_count > 0);

  if (unresolvedDrones.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5">
      <div className="max-w-screen-xl mx-auto flex items-center gap-3 flex-wrap">
        <span className="text-amber-400 font-semibold text-sm flex items-center gap-1.5">
          <span className="animate-pulse">⚠</span>
          {unresolvedDrones.length} drone{unresolvedDrones.length !== 1 ? "s" : ""} with unresolved conflicts
        </span>
        <div className="flex gap-2 flex-wrap">
          {unresolvedDrones.map((d) => (
            <button
              key={d.drone_id}
              onClick={() => onViewDrone(d.drone_id)}
              className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors font-mono"
            >
              {d.drone_id} ({d.unresolved_count})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
