/*
# Create manual overrides schema

1. New Tables
- `manual_overrides` — human-in-the-loop override log
  - id (uuid, pk)
  - drone_id (text)
  - decision_timestamp (timestamptz)
  - selected_source (text)
  - created_at (timestamptz)

2. Security
- RLS enabled
- Full CRUD for anon/authenticated
*/

CREATE TABLE IF NOT EXISTS manual_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id text NOT NULL,
  decision_timestamp timestamptz NOT NULL,
  selected_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE manual_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all manual_overrides"
  ON manual_overrides FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert access for all manual_overrides"
  ON manual_overrides FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Index for quick lookup during the fold
CREATE INDEX IF NOT EXISTS manual_overrides_drone_timestamp_idx ON manual_overrides (drone_id, decision_timestamp);
