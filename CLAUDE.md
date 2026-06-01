# CLAUDE.md — Paragon Crew Schedule Tool

> Working context for Claude Code. Drop this at the repo root (`C:\Users\stephanie\paragon-deploy`).
> Claude Code auto-loads `CLAUDE.md`. Rename if you keep it somewhere else.
> **You are continuing an in-progress task — do not rebuild from scratch.** Read "Current task" before touching anything.

---

## What this project is

A crew-scheduling web tool for **Paragon Contractors (Tulsa, OK)** that digitizes their Excel
master schedule. Three deliverables, all static HTML deployed to Netlify:

| File | Role |
|------|------|
| `lookahead.html` | Super input form — the 3-week look-ahead resource report (where supers enter crew counts per day) |
| `crew-schedule.html` | Gantt viewer |
| `SuperFieldCard.html` | Laminated field card |

**Hard constraint:** the CEO-facing output (the Excel export and print view) must visually match
the existing Excel master schedule *exactly*. No visual deviation is acceptable. The on-screen
*input* UI can change freely; the *exported/printed* artifact cannot.

### People
- **Supers (input users):** Jared, Rolondo, Elijah, John, Jimmy, Randy, Sergio, Anthony, Rye, Miller
- **Viewers:** Tyler Rogers, Dale Forrest
- **Admin / Deployer:** Stephanie Jones

### Schedule scope
Master season runs **W0 = 5/18/2026 → W18 = 9/21/2026** (19 weeks). The look-ahead tool itself
shows a rolling **3-week window** (15 weekday columns: Mon–Fri × 3) anchored on a chosen "Week Of".

---

## Deploy / infra

- **Live URL:** `paragontulsaresults.com`
- **Local deploy folder:** `C:\Users\stephanie\paragon-deploy`
- **Deploy command:** `netlify deploy --prod`
- **Netlify Site ID:** `d5746cd2-17b6-4e09-a348-9619018b738f`
- **Data layer:** Netlify Blobs API at `/api/blobs`
  - **Save:** `POST /api/blobs` with `{ week, super, rows }` where each row is
    `{ sec, jobRef:"<jn>|<pn>", jn, pn, crew, days[15] }`
  - **Load:** `GET /api/blobs?week=<iso>&super=<slug>`

### Crew color codes (must match master)
| Crew | Hex |
|------|-----|
| Site | `#185FA5` |
| Utility | `#0F6E56` |
| Concrete | `#854F0B` |
| Asphalt | `#3B6D11` |
| NEI | `#534AB7` |
| UnitedGolf | `#7B3010` |
| Brand (Navy) | `#1F3864` |

---

## How `lookahead.html` is built (so you don't have to reverse-engineer it)

Single self-contained HTML file: inline `<style>` + inline `<script>`, no build step, no framework.

**State model**
```js
state = {
  weekOf,            // ISO Monday string
  superName,         // slug, e.g. "jared"
  sections: [        // SECTIONS = site(cap10), util(cap25), conc(cap10), asph(cap7)
    { id, label, capacity, jobs: [
        { _id, jn, pn, crew, pm, od, ad, status, imp, days[15] }
    ]}
  ]
}
```

**Day grid:** 15 columns = Mon–Fri across 3 weeks. `days[0..14]` holds the per-day value
(a number, `""`, or `"SUB"`).

**DOM id conventions** (used by navigation/highlight code):
- Section card: `sec-<secId>`
- Job row: `row-<jobId>`
- Day cell `<td>`: `dc-<jobId>-<colIdx>`

