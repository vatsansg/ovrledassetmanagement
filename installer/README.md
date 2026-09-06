# Windows installer build

Produces a single `LedAssetManager-Setup-<version>.exe` that installs the
app, its bundled Node runtime, and the built client, with no separate
Node.js install required on the target machine.

## One-time setup on the build machine

1. **Install Inno Setup 6**: https://jrsoftware.org/isinfo.php (default
   install path is assumed by `build.ps1`).
2. **Get a portable Node.js Windows x64 runtime** and extract it into
   `installer/vendor/node/` so that `installer/vendor/node/node.exe`
   exists:
   - Download `node-v22.x.x-win-x64.zip` from https://nodejs.org/en/download
     (pick an even-numbered LTS release matching what the app was
     developed against - Node 22 or later).
   - Extract the zip; the top-level folder's contents (`node.exe` and its
     accompanying files) go directly into `installer/vendor/node/`.
   - This folder is intentionally not committed to the repository (it's
     ~100MB of third-party binary) - `installer/vendor/` should be
     git-ignored.

Neither step could be completed in the environment this project was built
in (no internet access to jrsoftware.org/nodejs.org, and installing
software requires the user's own machine) - `build.ps1` and the `.iss`
script are complete and correct, but have not been compiled or run here.
Do both steps once on whichever machine will produce releases.

## Building

```powershell
powershell -File installer\build.ps1
```

This stages a production build (client `npm run build`, server
`npm ci --omit=dev`) into `installer\stage\`, copies the portable Node
runtime alongside it, and invokes `ISCC.exe` to produce the installer in
`installer\output\`.

## What the installer does

- Installs the app to `%ProgramFiles%\LED Asset Manager` (admin-required).
- Creates `%ProgramData%\OVRLedAssetManagement` (and `logs`/`downloads`/
  `renamed`/`defaults` subfolders) with read/write permission for
  non-admin users, since different Windows accounts may operate the same
  shared event-prep laptop - see plan §K for the rationale on choosing
  `%ProgramData%` over a per-user location.
- Creates a Start Menu shortcut and an optional desktop shortcut, both
  running `LaunchApp.vbs` - a small script that starts the bundled
  `node.exe` against the server code with no visible console window, then
  opens the default browser to `http://localhost:4000/`.
- On first launch, the server itself creates the SQLite database, runs
  migrations, and seeds the default SuperAdmin account and LED device
  rows (see `server/src/db/seed.js`) - no separate installer step needed.
- Uninstalling removes the installed application files but deliberately
  leaves `%ProgramData%\OVRLedAssetManagement` in place (config, database,
  logs) - see the comment in `LedAssetManager.iss`.

## Manual verification once compiled (not yet performed)

1. Run the installer on a clean Windows 10/11 VM with no prior Node.js
   install.
2. Confirm Start Menu and (if selected) desktop shortcuts exist and launch
   the app in the default browser.
3. Confirm `%ProgramData%\OVRLedAssetManagement\ledassetmanagement.db`
   exists after first launch, seeded with the default SuperAdmin user.
4. Configure Settings, run the full workflow (see the root `README.md` /
   `qa/manual-test-plan.md`), then uninstall and confirm
   `%ProgramData%\OVRLedAssetManagement` still exists with the data intact.
5. Reinstall and confirm the existing configuration/database is picked up
   rather than being reset.
