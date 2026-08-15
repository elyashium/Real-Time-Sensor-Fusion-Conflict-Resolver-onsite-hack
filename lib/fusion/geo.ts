/**
 * Geo distance helper for conflict detection (implementation.md §5).
 * Two events "conflict" when they're close in time but far apart in
 * space — this file answers "how far apart in space".
 */
export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

export function altitudeDeltaMeters(altA: number, altB: number): number {
  return Math.abs(altA - altB);
}

export const DEFAULT_HORIZONTAL_CONFLICT_THRESHOLD_METERS = 5;
export const DEFAULT_ALTITUDE_CONFLICT_THRESHOLD_METERS = 3;
export const DEFAULT_TIME_TOLERANCE_MS = 1000;

export function positionsConflict(
  a: { lat: number; lon: number; alt: number },
  b: { lat: number; lon: number; alt: number },
  opts: {
    horizontalThresholdMeters?: number;
    altitudeThresholdMeters?: number;
  } = {}
): boolean {
  const horizontalThreshold =
    opts.horizontalThresholdMeters ?? DEFAULT_HORIZONTAL_CONFLICT_THRESHOLD_METERS;
  const altitudeThreshold =
    opts.altitudeThresholdMeters ?? DEFAULT_ALTITUDE_CONFLICT_THRESHOLD_METERS;
  const horizontalDelta = haversineDistanceMeters(a, b);
  const verticalDelta = altitudeDeltaMeters(a.alt, b.alt);
  return horizontalDelta > horizontalThreshold || verticalDelta > altitudeThreshold;
}
