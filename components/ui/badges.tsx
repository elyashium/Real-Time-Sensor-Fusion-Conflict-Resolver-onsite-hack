"use client";

import { useEffect, useRef, useState } from "react";

export type StatusBadgeStatus = "resolved" | "unresolved" | "stale";

const STATUS_CONFIG = {
  resolved: { label: "Resolved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  unresolved: { label: "Conflict", color: "bg-amber-50 text-amber-700 border-amber-200" },
  stale: { label: "Stale", color: "bg-muted text-muted-foreground border-border" },
};

const SOURCE_CONFIG: Record<string, { color: string; label: string }> = {
  GPS: { color: "text-blue-600 bg-blue-50 border-blue-200", label: "GPS" },
  LiDAR: { color: "text-purple-600 bg-purple-50 border-purple-200", label: "LIDAR" },
  IMU: { color: "text-orange-600 bg-orange-50 border-orange-200", label: "IMU" },
  Video: { color: "text-pink-600 bg-pink-50 border-pink-200", label: "VIDEO" },
};

export function StatusBadge({ status }: { status: StatusBadgeStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.stale;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "resolved" ? "bg-emerald-500" : status === "unresolved" ? "bg-amber-500 animate-pulse" : "bg-muted-foreground"}`} />
      {cfg.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? { color: "text-muted-foreground bg-muted border-border", label: source };
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wide ${cfg.color}`}>
      {cfg.label}
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
