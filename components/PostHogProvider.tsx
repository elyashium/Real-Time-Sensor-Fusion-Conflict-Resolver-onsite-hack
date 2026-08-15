"use client";

import { usePostHogInit } from "@/lib/analytics/posthog";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  usePostHogInit();
  return <>{children}</>;
}
