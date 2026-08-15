# Real-Time Sensor Fusion Conflict Resolver

## Project Overview
A real-time sensor fusion conflict resolver for autonomous drone operations. This system ingests multi-source sensor data streams (GPS, IMU, LiDAR, Video) from multiple drones, reconstructing a consistent, time-ordered, and conflict-free state. Discrepancies and late-arriving events are resolved via a pure-functional, deterministic logic engine, providing a mathematically rigorous and explainable audit trail for every decision. 

This architecture acts as an immutable event-sourced ledger, natively satisfying all requirements for determinism, idempotency, and replayability.



## Deliverables Checklist

### 1. Repository Contents
- **Backend/Local API**: 
  - `POST /api/events` for real-time ingestion, normalization, and synchronous state derivation.
  - `POST /api/events/replay` for bulk processing and idempotency testing.
- **Frontend Dashboard**: 
  - Built with Next.js, Tailwind CSS, and Zustand. 
  - Displays live drone states, historical timelines, and detailed conflict resolution logs.
- **Telemetry Fixtures**: 
  - Located in `/fixtures/`. 
  - Covers 7 interacting edge cases: basic conflicts, duplicates, missing sensors, late-arriving events, out-of-order replays, unresolved low-confidence states, and legitimate state reversions.
- **Audit Traces**: 
  - Available dynamically via `GET /api/drones/[id]/audit` as a downloadable JSON ledger.

### 2. Test Suite
Automated Vitest integration tests covering all edge cases, running against the actual database logic.
- `ingestion.test.ts` (API constraints and normalization)
- `idempotency.test.ts` (Duplicate event handling)
- `ordering.test.ts` (Late arrivals and temporal sorting)
- `conflict-rules.test.ts` (Rule engine validation)
- `audit-trail.test.ts` (Traceability of inputs to outputs)
- `determinism.test.ts` (Replay ordering verification)

### 3. Documentation
Included below are the strict instructions for setting up, running, testing, and locating outputs.



## Technical Architecture (Event Sourcing)
The system never mutates state in place. It relies on an append-only `telemetry_events` log. Drone states are continuously derived by executing a deterministic canonical sort (Timestamp -> Source -> UUID) followed by a pure functional fold. This guarantees that duplicate data, network latency, and out-of-order deliveries are handled natively by the architecture. 

Duplicate prevention is handled firmly at the database constraint level via a SHA-256 `dedupe_key`.

<img width="2720" height="2160" alt="sensor_fusion_architecture" src="https://github.com/user-attachments/assets/3de9e871-0fc0-403a-922a-f6eed8d7f63e" />




## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- A Supabase Project (PostgreSQL)

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_POSTHOG_KEY=optional_posthog_key
```

### 3. Database Initialization
Run the schema migration found at `supabase/migrations/20260815120151_create_telemetry_schema.sql` inside your Supabase SQL Editor. This initializes:
- `telemetry_events`
- `drone_state_versions`
- `conflict_decisions`
- `resolution_rules`

### 4. Installation
```bash
npm install --legacy-peer-deps
```



## Run Instructions

To start the development server and the C2 Dashboard:
```bash
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

**Using the Dashboard:**
1. In the left sidebar under "Load Fixtures," click "Load All Fixtures" to populate the system.
2. Select a drone from the "Active Fleet" list.
3. Use the tabs to toggle between the chronological "State Timeline" and the "Conflict Ledger" to view plain-English rule explanations.
4. Click "Edit Rules" in the top navigation to dynamically adjust conflict resolution logic (Bonus Scope).



## Test Instructions

The test suite runs against the live database to prove system-wide integrity.
```bash
npx vitest run tests/
```

**Key Acceptance Test (`determinism.test.ts`):** 
This test proves the core system invariant. It replays the entire suite of fixtures in forward alphabetical order, snapshots the database, truncates the derived tables, replays the fixtures in reverse alphabetical order, and asserts deep equality between the final states.



## Output Locations

- **Fixtures**: All JSON test scenarios and expected outcomes are located at `/fixtures/*.json`.
- **Audit Outputs**: The complete mathematical trace and decision logs for any drone can be downloaded via the **"Export Audit"** button on the C2 Dashboard UI, or by directly querying the `GET /api/drones/[id]/audit` endpoint.
