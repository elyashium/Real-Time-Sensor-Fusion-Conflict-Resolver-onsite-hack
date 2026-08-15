"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { AnimatedNumber } from "@/components/ui/badges";
import { Radio, Crosshair, Zap, AlertTriangle } from "lucide-react";
import { ReactNode } from "react";

interface Stat {
  label: string;
  value: number;
  icon: ReactNode;
  accent?: string;
}

export default function MetricsBar() {
  const drones = useDashboardStore((s) => s.drones);

  const totalEvents = drones.reduce((sum, d) => sum + d.event_count, 0);
  const activeDrones = drones.length;
  const unresolvedDrones = drones.filter((d) => d.unresolved_count > 0).length;
  const totalUnresolved = drones.reduce((sum, d) => sum + d.unresolved_count, 0);

  const stats: Stat[] = [
    { label: "Total Events", value: totalEvents, icon: <Radio size={14} className="text-muted-foreground" /> },
    { label: "Active Drones", value: activeDrones, icon: <Crosshair size={14} className="text-muted-foreground" /> },
    { label: "Unresolved Conflicts", value: totalUnresolved, icon: <Zap size={14} />, accent: totalUnresolved > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground" },
    { label: "Conflict Drones", value: unresolvedDrones, icon: <AlertTriangle size={14} />, accent: unresolvedDrones > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground" },
  ];

  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-screen-2xl mx-auto px-6 py-2 flex items-center gap-6 overflow-x-auto custom-scrollbar">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2 shrink-0">
            <span className={s.accent ?? "text-muted-foreground"}>{s.icon}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
              <span className={`text-sm font-semibold leading-none ${s.accent ?? "text-foreground"}`}>
                <AnimatedNumber value={s.value} />
              </span>
            </div>
          </div>
        ))}
        <div className="ml-auto shrink-0 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
          polling 2s
        </div>
      </div>
    </div>
  );
}
