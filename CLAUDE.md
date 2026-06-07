# CLAUDE.md — Paragon Crew Schedule Tool

> Working context for Claude Code. Auto-loaded every session from `C:\Users\stephanie\paragon-deploy`.
> **You are continuing an in-progress build — read "Current state" and "Next session" before touching anything.**

---

## What this project is

A crew-scheduling web platform for **Paragon Contractors (Tulsa, OK)** that digitizes and replaces
their Excel master schedule workflow. All tools are static HTML deployed to Netlify — no framework,
no build step, no login required.

### People
| Role | Names |
|------|-------|
| Supers (weekly input) | Jared, Rolondo, Elijah, John, Jimmy, Randy, Sergio, Anthony, Rye, Miller |
| Crew Leads (task input) | John, KSL, VSF, foremen |
| PM / GS | Mike, Mike/Clint, Eric |
| Viewers (read-only) | Tyler Rogers, Dale Forrest |
| Admin / Deployer | Stephanie Jones |

### Schedule scope
Master season: **W0 = 5/18/2026 → W18 = 9/21/2026** (19 weeks).
Rolling 3-week input window: 15 weekday columns (Mon–Fri × 3) anchored on a "Week Of" Monday.

---

## Deploy / infra

| Setting | Value |
|---------|-------|
| Live URL | `paragontulsaresults.com` |
| Local repo | `C:\Users\stephanie\paragon-deploy` |
| Deploy command | `netlify deploy --prod` |
| Netlify Site ID | `d5746cd2-17b6-4e09-a348-9619018b738f` |
| Blob store | `lookahead` (all schedule data) |

### Blob key namespaces — never collide
| Data type | Key pattern |
|-----------|-------------|
| Lookahead (production) | `week:superName` |
| Lookahead (sandbox) | `sandbox:week:superName` |
| Job detail (sandbox) | `sandbox:job:week:jn` |
| Job detail (production, future) | `job:week:jn` |

### Crew section color codes (must match Excel master)
| Section | Hex |
|---------|-----|
| Site | `#185FA5` |
| Utility | `#0F6E56` |
| Concrete | `#854F0B` |
| Asphalt | `#3B6D11` |
| NEI | `#534AB7` |
| UnitedGolf | `#7B3010` |
| Brand Navy | `#1F3864` |

---

## Three-tier architecture

```
TIER 1 — CREW LEAD INPUT
  job-detail-sandbox.html
  · Pick job → pick crew lead name → enter task headcounts by day
  · Saves: POST /api/blobs  { week, job, jobMeta, tasks, sandbox:true }
  · Key:   sandbox:job:week:jn

          ↓  "⬆ Import Job Detail" button in lookahead.html

TIER 2 — SUPER / PM VIEW
  lookahead.html
  · Aggregated crew section view (Site / Utility / Concrete / Asphalt)
  · Supers enter/confirm crew counts, PM reviews
  · Saves: POST /api/blobs  { week, super, rows }
  · Key:   week:superName
  · Rollup endpoint: GET /api/blobs?week=&rollup=true → aggregates all job-detail saves

          ↓  "⬇ Export Excel" button

TIER 3 — CEO / MANAGEMENT OUTPUT
  Same lookahead.html view + Export Excel
  · Tyler Rogers / Dale Forrest read the aggregated report
  · Export must visually match the original Excel master EXACTLY
  · Print view also matches master format
```

---

## File inventory — complete

| File | Purpose | Audience | Status |
|------|---------|----------|--------|
| `index.html` | Operations Hub landing page | Everyone | ✅ Production |
| `lookahead.html` | 3-week look-ahead: super input + CEO output | Supers + Tyler/Dale | ✅ Production v2 |
| `lookahead-sandbox.html` | v2 copy — future v3 sandbox base | Dev only | Sandbox |
| `lookahead-v2-archive.html` | v2 frozen reference | Dev only | Archive |
| `job-detail-sandbox.html` | Task-level crew entry per job | Crew leads | 🟡 In Review |
| `crew-schedule.html` | Gantt viewer | Tyler, Dale | ✅ Production |
| `SuperFieldCard.html` | Laminated field card | Supers (print) | ✅ Production |
| `paragon_wip_v13.html` | WIP financial dashboard | Accounting / PM | ✅ Production |
| `team-handout.html` | Print handout for team demos | Training | ✅ Production |
| `netlify/functions/blobs.js` | All data persistence (all routes) | Backend | ✅ Production |

---

## lookahead.html — how it's built

