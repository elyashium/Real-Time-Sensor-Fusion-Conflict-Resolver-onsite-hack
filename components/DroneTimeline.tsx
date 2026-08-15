"use client";

import { useEffect, useState } from "react";
import { StatusBadge, SourceBadge } from "@/components/ui/badges";

interface StateVersion {
  id: string;
  version: number;
  effective_timestamp: string;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  confidence: number | null;
  source_of_truth: string | null;
  status: "resolved" | "unresolved" | "stale";
  caused_by_event_id: string;
  decision_id: string | null;
}

interface DroneTimelineProps {
  droneId: string;
}

export default function DroneTimeline({ droneId }: DroneTimelineProps) {
  const [versions, setVersions] = useState<StateVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/drones/${droneId}`)
      .then((r) => r.json())
      .then((data) => {
        setVersions((data.state_versions ?? []).slice().reverse());
      })
      .finally(() => setLoading(false));
  }, [droneId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-md bg-muted animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-muted-foreground text-[11px] text-center py-6">No state versions yet.</p>;
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[13px] top-0 bottom-0 w-px bg-border" />
      <div className="space-y-2 relative">
        {versions.map((v, i) => (
          <div
            key={v.id}
            className={`relative pl-8 pr-3 py-2 rounded-md border transition-colors
              ${i === 0 ? "bg-card border-border shadow-sm z-10" : "bg-secondary/30 border-transparent hover:bg-secondary/80"}`}
          >
            {/* Dot */}
            <div
              className={`absolute left-[9px] top-[14px] w-[9px] h-[9px] rounded-full border bg-background z-20
                ${v.status === "resolved"
                  ? "border-emerald-500"
                  : v.status === "unresolved"
                  ? "border-amber-500 bg-amber-100"
                  : "border-muted-foreground"
                }`}
            />

            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground">v{v.version}</span>
                <StatusBadge status={v.status} />
                {v.source_of_truth && <SourceBadge source={v.source_of_truth} />}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {new Date(v.effective_timestamp).toLocaleTimeString()}
              </span>
            </div>

            {v.lat != null && (
              <div className="mt-1 text-[10px] font-mono text-muted-foreground/80">
                <span className="text-foreground">{v.lat.toFixed(5)}, {v.lon?.toFixed(5)}</span>
                <span className="ml-1.5">@ {v.alt?.toFixed(0)}m</span>
                <span className="ml-1.5">conf: {v.confidence?.toFixed(2)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
