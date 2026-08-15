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
          <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-zinc-500 text-sm text-center py-6">No state versions yet.</p>;
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/50 via-white/10 to-transparent" />
      <div className="space-y-3">
        {versions.map((v, i) => (
          <div
            key={v.id}
            className={`relative pl-12 pr-4 py-3 rounded-xl border transition-all duration-150
              ${i === 0 ? "bg-white/6 border-white/12" : "bg-white/2 border-white/6"}`}
          >
            {/* Dot */}
            <div
              className={`absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2
                ${v.status === "resolved"
                  ? "bg-emerald-400 border-emerald-400/50"
                  : v.status === "unresolved"
                  ? "bg-amber-400 border-amber-400/50 animate-pulse"
                  : "bg-zinc-500 border-zinc-500/50"
                }`}
            />

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-500">v{v.version}</span>
                <StatusBadge status={v.status} />
                {v.source_of_truth && <SourceBadge source={v.source_of_truth} />}
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {new Date(v.effective_timestamp).toLocaleTimeString()}
              </span>
            </div>

            {v.lat != null && (
              <div className="mt-1.5 text-xs font-mono text-zinc-400">
                <span className="text-zinc-300">{v.lat.toFixed(5)}, {v.lon?.toFixed(5)}</span>
                <span className="text-zinc-600 ml-2">@ {v.alt?.toFixed(0)}m</span>
                <span className="text-zinc-600 ml-2">conf: {v.confidence?.toFixed(2)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
