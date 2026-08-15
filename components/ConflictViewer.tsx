"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import { Zap, Check } from "lucide-react";

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
  const [overriding, setOverriding] = useState<string | null>(null);

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

  useEffect(() => {
    fetchConflicts();
  }, [droneId]);

  async function handleOverride(decision_timestamp: string, selected_source: string) {
    try {
      setOverriding(decision_timestamp);
      await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drone_id: droneId, decision_timestamp, selected_source }),
      });
      // Refresh to show the newly resolved state
      await fetchConflicts();
    } catch (e) {
      console.error("Failed to override", e);
    } finally {
      setOverriding(null);
    }
  }

  if (loading) return (
    <div className="space-y-2">
      {[1, 2].map((i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse border border-border" />)}
    </div>
  );

  if (decisions.length === 0) return (
    <p className="text-muted-foreground text-[11px] text-center py-6">No conflict decisions recorded.</p>
  );

  return (
    <div className="space-y-2">
      {decisions.map((d) => {
        const isConflict = d.output_status === "unresolved";
        const isOpen = expanded === d.id;
        return (
          <div
            key={d.id}
            className={`rounded-md border overflow-hidden transition-all duration-200 cursor-pointer shadow-sm
              ${isConflict
                ? "border-amber-200 bg-amber-50"
                : "border-border bg-card"
              }`}
            onClick={() => setExpanded(isOpen ? null : d.id)}
            id={`conflict-${d.id}`}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {isConflict ? <Zap size={14} className="text-amber-600" /> : <Check size={14} className="text-emerald-600" />}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(d.decision_timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{d.input_event_ids.length} events</span>
                <span className={`text-[10px] text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
            </div>

            {isOpen && (
              <div className="px-3 pb-3 border-t border-border pt-2 space-y-2 bg-secondary/20">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Rule Applied</span>
                  <p className="text-xs text-foreground mt-0.5">{d.rule_applied}</p>
                  {d.rule_id && <p className="text-[10px] text-muted-foreground font-mono">id: {d.rule_id}</p>}
                </div>
                {d.output_lat != null && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Output Position</span>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {d.output_lat.toFixed(5)}, {d.output_lon?.toFixed(5)} @ {d.output_alt?.toFixed(0)}m
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Input Event IDs</span>
                  <div className="mt-1 space-y-0.5">
                    {d.input_event_ids.map((id) => (
                      <p key={id} className="text-[10px] font-mono text-muted-foreground truncate">{id}</p>
                    ))}
                  </div>
                </div>

                {isConflict && (
                  <div className="pt-2 mt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Human-in-the-Loop Override</span>
                    <div className="flex gap-2 mt-1.5">
                      {["GPS", "LiDAR", "IMU", "Video"].map((src) => (
                        <button
                          key={src}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOverride(d.decision_timestamp, src);
                          }}
                          disabled={overriding === d.decision_timestamp}
                          className="text-[10px] px-2 py-1 rounded bg-background border border-border hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                        >
                          Force Trust {src}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
