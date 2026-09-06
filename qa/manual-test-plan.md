# Manual QA Test Plan

No automated test framework is used (per the master prompt). This is the
scenario checklist for manually verifying the application. Sections marked
**(verified this session)** were actually run against real data during
development - see the git history for the corresponding commit. Sections
marked **(requires live tenant)** need a real Azure AD App Registration and
Microsoft 365 sign-in, which could not be exercised in the development
environment (see `docs/azure-ad-setup.md`).

## 1. Configuration

- [x] Missing EventId/EventName/folders/SharePoint fields show as "missing" on Dashboard and Settings, and block Start Run **(verified)**
- [x] Zero LED devices enabled blocks Start Run with a clear reason **(verified)**
- [x] One / two / three enabled LED devices all work **(verified: all three enabled and distributed to in the full pipeline test)**
- [x] Enabling a device without a target path is rejected **(verified)**
- [x] LED Device Test Connection: real writable path -> PASS **(verified)**
- [x] LED Device Test Connection: nonexistent path -> FAIL with the real OS error **(verified)**
- [ ] SharePoint Test Connection: full PASS chain (auth/site/library/folder/listing) **(requires live tenant)**
- [x] SharePoint Test Connection: fails cleanly and specifically when SharePointSourceLocation isn't set **(verified)**

## 2. Authentication

- [x] Wrong password rejected with a clear message **(verified)**
- [x] Correct password issues a session; `mustChangePassword` surfaces the change-password modal **(verified for both the seeded SuperAdmin and a newly created Admin user)**
- [x] Change-password modal can be dismissed ("Remind me later") without blocking use **(verified)**
- [x] A new user is created with a one-time temporary password, must change it on first login **(verified)**
- [x] Admin role cannot see the Users tab **(verified)**
- [x] Admin role's Settings/LED-device fields are genuinely disabled (attempted to type into a disabled field and had it rejected) **(verified)**
- [ ] Microsoft 365 interactive sign-in completes and the session persists across app restarts on the same laptop **(requires live tenant + real interactive login - this is the user's own credential entry, not something to be performed on their behalf)**

## 3. LED Requirements import

- [x] Importing the real `LED_File_Requirements.csv` produces exactly the expected 12 rows (1 correctly skipped as a duplicate) **(verified)**
- [x] Re-importing the same CSV shows 0 changes (idempotent) **(verified)**
- [x] Removing a row from the CSV and re-importing deactivates it (not deleted) **(verified)**
- [x] Re-adding that row reactivates it **(verified)**
- [x] Source folder hints seed correctly on first import, survive a re-import unchanged, and are editable **(verified)**

## 4. File discovery and classification

- [x] Every real LED-device-token filename variant (`LED1`, `_LED 1`, `LED2`, `LED3 OVR`) is detected correctly **(verified against all 59 real sample files)**
- [x] Files with no LED-device token are excluded and reported, not silently dropped **(verified)**
- [x] Venue LED-mapping diagrams (`0_LED_Mapping`) are excluded even though they carry device tokens **(verified - found and fixed a real bug here)**
- [x] Category A assets resolve via source-folder hint (Home Look, Time Out, Water Break, Game/Match/Championship Point, Winning Moment) **(verified against every real Category A file)**
- [x] Category B (sponsor) files resolve via stem stripping, independent of separator/case variance **(verified against all 28 real sponsor files)**
- [x] A sponsor file with a valid device token but never referenced in the running order (the real `GPMP` case) is excluded from renaming/distribution, not just from the sequence **(verified - found and fixed a real bug here)**

## 5. Validation

- [x] Valid video passes every rule (format, resolution, frame rate, bitrate) **(verified against all real video samples on LED1/LED2/LED3)**
- [x] Valid PNG passes every rule (format, resolution, bit depth, size) **(verified against all real sponsor/template PNGs)**
- [x] A resolution mismatch against the wrong device profile is correctly caught **(verified with a deliberate LED1-file-validated-as-LED3 test)**
- [x] Validation-errors table renders and the Copy button produces a clean Partnership/Media-ready message
- [ ] An actually-oversized PNG (>4MB) or over-bitrate video (>80Mbps) fails correctly - no real sample exceeds either limit, so this needs a deliberately-crafted test file

## 6. File status detection

- [x] First-time asset -> NEW **(verified)**
- [x] Same content hash or same eTag on a later run -> NO_CHANGE **(verified with simulated Graph metadata)**
- [x] Different hash and different eTag -> MODIFIED **(verified with simulated Graph metadata)**
- [ ] A real three-run sequence (NEW -> NO_CHANGE -> MODIFIED) against live SharePoint, where the source file is actually edited between runs **(requires live tenant)**

## 7. Fallback engine

- [x] Required asset missing, with historical precedent, no fallback defined -> run is BLOCKED with a clear reason **(verified)**
- [x] Optional asset missing, with historical precedent, fallback defined -> fallback substituted and reported **(verified)**
- [x] Asset/device pair with no historical precedent at all -> silently not reported (avoids wrongly blocking a combination that may not apply to that device, e.g. HOME_Look.png on LED1) **(verified - documented as a deliberate judgment call, see plan follow-up)**
- [x] Missing individual sponsor ad falls back to `all-adv.png`, then `default.png` if that's also missing, always reported **(verified against the real running order, where no `all-adv.png` source was ever supplied)**
- [x] The `Sequence=999` "All Logo" row follows the same fallback chain **(verified - found and fixed a bug where it only checked `all-adv.png`, not the `default.png` fallback)**

## 8. Running order / sequence

- [x] The real 40-slot workbook parses correctly (both column-pairs, not just the first) **(verified - found and fixed a bug where only 20 of 40 slots were read)**
- [x] All 13 real sponsor labels resolve correctly (10 exact, 3 prefix matches) **(verified)**
- [x] Sequence numbering restarts per device (LED1 1-40, LED2 1-40 independently) **(verified)**
- [x] Category A assets never appear in the Sequence CSV **(verified)**
- [x] Sequence CSV downloads correctly from the Processing/Run History UI **(verified)**

## 9. Distribution

- [x] Successful copy+verify to an enabled device with a real local path **(verified)**
- [x] A disabled device is skipped, not treated as an error **(verified)**
- [x] Pre-flight connectivity is re-checked immediately before every copy, not trusting a stale Test Connection result **(verified)**
- [ ] A target that fails mid-copy (e.g. drive disconnected) - not exercised; the failure-path code exists (`DistributionResults.Status = 'FAILED'`) but wasn't triggered by a real I/O failure

## 10. Full pipeline (end to end)

- [x] Complete run against the entire real sample dataset: 59 discovered, 48 valid, 0 invalid, 10 correctly excluded/unmatched, 82 sequence entries, 50 files distributed and verified across all three devices **(verified, confirmed live in the browser via Run History)**
- [ ] The same run repeated against live SharePoint, including the actual download step and a real interactive Microsoft 365 sign-in **(requires live tenant)**

## 11. Installer

- [ ] Fresh install on a clean Windows 10/11 machine with no prior Node.js install
- [ ] First launch creates the database and seeds the default SuperAdmin account
- [ ] Uninstall preserves `%ProgramData%\OVRLedAssetManagement`
- [ ] Reinstall picks up the existing configuration/database

None of section 11 could be performed in this environment - no Inno Setup
installation and no portable Node.js runtime were available to actually
compile the installer. See `installer/README.md` for exact prerequisites.