**Key functions**
- `render()` → `buildSection()` → `buildThead()` + `buildTbody()` → `buildJobRow()`
- `updateDay(secId, jobId, colIdx, val)` — writes state, sets the cell's class
- `dayKeyNav(e, secId, jobId, colIdx)` — keyboard navigation in the day grid
- `highlightMyRows()` / `applyFocusMode()` — per-super row highlight + collapse
- `saveData()` / `loadData()` — Netlify Blobs round-trip (only the selected super's rows)
- `exportExcel()` — generates the HTML-to-`.xls` that **must match the master** (don't restyle casually)
- `isMyRow(job)` — a row "belongs" to a super if `job.crew` (lowercased) contains the super slug

---

## Current task — guided data entry (v2), in a sandbox

**Decision: `lookahead.html` (production) is FROZEN.** All v2 work happens in a separate
**`lookahead-sandbox.html`** (a copy of production). When v2 is signed off, promote it to
`lookahead.html` and deploy. Until then, do not edit the frozen file.

The production input grid was unintuitive for supers. v2 makes data entry guided and collapses
the view to just the super's own jobs. **The following is already implemented in
`lookahead-sandbox.html`** — verify it's present and continue from here:

1. **Enter / Tab / → advance RIGHT**, not down. Fill Mon → Enter → Tue → Enter → Wed… At the end
   of a row (Fri of Week 3) it wraps to the first day cell of the next visible job. Shift reverses;
   `↑`/`↓` move one row in the same column; `←` moves left. Navigation is done by querying the flat
   DOM list `.r-job:not(.row-hidden) input.di`, so it automatically skips collapsed rows.
2. **Active cell = bright yellow** (`#FFE600` + heavy orange ring) via `td.dc input.di:focus`.
3. **Completed cell = green** (`var(--over)` / `#C6EFCE`) via a `dc-done` class added when a cell
   has a value. Applied at build time (prefilled cells), in `updateDay()`, and in `markDone()` when
   focus leaves a cell. SUB cells keep their yellow; empty cells stay gray.
4. **"👁 My Jobs Only" toggle** in the header (`#focusToggle`, `toggleFocusMode()` / `applyFocusMode()`).
   Auto-enables when a super picks their name. Hides rows that aren't theirs (`.row-hidden`) and hides
   sections containing none of their jobs. **Rows are only visually hidden, not removed** — so the
   Staff Required / Staff Over-Under totals still count every job and stay correct.
5. **Non-printing hint bar** (`#guide-bar`) explains the flow. It's `display:none` in `@media print`
   so the CEO/Excel output is unaffected.

### Assumptions baked in (flip if the supers want otherwise)
- "Done"/green means the cell **has any value** — there is no separate confirm step.
- Pressing Enter past an **empty** cell leaves it gray (not marked done).
- Enter at row-end **wraps across into the next section's rows** (flows continuously), rather than
  stopping at the section boundary or at the end of the row.

### Open follow-ups (next up)
- [ ] **Persist the done/green state across save & load** — currently green is derived live from
      cell values on render; confirm it survives a `loadData()` round-trip and a page refresh.
      (`saveData()` already stores `days[15]`, so green should re-derive on load — verify, don't assume.)
- [ ] Decide wrap behavior: continuous across sections (current) vs. stop at section boundary vs.
      stop at row-end. Make it a one-line config if undecided.
- [ ] Mobile-friendly input form (high-priority enhancement, see below) — the guided flow is a good
      foundation for touch.

### How to finish & ship v2
1. Work in `lookahead-sandbox.html`. Test locally (open in a browser; pick a super; the demo data
   already has rows for Jared, Rolondo, Elijah, John, Jimmy, Randy, Sergio, Anthony, Rye, Miller).
2. Sanity-check the **export still matches the master** (`exportExcel()` was not changed by v2, but
   confirm).
3. When approved: copy `lookahead-sandbox.html` → `lookahead.html`, then `netlify deploy --prod`.

---

## Enhancement backlog (priority order)

- **High:** mobile-friendly input form · auto-export to Excel · crew validation
- **Medium:** multi-week view toggle · conflict detection · PDF export
- **Low:** read-only Gantt · change log · email notifications

---

## Working rules for this repo
- Never edit the frozen `lookahead.html` until v2 is signed off; iterate in the sandbox copy.
- Never change the exported/printed output's appearance without checking it against the Excel master.
- Keep everything a single static HTML file per deliverable — no build tooling.
- Don't enter or store any sensitive data; the Blobs payload is schedule data only.
- Deploys are `netlify deploy --prod` from `C:\Users\stephanie\paragon-deploy`.
