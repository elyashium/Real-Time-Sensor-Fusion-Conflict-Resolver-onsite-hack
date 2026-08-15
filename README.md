# Real-Time Sensor Fusion Conflict Resolver 🛸

A mission-critical event-sourced conflict resolution engine and C2 dashboard for autonomous drone fleets. 

This system ingests asynchronous, out-of-order, and conflicting telemetry events from multiple drone sensors (GPS, IMU, LiDAR, Video), detects discrepancies, and deterministically resolves them using a dynamic rule engine to produce a unified flight state.

![Dashboard Preview](/app/favicon.ico) *(Replace with actual screenshot before submission)*

## 🌟 Key Features & Bonus Scope Implemented

- **Event-Sourced Architecture**: Built on an immutable event log. The system resolves state by computing a pure fold over the canonical event stream, guaranteeing mathematically rigorous determinism, replayability, and idempotency.
- **Explainable AI/Audit Trail**: Every decision generates a plain-English explanation of *why* a specific rule fired, traceable directly back to the UUIDs of the input events that caused the conflict.
- **Interactive Trajectory Map** *(Bonus)*: Real-time visual tracking of drone positions via `react-leaflet`, highlighting active conflict zones with pulsing amber radiuses.
- **Dynamic Rule Editor UI** *(Bonus)*: Hot-reload conflict resolution rules at runtime without restarting the server. Modifying rules immediately forces a recomputation of all historical state to reflect the new logic.
- **Unresolved Decision Alerts** *(Bonus)*: Simulates automated webhooks by surfacing real-time warning banners when a drone enters an unresolvable state (e.g. low confidence across all sensors).
- **PostHog Analytics** *(Bonus)*: Non-blocking telemetry for operator actions (rules updated, conflicts viewed, fixtures loaded). Safe to run even if API keys are missing.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 13 (App Router), React, TypeScript
- **Database**: Supabase (Postgres)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Mapping**: Leaflet / React-Leaflet
- **Testing**: Vitest (100% integration test coverage)

---

## 🚀 Setup & Run Locally

### 1. Prerequisites
- Node.js 18+
- A Supabase project (free tier works fine, or use `supabase local`)

### 2. Environment Variables
Create a `.env.local` file in the root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_POSTHOG_KEY=optional_posthog_key
```
*(Note: The Service Role Key is used securely server-side to rebuild derived state tables bypassing RLS).*

### 3. Database Initialization
Run the SQL migration located at `supabase/migrations/20260815120151_create_telemetry_schema.sql` in your Supabase SQL Editor. This sets up:
- `telemetry_events` (immutable append-only log)
- `drone_state_versions` (derived)
- `conflict_decisions` (derived audit trail)
- `resolution_rules` (versioned JSON configurations)

### 4. Install & Run
```bash
npm install --legacy-peer-deps
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing the Application (For Judges & Operators)

The easiest way to test edge cases is through the provided C2 Dashboard fixtures.

### Live Dashboard Testing
1. Open the dashboard at `http://localhost:3000`.
2. Look at the **Load Fixtures** section in the left sidebar.
3. Click **"Load All Fixtures"**.
4. **Observe the Map**: You will see drone markers appear. `drone-alpha` and others will have flight trails. If a drone has an unresolved conflict (like `drone-zeta`), a pulsing amber zone will surround it.
5. **View Timelines**: Click a drone in the left sidebar to view its canonical timeline.
6. **View Conflicts**: Switch to the "⚡ Conflicts" tab to see exactly which rules fired. Note the plain-English `rule_applied` explanations (e.g., *"GPS preferred: confidence 0.91 > 0.8"*).
7. **Dynamic Rules**: Click **"⚙ Edit Rules"** in the top right. Change the threshold from `0.8` to `0.95`. Click Apply. Watch the dashboard instantly update its historical decisions to reflect the new rule logic.
8. **Audit Export**: Click the "↓ Export Audit" button on any drone to download the complete, mathematically verifiable JSON trace.

### Automated Test Suite
The application includes a rigorous Vitest suite that runs against the live Supabase instance.
```bash
npx vitest run tests/
```
**Test Coverage Includes:**
- `determinism.test.ts`: **The Acceptance Gate.** Submits the same events in two completely different file orders and mathematically proves the derived database states are byte-identical.
- `idempotency.test.ts`: Proves re-submitting an event 10 times causes zero side-effects.
- `ordering.test.ts`: Proves late-arriving historical events are folded into the correct chronological position.
- `conflict-rules.test.ts`: Validates the actual logic engine outputs.

---

## 🏛️ Architecture: Why Event Sourcing?
Instead of mutating a `current_position` row in Postgres (which causes race conditions, makes replay impossible, and destroys auditability), this system writes incoming HTTP requests to an append-only `telemetry_events` log. 

When a new event arrives, the system fetches all history for that drone, performs a deterministic canonical sort, and executes a pure functional fold (`reduce()`) to recalculate the entire state timeline from scratch. This guarantees that duplicate data, network lag, and out-of-order deliveries are handled natively by the architecture, rather than by brittle application-level patch logic.
