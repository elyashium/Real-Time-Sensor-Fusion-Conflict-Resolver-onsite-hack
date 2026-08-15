"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { AnimatedNumber, StatusBadge, SourceBadge } from "@/components/ui/badges";
import { Crosshair, AlertTriangle } from "lucide-react";

interface DroneListProps {
  selectedDroneId: string | null;
  onSelect: (id: string) => void;
}

export default function DroneList({ selectedDroneId, onSelect }: DroneListProps) {
  const drones = useDashboardStore((s) => s.drones);
  const lastFetchedAt = useDashboardStore((s) => s.lastFetchedAt);

  if (!lastFetchedAt) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  if (drones.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2">
        <Crosshair size={18} className="opacity-40" />
        <p className="text-[10px]">No drones. Load a fixture.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {drones.map((drone) => (
        <button
          key={drone.drone_id}
          id={`drone-btn-${drone.drone_id}`}
          onClick={() => onSelect(drone.drone_id)}
          className={`w-full text-left px-2 py-2 rounded-md transition-colors group
            ${selectedDroneId === drone.drone_id
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
        >
          {/* Row 1: ID + status */}
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[11px] font-semibold truncate">{drone.drone_id}</span>
            <StatusBadge status={drone.latest_status} />
          </div>
          {/* Row 2: source + event count + conflict count */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
            {drone.latest_source && <SourceBadge source={drone.latest_source} />}
            <span className="ml-auto text-muted-foreground">
              <AnimatedNumber value={drone.event_count} /> ev
            </span>
            {drone.unresolved_count > 0 && (
              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                <AlertTriangle size={9} />
                <AnimatedNumber value={drone.unresolved_count} />
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
