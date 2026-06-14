# Paragon Look-Ahead — Work Order Status

**Date:** 2026-06-14
**Branch:** `lookahead-v2`
**Latest tag:** `excel-base-load` (commit `11a9b82`)
**Live:** https://paragontulsaresults.com

---

## Where you stand

The look-ahead is now wired to real production data, the Excel export works with
live formulas, and the full schedule has been base-loaded from the current master
(`Paragon Master Schedule 6-15-2026.xlsx`). All items below are deployed and verified.

---

## Completed this session

### 1. Excel export — now produces a working file with live formulas
**File:** `shared/excel-export.js` (shared by `lookahead.html` + `crew-schedule-sandbox.html`)

- Rewrote the generator as **SpreadsheetML XML** (Excel opens it as a real spreadsheet, not HTML).
- **Staff Required** rows use live `=SUM(...)` formulas; **Staff Over/Under** uses `=cap - required`.
  Edit a headcount in Excel and both rows recalc automatically.
- Root-cause fixes found by reading Excel's own load-error log:
  - `LineStyle="Thin"` was invalid → changed to `LineStyle="Continuous"`. (This one bad value
    was blanking the entire sheet.)
  - Every cell now carries an explicit `ss:Index` so merged cells can't overlap.
- Downloads as `Paragon_<name>_<week>.xls`.

### 2. Production data now loads (was reading the wrong namespace)
**File:** `lookahead.html`

- Added a single `IS_SANDBOX` flag from the URL. Production (`lookahead.html`) reads/writes
  **unprefixed** blob keys = the real schedule data. Sandbox copy stays isolated under `sandbox:`.
- Previously `Save`/`Load` were hardcoded to `sandbox:true`, so they hit an empty namespace and
  always returned "no data found."

### 3. History auto-prepopulates on open
**File:** `lookahead.html` — `loadAllRows()`

- On page open and on every week change, all crews' saved rows load automatically.
- The **Your Name** picker only **filters** — it no longer gates whether data appears.
- `Load My Rows` button kept as a convenient manual refresh.

### 4. Week picker snaps to Monday
**File:** `lookahead.html` — `toMonday()`

- Any day you pick loads that week. **Sunday rolls forward** to the upcoming Monday
  (per your call); Mon–Sat snap back to that week's Monday.

### 5. Excel base load — full schedule overwritten from the master
- Source: **`P:\009 - Active Project Schedule\Paragon Master Schedule 6-15-2026.xlsx`**
  (the current file; an earlier load mistakenly used the stale 5-18 file and was corrected).
- Loaded **all weeks 6/15 → 9/21** (15 weeks) into the production blob store, overwriting
  beta-test data. Stale beta blobs cleared.
- Weekly master values are expanded across that week's 5 weekdays; the two daily-detail
  weeks (6/15, 6/22) use their actual day-by-day numbers.
- `DEFAULT_JOBS` roster in `lookahead.html` regenerated from the same master so job names
  line up exactly (BA-Jasper→Randy, 91st ST-COT→Jose, "Jenks-Elm Street Phase 2",
  asphalt all Rye, etc.).

### 6. Name filter covers everyone in CREW or PM/GS
**File:** `lookahead.html` — `buildNameDropdown()`, `isMyRow()`

- The **Your Name** dropdown is built dynamically from every distinct name in the CREW and
  PM/GS fields (`Mike/Clint` splits into Mike + Clint).
- Selecting a name filters rows where it appears in **either** crew or PM/GS — so PMs/GS
  (Mike, Eric, Clint) and crews (Jose, KSL, etc.) all work.

### 7. Earlier in session (already tagged `phase-4-done`)
- Shared Excel module extraction; "Export All" button in `crew-schedule-sandbox.html`;
  Gantt chips show count only (no SITE/UTIL prefix).

---

## What remains / open items

| # | Item | Notes |
|---|------|-------|
| 1 | **Past weeks 5/18–6/8** | Held as historical (your call). They still contain data from the older 5-18 master. Clear or reload only if you want them to match a master. |
| 2 | **Seed-from-Excel as a feature** | Tonight's base load was a manual one-time pipeline (PowerShell read of the .xlsx → POST to blob store). A self-serve "upload master → seed" button is still a future feature. See memory note `excel-seed-feature`. |
| 3 | **Master name typos carried in** | Excel is source of truth, so typos came across as-is, e.g. "Muskogee Ave Punch **Lidt**", concrete "Woodward" (vs "Woodward Park"). Fix in the master and re-load, or leave. |
| 4 | **NEI / FSL / United Golf crews** | The base load covered the four Paragon sections (Site/Utility/Concrete/Asphalt) only. NEI, FSL, and UG exist in the master + Gantt but are not in `lookahead.html`. Add if the look-ahead should include them. |
| 5 | **`job-detail-sandbox.html` → production** | Still deferred (promote to `job-detail.html`, update `index.html` card). |
| 6 | **`pm-view.html`** | Read-only all-supers view for Tyler/Dale — still deferred (the auto-load-all in `lookahead.html` now covers much of this need). |
| 7 | **Merge PR `lookahead-v2` → `main`** | After you've bug-bashed the above on production. |
| 8 | **Re-load cadence** | Each new weekly master (e.g. `...6-22-2026.xlsx`) will need a re-load to refresh future weeks. Currently manual.

---

## Reference

- **Blob store (prod):** `lookahead` · keys `week:superName` (unprefixed)
- **Blob store (sandbox):** `lookahead-sandbox` · keys `sandbox:week:superName`
- **Deploy:** `netlify deploy --prod` from `C:\Users\stephanie\paragon-deploy`
- **Tags this session:** `phase-4-done`, `excel-base-load`
