"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { useDashboardStore as useStore } from "@/lib/store/dashboard";
import { AlertTriangle } from "lucide-react";

interface AlertBannerProps {
  onViewDrone: (id: string) => void;
}

export default function AlertBanner({ onViewDrone }: AlertBannerProps) {
  const drones = useDashboardStore((s) => s.drones);
  const unresolvedDrones = drones.filter((d) => d.unresolved_count > 0);

  if (unresolvedDrones.length === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-3 flex-wrap">
        <span className="text-amber-800 font-semibold text-xs flex items-center gap-1.5">
          <AlertTriangle size={14} className="animate-pulse" />
          {unresolvedDrones.length} drone{unresolvedDrones.length !== 1 ? "s" : ""} with unresolved conflicts
        </span>
        <div className="flex gap-2 flex-wrap">
          {unresolvedDrones.map((d) => (
            <button
              key={d.drone_id}
              onClick={() => onViewDrone(d.drone_id)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition-colors font-mono"
            >
              {d.drone_id} ({d.unresolved_count})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
