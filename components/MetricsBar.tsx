"use client";

import { useDashboardStore } from "@/lib/store/dashboard";
import { AnimatedNumber } from "@/components/ui/badges";

interface Stat {
  label: string;
  value: number;
  icon: string;
  accent?: string;
}

export default function MetricsBar() {
  const drones = useDashboardStore((s) => s.drones);

  const totalEvents = drones.reduce((sum, d) => sum + d.event_count, 0);
  const activeDrones = drones.length;
  const unresolvedDrones = drones.filter((d) => d.unresolved_count > 0).length;
  const totalUnresolved = drones.reduce((sum, d) => sum + d.unresolved_count, 0);

  const stats: Stat[] = [
    { label: "Total Events", value: totalEvents, icon: "📡" },
    { label: "Active Drones", value: activeDrones, icon: "🛸" },
    { label: "Unresolved Conflicts", value: totalUnresolved, icon: "⚡", accent: totalUnresolved > 0 ? "text-amber-400" : undefined },
    { label: "Conflict Drones", value: unresolvedDrones, icon: "⚠", accent: unresolvedDrones > 0 ? "text-amber-400" : undefined },
  ];

  return (
    <div className="border-b border-white/6 bg-black/20">
      <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-8">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span className="text-base">{s.icon}</span>
            <div>
              <p className={`text-lg font-bold leading-tight ${s.accent ?? "text-white"}`}>
                <AnimatedNumber value={s.value} />
              </p>
              <p className="text-xs text-zinc-500 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          polling 2s
        </div>
      </div>
    </div>
  );
}
