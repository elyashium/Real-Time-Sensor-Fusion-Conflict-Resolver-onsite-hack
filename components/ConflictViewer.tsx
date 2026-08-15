"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/posthog";

interface Decision {
  id: string;
  decision_timestamp: string;
  input_event_ids: string[];
  rule_applied: string;
  rule_id: string | null;
  output_lat: number | null;
  output_lon: number | null;
  output_alt: number | null;
  output_status: "resolved" | "unresolved";
  created_at: string;
}

interface ConflictViewerProps {
  droneId: string;
}

export default function ConflictViewer({ droneId }: ConflictViewerProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConflicts() {
      try {
        setLoading(true);
        const res = await fetch(`/api/drones/${droneId}`);
        const data = await res.json();
        const results = (data.decisions ?? []).slice().reverse();
        setDecisions(results);
        trackEvent("conflict_viewed", { drone: droneId, conflictCount: results.length });
      } catch (e) {
        console.error("Failed to fetch conflicts", e);
      } finally {
        setLoading(false);
      }
    }
    fetchConflicts();
  }, [droneId]);

  if (loading) return (
    <div className="space-y-2">
      {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
    </div>
  );

  if (decisions.length === 0) return (
    <p className="text-zinc-500 text-sm text-center py-6">No conflict decisions recorded.</p>
  );

  return (
    <div className="space-y-2">
      {decisions.map((d) => {
        const isConflict = d.output_status === "unresolved";
        const isOpen = expanded === d.id;
        return (
          <div
            key={d.id}
            className={`rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer
              ${isConflict
                ? "border-amber-500/25 bg-amber-500/5"
                : "border-emerald-500/20 bg-emerald-500/4"
              }`}
            onClick={() => setExpanded(isOpen ? null : d.id)}
            id={`conflict-${d.id}`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${isConflict ? "text-amber-400" : "text-emerald-400"}`}>
                  {isConflict ? "⚡" : "✓"}
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  {new Date(d.decision_timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{d.input_event_ids.length} events</span>
                <span className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-2">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Rule Applied</span>
                  <p className="text-sm text-zinc-200 mt-0.5">{d.rule_applied}</p>
                  {d.rule_id && <p className="text-xs text-zinc-500 font-mono">id: {d.rule_id}</p>}
                </div>
                {d.output_lat != null && (
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Output Position</span>
                    <p className="text-xs font-mono text-zinc-300 mt-0.5">
                      {d.output_lat.toFixed(5)}, {d.output_lon?.toFixed(5)} @ {d.output_alt?.toFixed(0)}m
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">Input Event IDs</span>
                  <div className="mt-1 space-y-0.5">
                    {d.input_event_ids.map((id) => (
                      <p key={id} className="text-xs font-mono text-zinc-500 truncate">{id}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
