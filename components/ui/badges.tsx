"use client";

import { useEffect, useRef, useState } from "react";

export type StatusBadgeStatus = "resolved" | "unresolved" | "stale";

const STATUS_CONFIG = {
  resolved: { label: "Resolved", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  unresolved: { label: "Conflict", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  stale: { label: "Stale", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const SOURCE_CONFIG: Record<string, { color: string; icon: string }> = {
  GPS: { color: "text-blue-400", icon: "📡" },
  LiDAR: { color: "text-purple-400", icon: "🔴" },
  IMU: { color: "text-orange-400", icon: "🧭" },
  Video: { color: "text-pink-400", icon: "📷" },
};

export function StatusBadge({ status }: { status: StatusBadgeStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.stale;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "resolved" ? "bg-emerald-400" : status === "unresolved" ? "bg-amber-400 animate-pulse" : "bg-zinc-500"}`} />
      {cfg.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? { color: "text-zinc-400", icon: "?" };
  return (
    <span className={`text-xs font-mono font-semibold ${cfg.color}`}>
      {cfg.icon} {source}
    </span>
  );
}

// Animated counter
export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    const start = prevRef.current;
    const end = value;
    const duration = 400;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prevRef.current = value;
  }, [value]);

  return <>{display}</>;
}
