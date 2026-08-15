/**
 * Validation schema for POST /api/events.
 * See implementation.md §3 (Event ingestion).
 *
 * Kept deliberately dumb: this file's only job is "is the payload shaped
 * correctly and within-range", not business logic. Duplicate detection,
 * conflict detection, and resolution all live downstream in lib/fusion/*.
 */
import { z } from "zod";

export const TelemetrySourceSchema = z.enum(["GPS", "IMU", "LiDAR", "Video"]);
export type TelemetrySource = z.infer<typeof TelemetrySourceSchema>;

export const PositionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  alt: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

const IsoTimestampSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: "timestamp must be a valid ISO 8601 date-time string" }
);

export const TelemetryEventInputSchema = z.object({
  drone_id: z.string().min(1, "drone_id is required"),
  timestamp: IsoTimestampSchema,
  source: TelemetrySourceSchema,
  position: PositionSchema,
  confidence: z.number().min(0).max(1),
  telemetry_data: z.record(z.string(), z.unknown()).optional(),
  replay: z.boolean().optional().default(false),
});
export type TelemetryEventInput = z.infer<typeof TelemetryEventInputSchema>;

export const ReplayRequestSchema = z.object({
  events: z.array(TelemetryEventInputSchema).min(1),
});
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;

export function parseTelemetryEvent(body: unknown) {
  const result = TelemetryEventInputSchema.safeParse(body);
  if (!result.success) {
    return {
      ok: false as const,
      status: 400 as const,
      errors: result.error.flatten().fieldErrors,
    };
  }
  return { ok: true as const, data: result.data };
}
