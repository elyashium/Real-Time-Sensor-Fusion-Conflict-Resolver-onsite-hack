// Shared types for API responses.

/**
 * Shared types for API responses.
 */

export interface DroneSummary {
  drone_id: string;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_alt: number | null;
  latest_confidence: number | null;
  latest_source: string | null;
  latest_status: string;
  latest_timestamp: string | null;
  event_count: number;
  unresolved_count: number;
}

export interface DroneDetail extends DroneSummary {
  state_versions: Array<{
    id: string;
    version: number;
    effective_timestamp: string;
    lat: number | null;
    lon: number | null;
    alt: number | null;
    confidence: number | null;
    source_of_truth: string | null;
    status: string;
    caused_by_event_id: string;
    decision_id: string | null;
  }>;
  events: Array<{
    id: string;
    source: string;
    event_timestamp: string;
    raw_timestamp: string;
    lat: number;
    lon: number;
    alt: number;
    confidence: number;
    is_replay: boolean;
    ingested_at: string;
  }>;
  decisions: Array<{
    id: string;
    decision_timestamp: string;
    input_event_ids: string[];
    rule_applied: string;
    rule_id: string | null;
    output_lat: number | null;
    output_lon: number | null;
    output_alt: number | null;
    output_status: string;
    created_at: string;
  }>;
}
