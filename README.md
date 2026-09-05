# LED Asset Manager

Deterministic, rules-based automation for the WTT Sports Presentation / LED asset workflow: discover assets from SharePoint, validate them against the official media spec, detect NEW/MODIFIED/NO_CHANGE/INVALID status, rename into the canonical per-device structure, apply fallback rules, generate the OVR sequence CSV, and distribute to the configured LED targets — with full run traceability.

Full architecture, database design, and rationale: see the approved plan at implementation time, and `docs/` (added as later stages land).

## Repository layout

```
server/     Express API + services (SQLite via better-sqlite3)
client/     React + Vite + Tailwind UI
references/ Source specs and real sample event data (not part of the app)
qa/         Manual QA scenarios (added in Stage 17)
installer/  Windows installer scripting (added in Stage 18)
```

## Development setup

Requires Node.js 20+ and npm.

```bash
npm install                 # installs both workspaces
cp server/.env.example server/.env
npm run dev:server          # starts the API on :4000
npm run dev:client          # starts the Vite dev server on :5173 (proxies /api and /ws to :4000)
```

Health check: `GET http://localhost:4000/api/health`

## Status

This is under active build-out, staged per the approved implementation plan (19 stages: repository/architecture → database → configuration → LED requirements import → SharePoint auth/discovery → hashing → validation → status detection → download → renaming/fallback → running order → sequence CSV → LED device config/connection testing → distribution → UI integration → logging/audit → manual QA → Windows installer → end-to-end verification). See commit history and stage-by-stage progress notes for current status.
