# Real-Time Sensor Fusion Conflict Resolver

## Project Overview
A real-time sensor fusion conflict resolver for autonomous drone operations. This system ingests multi-source sensor data streams (GPS, IMU, LiDAR, Video) from multiple drones, reconstructing a consistent, time-ordered, and conflict-free state. Discrepancies and late-arriving events are resolved via a pure-functional, deterministic logic engine, providing a mathematically rigorous and explainable audit trail for every decision. 

This architecture acts as an immutable event-sourced ledger, natively satisfying all requirements for determinism, idempotency, and replayability.



<img width="2720" height="2160" alt="sensor_fusion_architecture" src="https://github.com/user-attachments/assets/1f0f6768-f01f-4067-b02d-14e11f81198f" />

<img width="525" height="583" alt="image" src="https://github.com/user-attachments/assets/2412c752-c7fc-4dcc-8d70-f1d226e5df49" />


telementary events 
<img width="1620" height="706" alt="image" src="https://github.com/user-attachments/assets/5cd588a7-7780-4dc8-b4ba-ff5092663b53" />

drone state versions
<img width="1637" height="706" alt="image" src="https://github.com/user-attachments/assets/73b1f830-c6d8-42b3-be17-c7b86b8d99bc" />

conflict detection 
<img width="1626" height="689" alt="image" src="https://github.com/user-attachments/assets/8a737df9-d909-4bc1-a2f3-f0bceafdf591" />





##  Codebase Architecture

The application is built on a modern, serverless stack designed for high-throughput event ingestion and strict data consistency.

### 1. Database Layer (Supabase / PostgreSQL)
The core of the system is a strict, normalized PostgreSQL schema designed for Event Sourcing:
- `telemetry_events`: An append-only, immutable ledger of every raw sensor reading. A `dedupe_key` (SHA256 hash) strictly enforces idempotency at the database level.
- `drone_state_versions`: A materialized view of the derived drone states (lat, lon, alt, confidence, and source of truth).
- `conflict_decisions`: An audit trail that logs exactly *why* a specific sensor was chosen as the source of truth, referencing the exact rule applied.
- `resolution_rules`: A version-controlled JSON ruleset that determines conflict resolution logic.

### 2. API & Logic Engine (Next.js App Router)
The backend logic lives in serverless Next.js API routes (`/app/api/`):
- **Ingestion (`/api/events`)**: Receives raw telemetry. It handles schema validation, idempotency checks, and triggers the reconciliation engine.
- **Reconciliation Engine (`lib/fusion/`)**: A pure-functional engine that performs a deterministic "fold" over the raw events. It sorts events by effective timestamp, detects conflicts, applies the dynamic ruleset to pick a winner, and writes the decision back to the database.

### 3. Frontend Dashboard (React + Zustand)
A real-time, responsive C2 (Command & Control) dashboard:
- **Global State (`lib/store/dashboard.ts`)**: Uses Zustand to manage UI state and poll the API for live drone updates.
- **Map View (`components/DroneMap.tsx`)**: Renders drones using Leaflet. Displays unresolved drones with amber conflict rings, utilizing a fallback mechanism to render drones that have *never* had a valid resolved position.
- **Telemetry & Audit (`components/ConflictViewer.tsx`, `components/DroneTimeline.tsx`)**: Displays the chronological state history and the conflict ledger for explainable AI/decision-making.

---

##  Understanding the Drone Data (Simulation Fixtures)

For hackathon judges: because we don't have live autonomous drones flying around during the demo, the system is powered by **Simulation Fixtures**. These are highly specific JSON payloads designed to stress-test the conflict resolution engine. 

You can load these into the system via the **"Simulation Data"** drawer in the bottom left of the Dashboard.

### The 7 Edge-Case Scenarios:
1. **Basic Conflict**: GPS and LiDAR report different positions at the exact same millisecond. The engine applies the ruleset to pick the sensor with higher confidence.
2. **Duplicate Events**: Simulates a network retry where the exact same telemetry event is fired twice. The system's idempotency guarantees catch this and prevent duplicate state processing.
3. **Missing Sensor**: Simulates a drone operating in a GPS-denied environment (e.g., indoors). Only LiDAR is available.
4. **Late-Arriving Events (Out of Order)**: Simulates severe network latency. Event A (t=1) arrives *after* Event B (t=2). The engine deterministically reconstructs the timeline, proving that the final state is identical regardless of network delivery order.
5. **Unresolved / Low Confidence**: Simulates a scenario where *all* sensors report confidence scores below the minimum threshold. The engine refuses to pick a winner, marking the drone as **Unresolved** (Amber) and highlighting it on the map for human intervention.
6. **State Reversion**: A legitimate scenario where a drone physically returns to a previous coordinate.
7. **Rule Updates**: Proves that changing the rules via the **Edit Rules** UI dynamically alters how future conflicts are resolved without breaking past audit logs.

---

## Deliverables Checklist

### 1. Repository Contents
- **Backend/Local API**: 
  - `POST /api/events` for real-time ingestion, normalization, and synchronous state derivation.
  - `POST /api/events/replay` for bulk processing and idempotency testing.
- **Frontend Dashboard**: 
  - Displays live drone states, historical timelines, and detailed conflict resolution logs.
- **Telemetry Fixtures**: 
  - Located in `/fixtures/`. 
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

---

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
Run the schema migration found at `supabase/migrations/20260815120151_create_telemetry_schema.sql` inside your Supabase SQL Editor. This initializes the schema and default resolution rules.

### 4. Installation
```bash
npm install --legacy-peer-deps
```

---

## Run Instructions

To start the development server and the C2 Dashboard:
```bash
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

**Using the Dashboard:**
1. In the left sidebar, expand **"Simulation Data"** and click **"Load All"** to populate the system with the test fixtures.
2. Select a drone from the "Active Fleet" list or click a marker on the Map.
3. Use the right-hand panel tabs to toggle between the chronological **"State Timeline"** and the **"Conflict Ledger"** to view plain-English rule explanations.
4. Click **"Edit Rules"** in the top navigation to dynamically adjust conflict resolution logic (Bonus Scope).

---

## Test Instructions

The test suite runs against the live database to prove system-wide integrity.
```bash
npx vitest run tests/
```

**Key Acceptance Test (`determinism.test.ts`):** 
This test proves the core system invariant. It replays the entire suite of fixtures in forward alphabetical order, snapshots the database, truncates the derived tables, replays the fixtures in reverse alphabetical order, and asserts deep equality between the final states.

---

## Output Locations

- **Fixtures**: All JSON test scenarios and expected outcomes are located at `/fixtures/*.json`.
- **Audit Outputs**: The complete mathematical trace and decision logs for any drone can be downloaded via the **"Export Audit"** button (Download icon) on the C2 Dashboard UI, or by directly querying the `GET /api/drones/[id]/audit` endpoint.
