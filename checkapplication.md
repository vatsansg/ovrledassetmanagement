# LED Asset Manager — Manual Verification Checklist

Live walkthrough log. Each feature is checked off as you verify it in the
browser. Steps are provided in chat one at a time; this file is the running
record.

**Session reset:** all `ProcessingRuns`/`ProcessingFiles`/`ValidationResults`/
`RenamedAssets`/`SequenceEntries`/`DistributionResults` rows and their
physical downloaded/renamed/distributed files were cleared before this
walkthrough started. Run History should show empty. `EventSettings` are
empty (not yet configured); `LEDDevices` still point at scratch test paths
from prior development testing and `LED_File_Requirements` still holds the
12 rows imported from `references/LED_File_Requirements.csv` — neither was
reset, since only "processed data from previous runs" was requested to be
cleared, not configuration. You'll reconfigure these as part of the
Settings walkthrough below.

Legend: `[ ]` not yet verified · `[x]` verified working · `[!]` verified
broken (see note)

---

## A. Settings — Event tab
- [ ] EventId field: required-field indicator shows when empty
- [ ] EventId field: saves on blur, missing-settings count decreases
- [ ] EventName field: same as above

## B. Settings — SharePoint tab
- [ ] SharePointSourceLocation / AzureAdTenantId / AzureAdClientId fields save correctly
- [ ] SharePointSiteId / DriveId / FolderId show as read-only, "resolved automatically" placeholders
- [ ] Sign in button (requires a real Azure AD App Registration — see `docs/azure-ad-setup.md`)
- [ ] Sign-in status ("Signed in as ...") updates after a successful interactive login
- [ ] Sign out button
- [ ] Test Connection: full PASS chain (Authentication/Site/Library/Folder/File Listing)
- [ ] Test Connection: fails cleanly with a specific reason when misconfigured

## C. Settings — Folders tab
- [ ] LocalDownloadFolder / RenamedAssetsFolder / DefaultAssetFolder / RunningOrderFile fields save correctly

## D. Settings — LED Devices tab
- [ ] Label field editable and saves
- [ ] Resolution column is read-only and correct per device (LED1/LED2 = 1920×1080, LED3 = 3840×2160)
- [ ] Target path field editable and saves
- [ ] Enabled checkbox toggles and saves; rejects enabling with no target path
- [ ] Test Connection button: real writable path → PASS
- [ ] Test Connection button: bad/missing path → FAIL with a real reason

## E. Settings — LED Requirements tab
- [ ] File picker accepts `LED_File_Requirements.csv`
- [ ] Preview changes shows an accurate add/update/deactivate/unchanged diff
- [ ] Apply import commits the diff and refreshes the table
- [ ] Table shows canonical filename, required/optional, fallback, persistent flag, source folder hint (editable), description, active
- [ ] Source folder hint edits save independently of re-import

## F. Settings — Users tab (SuperAdmin only)
- [ ] Admin-role session cannot see this tab at all
- [ ] User list shows role dropdown, active checkbox, last login
- [ ] Add user creates a one-time temporary password shown once
- [ ] Reset password generates a new one-time temporary password
- [ ] Role/active toggle blocked for your own account (can't lock yourself out)

## G. Dashboard
- [ ] Configuration status reflects real missing-settings count
- [ ] LED devices enabled count is accurate
- [ ] Last run reflects the most recent run (or "Not available" when none)

## H. Processing page
- [ ] Preconditions list shows every real blocking reason when not ready
- [ ] Start Run disabled until preconditions pass
- [ ] Live progress step updates while a run is in flight
- [ ] Run summary counts (valid/invalid/new/modified/no-change/fallbacks) match reality
- [ ] Per-device distribution counts shown
- [ ] Validation errors table + Copy button produce a clean Partnership/Media-ready message
- [ ] Excluded/unmatched files table shows real exclusion reasons
- [ ] Sequence preview renders and CSV download works
- [ ] Discovered assets table matches every file actually found

## I. Run History
- [ ] Lists all past runs, newest first
- [ ] Clicking a run shows its full detail (same sections as Processing)

---

## Verification Log

(Appended as each item above is checked off in this session.)
