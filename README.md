# Real-Time Sensor Fusion Conflict Resolver

A hackathon project that ingests telemetry from multiple drone sensors (GPS, IMU, LiDAR, Video), detects conflicts when sensors disagree, resolves them using a configurable rule engine, and maintains a fully deterministic, event-sourced audit trail.

---

## Setup

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` is used server-side only (API routes) to bypass Row Level Security when the reconciler rewrites derived tables. It is never exposed to the browser.

### 4. Apply the schema

Open the **SQL Editor** in your Supabase dashboard, paste the contents of `supabase/migrations/20260815120151_create_telemetry_schema.sql`, and click **Run**.

This creates four tables:
- `telemetry_events` — append-only, immutable event log
- `drone_state_versions` — derived state, rebuildable
- `conflict_decisions` — audit trail of every resolution decision
- `resolution_rules` — versioned rule configuration (seeded with defaults)

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running Tests

Tests run against your **real Supabase instance** — no mocks, no in-memory DB.

```bash
npx vitest run tests/
```

| Test file | What it covers |
|---|---|
| `expected-outcomes.test.ts` | Pure reducer against all 7 fixture `expectedOutcomes` |
| `fusion-fixtures.test.ts` | Fixture schema validation |
| `ingestion.test.ts` | `POST /api/events` — 200, 400, 409 |
| `idempotency.test.ts` | Re-submitting the same event N times leaves state unchanged |
| `ordering.test.ts` | Late-arriving events fold into correct chronological position |
| `conflict-rules.test.ts` | GPS-vs-LiDAR and low-confidence rules via live API |
| `audit-trail.test.ts` | Decision records trace back to input event IDs |
| `determinism.test.ts` | Replaying fixtures in two different file orders yields byte-identical derived state ✅ |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/events` | Ingest a single telemetry event |
| `POST` | `/api/events/replay` | Batch-replay an array of events |
| `GET` | `/api/drones` | List all drones with latest state |
| `GET` | `/api/drones/[id]` | Full detail: events, state versions, decisions |
| `GET` | `/api/drones/[id]/audit` | Download full audit trail as JSON |
| `GET` | `/api/fixtures/[id]` | Serve a fixture file by ID |

### Ingest a single event

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "drone_id": "drone-alpha",
    "source": "GPS",
    "timestamp": "2026-06-01T10:00:00.000Z",
    "position": { "lat": 37.7749, "lon": -122.4194, "alt": 120.0 },
    "confidence": 0.91
  }'
```

Response includes:
- `event` — the persisted telemetry event row
- `resultingState` — the drone's latest resolved state after fold

### Duplicate detection

The same `(drone_id, source, timestamp)` triple always produces the same `dedupe_key` (SHA-256). A re-submission returns `409 Conflict` with `{ "reason": "duplicate" }`.

---

## Architecture: Event Sourcing

```
POST /api/events
      │
      ▼
telemetry_events          ← append-only, never updated or deleted
      │
      ▼
reconcileDrone()
      │
      ├─ foldEvents()     ← pure function: events → state_versions + decisions
      │       │
      │       ├─ sort by canonical order (timestamp ASC, source ASC, id ASC)
      │       ├─ bucket by timestamp tolerance (500ms default)
      │       └─ resolveBucket() per bucket
      │
      ├─ drone_state_versions   ← truncated and rewritten on every ingest
      └─ conflict_decisions     ← truncated and rewritten on every ingest
```

### Why event sourcing?

- **Determinism**: `foldEvents` is a pure function. Same events → same state, always.
- **Late arrivals**: A GPS reading that arrives 5 minutes late folds into its correct chronological position on the next reconcile — no special case needed.
- **Auditability**: Every position report, every conflict decision, every rule applied is permanently stored. The audit export (`GET /api/drones/[id]/audit`) gives you the full trace.
- **Replayability**: Drop the derived tables and re-run `POST /api/events/replay` with all events to reconstruct identical state.

### Canonical ordering (`compareEventsForFold`)

Events are sorted: `event_timestamp ASC` → `source ASC` → `id ASC`. The third tiebreaker (UUID) is used only when two events have identical timestamps and the same source — which in practice only occurs with genuine duplicates (which are already blocked by the `dedupe_key` UNIQUE constraint).

### Conflict resolution rules (§7)

Rules are evaluated in order. The first matching rule wins:

1. **`low-confidence-unresolved`** — if ALL sources in a bucket have confidence < 0.6 → status `unresolved`
2. **`gps-lidar-confidence`** — if GPS and LiDAR both present: prefer GPS if GPS confidence > 0.8, otherwise prefer LiDAR

If no rule matches → `unresolved` (fail-safe default).

---

## Fixtures

Seven JSON fixtures in `/fixtures/` cover the main edge cases:

| # | Fixture | Tests |
|---|---|---|
| 01 | GPS vs LiDAR conflict (both branches) | `conflict-rules.test.ts` |
| 02 | Duplicate events & corrected retries | `ingestion.test.ts`, `idempotency.test.ts` |
| 03 | LiDAR only — no GPS | `conflict-rules.test.ts` |
| 04 | Late-arriving event folds to correct position | `ordering.test.ts` |
| 05 | Out-of-order replay — identical outcome to fixture 01 | `ordering.test.ts`, `determinism.test.ts` |
| 06 | Both sources below confidence threshold → unresolved | `conflict-rules.test.ts` |
| 07 | State reverts to previous position (legitimate return flight) | `ordering.test.ts` |
