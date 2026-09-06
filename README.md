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

All 19 implementation stages have been built. The full pipeline
(discovery → classification → validation → NEW/MODIFIED/NO_CHANGE
detection → download → renaming/fallback → running-order/sequence
generation → distribution) has been verified end-to-end against the
complete real sample dataset in `references/`, including catching and
fixing two real bugs along the way (an orphaned sponsor file being
distributed anyway, and unmatched/excluded files not being persisted for
later review) - see the git history for details on each stage.

Two things could not be exercised in this development environment and
still need real-world verification:

- **Live SharePoint sign-in and discovery** - requires an Azure AD App
  Registration in the target tenant (see `docs/azure-ad-setup.md`) and an
  operator's own interactive Microsoft 365 login, which this assistant
  must never perform on the user's behalf. The code path is real and
  complete; only the live tenant round-trip is unverified.
- **The Windows installer** - `installer/LedAssetManager.iss` and
  `installer/build.ps1` are complete, but compiling them requires Inno
  Setup and a portable Node.js runtime that weren't available in this
  environment. See `installer/README.md` for exact setup steps.

See `qa/manual-test-plan.md` for the full scenario checklist and which
items are verified vs. still pending.

## Production build

```bash
powershell -File installer\build.ps1     # requires Inno Setup + a portable Node runtime, see installer/README.md
```

Or run the production server directly against a manually-built client:

```bash
npm run build:client
npm start                                 # serves both the API and the built client from :4000
```
