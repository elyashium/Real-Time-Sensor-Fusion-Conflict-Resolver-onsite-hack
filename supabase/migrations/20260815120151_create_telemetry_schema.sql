/*
# Create drone sensor fusion schema

1. New Tables
- `telemetry_events` — append-only, immutable event log. Every accepted telemetry event lives here permanently (never UPDATEd or DELETEd).
  - id (uuid, pk, server-generated)
  - drone_id (text)
  - source (text: GPS | IMU | LiDAR | Video)
  - event_timestamp (timestamptz, normalized to UTC on ingest)
  - raw_timestamp (text, exactly as received, kept for audit)
  - lat, lon, alt (double precision)
  - confidence (double precision, 0-1)
  - telemetry_data (jsonb, optional passthrough)
  - dedupe_key (text, UNIQUE constraint — sha256 of drone_id|source|normalized_timestamp)
  - is_replay (boolean)
  - ingested_at (timestamptz, server receive time)

- `drone_state_versions` — derived, fully rebuildable. One row per state version per drone, produced by the fold.
  - id (uuid, pk)
  - drone_id (text)
  - version (int, monotonic per drone, starts at 0)
  - effective_timestamp (timestamptz)
  - lat, lon, alt (double precision, resolved position)
  - confidence (double precision, resolved confidence)
  - source_of_truth (text, nullable — null when unresolved)
  - status (text: resolved | unresolved | stale)
  - caused_by_event_id (uuid, fk → telemetry_events)
  - decision_id (uuid, fk → conflict_decisions, nullable)

- `conflict_decisions` — audit trail. One row per conflict-resolution decision.
  - id (uuid, pk)
  - drone_id (text)
  - decision_timestamp (timestamptz, timestamp of events being resolved)
  - input_event_ids (uuid[], the specific events considered)
  - rule_applied (text, plain human-readable English explanation)
  - rule_id (text, fk → resolution_rules)
  - output_lat, output_lon, output_alt (double precision, nullable if unresolved)
  - output_status (text: resolved | unresolved)
  - created_at (timestamptz, wall-clock time the decision was computed)

- `resolution_rules` — versioned config. Enables runtime rule updates.
  - id (uuid, pk)
  - version (int)
  - active (boolean, exactly one row active at a time)
  - rules_json (jsonb, ordered list of rule objects)
  - created_at (timestamptz)

2. Security
- This is a no-auth app (no sign-in screen). All policies use `TO anon, authenticated` so the anon-key frontend can read and write.
- RLS enabled on all tables.
- telemetry_events: allow INSERT (append-only) and SELECT. No UPDATE/DELETE policies — the table is immutable by design.
- drone_state_versions, conflict_decisions: full CRUD (the reconciler truncates and rewrites these).
- resolution_rules: SELECT for reading active rules, INSERT for new versions, UPDATE for activating versions.

3. Seed Data
- One row in resolution_rules: version 1, active true, with the default rule set from the PRD §7.

4. Indexes
- Index on telemetry_events(drone_id) for the fold query.
- Index on drone_state_versions(drone_id, version) for latest-state lookups.
- Index on conflict_decisions(drone_id) for audit queries.
*/

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- telemetry_events: append-only immutable event log
CREATE TABLE IF NOT EXISTS telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('GPS', 'IMU', 'LiDAR', 'Video')),
  event_timestamp timestamptz NOT NULL,
  raw_timestamp text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  alt double precision NOT NULL,
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  telemetry_data jsonb,
  dedupe_key text NOT NULL UNIQUE,
  is_replay boolean NOT NULL DEFAULT false,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_drone_id ON telemetry_events(drone_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_drone_timestamp ON telemetry_events(drone_id, event_timestamp);

ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_telemetry_events" ON telemetry_events;
CREATE POLICY "anon_select_telemetry_events" ON telemetry_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_telemetry_events" ON telemetry_events;
CREATE POLICY "anon_insert_telemetry_events" ON telemetry_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- conflict_decisions: audit trail (derived, safe to truncate/recompute)
CREATE TABLE IF NOT EXISTS conflict_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id text NOT NULL,
  decision_timestamp timestamptz NOT NULL,
  input_event_ids uuid[] NOT NULL,
  rule_applied text NOT NULL,
  rule_id text,
  output_lat double precision,
  output_lon double precision,
  output_alt double precision,
  output_status text NOT NULL CHECK (output_status IN ('resolved', 'unresolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_decisions_drone_id ON conflict_decisions(drone_id);

ALTER TABLE conflict_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conflict_decisions" ON conflict_decisions;
CREATE POLICY "anon_select_conflict_decisions" ON conflict_decisions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conflict_decisions" ON conflict_decisions;
CREATE POLICY "anon_insert_conflict_decisions" ON conflict_decisions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conflict_decisions" ON conflict_decisions;
CREATE POLICY "anon_update_conflict_decisions" ON conflict_decisions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conflict_decisions" ON conflict_decisions;
CREATE POLICY "anon_delete_conflict_decisions" ON conflict_decisions FOR DELETE
  TO anon, authenticated USING (true);

-- drone_state_versions: derived state (safe to truncate/recompute)
CREATE TABLE IF NOT EXISTS drone_state_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id text NOT NULL,
  version int NOT NULL,
  effective_timestamp timestamptz NOT NULL,
  lat double precision,
  lon double precision,
  alt double precision,
  confidence double precision,
  source_of_truth text,
  status text NOT NULL CHECK (status IN ('resolved', 'unresolved', 'stale')),
  caused_by_event_id uuid NOT NULL REFERENCES telemetry_events(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES conflict_decisions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_drone_state_versions_drone_version ON drone_state_versions(drone_id, version DESC);

ALTER TABLE drone_state_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_drone_state_versions" ON drone_state_versions;
CREATE POLICY "anon_select_drone_state_versions" ON drone_state_versions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_drone_state_versions" ON drone_state_versions;
CREATE POLICY "anon_insert_drone_state_versions" ON drone_state_versions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_drone_state_versions" ON drone_state_versions;
CREATE POLICY "anon_update_drone_state_versions" ON drone_state_versions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_drone_state_versions" ON drone_state_versions;
CREATE POLICY "anon_delete_drone_state_versions" ON drone_state_versions FOR DELETE
  TO anon, authenticated USING (true);

-- resolution_rules: versioned config
CREATE TABLE IF NOT EXISTS resolution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL,
  active boolean NOT NULL DEFAULT false,
  rules_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resolution_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_resolution_rules" ON resolution_rules;
CREATE POLICY "anon_select_resolution_rules" ON resolution_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_resolution_rules" ON resolution_rules;
CREATE POLICY "anon_insert_resolution_rules" ON resolution_rules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_resolution_rules" ON resolution_rules;
CREATE POLICY "anon_update_resolution_rules" ON resolution_rules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_resolution_rules" ON resolution_rules;
CREATE POLICY "anon_delete_resolution_rules" ON resolution_rules FOR DELETE
  TO anon, authenticated USING (true);

-- Seed the default resolution rules (version 1, active)
INSERT INTO resolution_rules (version, active, rules_json)
VALUES (
  1,
  true,
  '[
    {
      "id": "low-confidence-unresolved",
      "when": { "allConfidenceBelow": 0.6 },
      "then": { "status": "unresolved" }
    },
    {
      "id": "gps-lidar-confidence",
      "when": { "sources": ["GPS", "LiDAR"] },
      "then": {
        "preferSource": "GPS",
        "if": "GPS.confidence > 0.8",
        "elsePreferSource": "LiDAR"
      }
    }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