Single self-contained HTML file. Inline `<style>` + inline `<script>`. No dependencies.

### State model
```js
state = {
  weekOf,       // ISO Monday string, e.g. "2026-06-01"
  superName,    // slug: "jared", "rolondo", etc.
  sections: [   // site(cap10), util(cap25), conc(cap10), asph(cap7)
    { id, label, capacity, jobs: [
        { _id, jn, pn, crew, pm, od, ad, status, imp, days[15] }
    ]}
  ]
}
```

### Key functions
| Function | What it does |
|----------|-------------|
| `render()` | Full re-render of all sections |
| `buildSection()` → `buildThead()` + `buildTbody()` → `buildJobRow()` | Desktop table construction |
| `updateDay(secId, jobId, colIdx, val)` | Writes state + updates cell class |
| `dayKeyNav(e, secId, jobId, colIdx)` | Keyboard nav: Tab/Enter→right, ↑↓→adjacent row, ←→ left/right |
| `highlightMyRows()` / `applyFocusMode()` | Per-super highlight + hide/show; also calls `switchView()` |
| `saveData()` / `loadData()` | Netlify Blobs round-trip (super's rows only) |
| `exportExcel()` | HTML→.xls — **must match Excel master visually, do not restyle** |
| `isMyRow(job)` | True if `job.crew` (lowercased) contains the super slug |
| `importFromJobDetail()` | Fetches rollup endpoint, merges job-detail saves into sections |
| `switchView()` | Switches between desktop table and mobile cards based on viewport + focus mode |
| `renderMobileCards()` → `buildMobileCard()` | Mobile-only card view rendering |
| `mUpdateDay()` / `mDayKeyNav()` | Mobile card day cell update + keyboard nav |

### Mobile field input (added 6/5/2026)
Activates when: `window.innerWidth < 768` **AND** focus mode ON **AND** super selected.

- Desktop table is hidden (`#main.m-hidden`)
- `#mobile-cards` shows one card per the super's jobs
- Each card: job name header + 3 week blocks × 5 day cells (52px tap targets)
- Sticky `#mobile-save-bar` fixed to bottom with Save button always visible
- Header simplified: week picker + name picker + Save only (Export/Print/Import hidden)
- On rotate to landscape (≥768px) → auto-switches back to desktop table
- **Same state, same saveData() — zero data model difference between views**

### DOM id conventions
- Section card: `sec-<secId>`
- Job row (desktop): `row-<jobId>`
- Day cell (desktop): `dc-<jobId>-<colIdx>`
- Day cell (mobile): `mdc-<jobId>-<colIdx>`

---

## job-detail-sandbox.html — how it's built

Single self-contained HTML file. No dependencies.

### State model
```js
state = {
  weekOf,    // ISO Monday string
  jobKey,    // selected job jn
  crewLead,  // filter string, e.g. "JOHN"
  jobMeta:   { jn, pn, section, pm, cap },
  tasks: [   { id, name, crew, pm, days[15] } ]
}
```

### Key features
- **Job picker** — custom div dropdown (no native select, avoids Chrome freeze bug)
- **Crew Lead picker** — filters visible task rows to only that crew lead's tasks
  - Hidden rows still contribute to Staff Required totals
- **Task grid** — columns: [del] | TASK/DESCRIPTION | CREW | PM/GS | [15 day cols]
- **Day cells** — accept numbers OR text (KSL, SUB, etc.)
  - Green = numeric value · Yellow = text/sub label
- **Staff Required / Staff Over-Under** — auto-calculated footer rows
- **Rollup Preview card** — collapsible panel showing how this job's totals appear
  as a single row in the master crew section report
- **Save/Load** — Netlify Blobs keyed by `sandbox:job:week:jn`

### SEED_JOBS (always-available baseline, no network needed)
All active 2026 jobs pre-loaded with crew assignments and 6/1/2026 week values:

**Site (cap 10):** 565 Jenks-Elm St (Jared), 571 BA-Jasper/Aspen (Rolondo), 574 91st→Harvard (John/KSL — full 12-task detail), 575 SGL Airport (Elijah), 91cot 91st ST-COT (Jose), 577 Kirby-Smith (Jimmy), Rejoice Parking Lot, Jenks-Elm Ph2 (Jared), Riverline Early Demo (SUB), 478 Pine/Mingo, 495 Rivercrest Ph3, 515 Rivercrest Memorial

**Utility (cap 25):** 566 COT Woodward Park (Sergio/Eric), 564 MCC 24" Tie-In (John/Mike), jenks_storm Jenks-Elm Storm (Anthony), cot91_util COT 91st (John + KSL sub), jenks_615 Jenks-Elm 6/15

**Concrete (cap 10):** elmst Elm St (Randy), 571c BA-Jasper/Aspen Concrete (Randy)

### Historical blobs seeded (via seed-data.html — now deleted)
| Week | Jobs saved | Source |
|------|-----------|--------|
| 2026-04-20 | 574 (full 12-task detail) | Excel Schedule sheet |
| 2026-06-01 | All 14 active jobs | 6/1/2026 master screenshot |

---

## netlify/functions/blobs.js — all API routes

### Lookahead routes (`/api/blobs`)
| Method | Params | Action |
|--------|--------|--------|
| GET | `week=&super=&[sandbox=true]` | Load one super's rows for a week |
| GET | `week=` | List all saves for a week (returns dict by super name) |
| POST | `{week, super, rows, [sandbox]}` | Save one super's rows |

### Job-detail routes (`/api/blobs`)
| Method | Params | Action |
|--------|--------|--------|
| GET | `week=&job=&[sandbox=true]` | Load one job's task data |
| POST | `{week, job, jobMeta, tasks, [sandbox]}` | Save one job's task data |
| GET | `week=&rollup=true&[sandbox=true]` | Aggregate ALL job saves → sections dict |

### Rollup response shape
```js
{ week, sections: {
  site: { cap, rows: [{ jn, pn, crew, pm, days[15] }] },
  util: { cap, rows: [...] },
  conc: { cap, rows: [...] },
  // etc.
}}
```

---

## Current state — as of 6/5/2026

### Completed this session
1. ✅ **v2 promoted to production** — `lookahead-sandbox.html` → `lookahead.html`, deployed
2. ✅ **`job-detail-sandbox.html`** — task-level entry for crew leads, full feature set
3. ✅ **Blobs API extended** — job-detail save/load + week rollup aggregation endpoint
4. ✅ **`index.html`** — Job Detail Entry card added (In Review badge)
5. ✅ **Historical data seeded** — 14 jobs × 2 weeks in Netlify Blobs (seed page deleted)
6. ✅ **Full job roster in SEED_JOBS** — all 2026 active jobs with crew/day data
7. ✅ **`importFromJobDetail()`** — wired in lookahead.html (⬆ Import Job Detail button)
8. ✅ **Mobile field input** — card view auto-activates on phone (<768px) in focus mode
9. ✅ **`team-handout.html`** — print-ready one-pager, full Paragon color scheme, QR code

---

## Next session — full cycle completion

### Priority 1 — End-to-end test the full cycle
```
1. Open job-detail-sandbox.html → pick job 565 → week 6/1/2026 → Load → verify Jared's 5s appear
2. Modify a day value → Save
3. Open lookahead.html → pick week 6/1/2026 → click "⬆ Import Job Detail"
4. Confirm 565 row populates with the saved values
5. Click "⬇ Export Excel" → confirm output matches Excel master format
```

### Priority 2 — Promote job-detail to production
- `job-detail-sandbox.html` → `job-detail.html`
- Update `index.html` card: href → `/job-detail.html`, badge → green "Crew Leads"
- Keep sandbox copy for future dev

### Priority 3 — PM/CEO read-only view
- New `pm-view.html`: auto-loads ALL supers' data for a selected week
- No name picker — shows all sections fully populated
- Tyler/Dale can view without touching the input form
- Same Export Excel button

### Priority 4 — Verify exportExcel() matches master
- `exportExcel()` was not modified during v2 or mobile work
- Confirm CEO-facing output still matches the original Excel master column-for-column
- Do not restyle without checking first

---

## Working rules for this repo

1. **`lookahead.html` is v2 production** — all new features go in a fresh sandbox copy first
2. **Never change `exportExcel()` output appearance** without verifying against the Excel master
3. **One file per tool** — single static HTML, inline CSS + JS, no build tooling, no npm
4. **No sensitive data** — Blobs payload is schedule data only (headcounts, job names, crew names)
5. **Deploy:** `netlify deploy --prod` from `C:\Users\stephanie\paragon-deploy`
6. **Blob store:** `lookahead` · Site ID: `d5746cd2-17b6-4e09-a348-9619018b738f`
7. **Sandbox-first:** always test in sandbox before promoting; sandbox keys are prefixed `sandbox:`
8. **Mobile:** viewport < 768px uses card view in lookahead.html — do not break `switchView()` when editing render logic
