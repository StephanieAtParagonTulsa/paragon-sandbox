# Paragon Crew Schedule Tool — Project Brief

**This is the shared source of truth.** Two AI surfaces and several people work on this tool. Anyone — Claude Code, this Claude Project chat, or a human picking it back up — should read the **Current State** block first, then the rest as needed.

> **How to keep this useful:** whenever something material changes (a file is edited, a deploy goes out, a decision is made), update the Current State block and add a row to Project History. Keep one copy in the deploy folder and re-upload to the Claude Project so both surfaces match.

---

## ⚡ Current State — update this every session

**Last updated:** 2026-06-02
**Updated by:** Claude Code (Stephanie's machine)

| Item | Status |
|---|---|
| **Active task** | v2 UI complete in sandbox — guided entry, focus mode, green cells, hint bar |
| **Where the work is happening** | Claude Code (on Stephanie's machine) |
| **Beta URL** | `paragontulsaresults.com/lookahead-sandbox.html` — brown banner = sandbox |
| **Production URL** | `paragontulsaresults.com/lookahead.html` — live, frozen until v2 approved |
| **Open risk** | ⚠ Sandbox writes to SAME blob namespace as production — must fix before reviewers enter data |
| **Last deploy** | 2026-06-02 — `lookahead-sandbox.html` deployed to prod via `netlify deploy --prod` |
| **Git repo** | `github.com/StephanieAtParagonTulsa/paragon-sandbox`, branch `lookahead-v2` |
| **Files touched this session** | `lookahead-sandbox.html`, `netlify.toml`, `package.json`, `.gitignore`, `.gitattributes` |

**Next up:** Fix blob isolation — sandbox should write to a `sandbox:` key prefix so reviewer test data never touches production blob keys. Then share beta URL with Tyler/Dale/Jared.

---

## Workspaces & Sync Protocol

Two AI surfaces, no live link between them. The files are the bridge.

### Who works where

| Surface | Use it for | Why |
|---|---|---|
| **Claude Code** (on Stephanie's machine) | Editing live files (`lookahead.html`, `lookahead-sandbox.html`), running `netlify deploy --prod`, committing to git | Lives on the same machine as the deploy folder; shortest edit → deploy → look loop |
| **Claude Project chat** (here) | Planning changes, previewing standalone artifacts, writing reviewer instructions, updating guides and this brief | Good for anything that doesn't touch the live files directly |

**Rule of thumb:** if it changes a file on disk or deploys, it belongs in Claude Code. If it's planning, docs, or a throwaway preview, it belongs here.

### How the two stay in sync

1. **Git is the spine.** Claude Code commits after each meaningful change. The commit history is the canonical record of what the sandbox/production files actually contain.
2. **Re-upload after material changes.** When a file changes in Claude Code, re-upload it to the Claude Project so this chat's context matches disk. Otherwise this chat will give advice based on a stale copy.
3. **This brief is the handoff note.** Update the Current State block in Claude Code, sync it up here. Both surfaces read the same block, so neither gives contradictory advice.

### Coming back to a session cold
Paste into your first message here:
```
Working on the Paragon Crew Schedule Tool. Brief attached.
Current state: [paste the Current State block]
Today I want to: [what you want to change]
```
Upload the file you're editing and the visual-reference Excel if a layout change is involved.

---

## Beta / Production Split

Same domain, two pages, easy to remember:

- **Beta:** `paragontulsaresults.com/lookahead-sandbox.html` — **brown banner** marks it as a sandbox. Safe for reviewers to poke at.
- **Production:** `paragontulsaresults.com/lookahead.html` — live. Supers enter real schedule data here.

**Data isolation is the thing to verify.** Both pages talk to Netlify Blobs via `/api/blobs`. If the sandbox writes to the same blob keys as production, a reviewer's test data lands in the live schedule. The sandbox must write to a separate namespace (e.g. a `sandbox:` key prefix or a distinct store) before reviewers touch it. **Confirm this is true and record it in Current State.**

---

## Project Overview

**Client:** Paragon Contractors (Tulsa, OK)
**Purpose:** Web-based input tool letting Site Supers and Foremen create and update three-week look-ahead schedules without Excel. Output must visually match the existing Excel master schedule — the CEO requires this and **will not accept visual changes**.
**Schedule span:** W0 = 5/18/2026 through W18 = 9/21/2026 (19 weeks).

---

## People

| Role | Names |
|---|---|
| **Site Supers / Foremen** (data entry) | Jared, Rolondo, Elijah, John, Jimmy, Randy, Sergio, Anthony, Rye, Miller |
| **Management viewers** (read-only) | Tyler Rogers, Dale Forrest |
| **Admin / deployer** | Stephanie Jones |

---

## Files in This Project

| File | What it is | Audience |
|---|---|---|
| `lookahead.html` | Production super input form | Supers / Foremen |
| `lookahead-sandbox.html` | Beta input form (brown banner) | Reviewers |
| `crew-schedule.html` | Gantt viewer | Tyler, Dale |
| `SuperFieldCard.html` | Printable/laminated field card — 4 steps + crew reference | Every super |
| `Paragon_GanttViewerGuide.docx` | Viewer guide — load data, color legend, ▼▲ symbols | Tyler, Dale |
| `Paragon_CrewSchedule_AdminGuide.docx` | Deploy commands, add jobs/supers, troubleshooting, rollout email | Admin / IT / PM |
| `Paragon_LookAhead_20260601.xls` | Current source/visual-reference schedule | Reference for layout matching |
| `netlify.toml` | Netlify config | — |

**Visual-reference rule:** any layout change gets validated against the master Excel before it ships. No deviations.

---

## Crew Color Codes

| Crew | Color |
|---|---|
| Site | blue `#185FA5` |
| Utility | teal `#0F6E56` |
| Concrete | amber `#854F0B` |
| Asphalt | green `#3B6D11` |
| NEI | purple `#534AB7` |
| UnitedGolf | dark red `#7B3010` |
| Brand navy | `#1F3864` |

---

## Deploy Configuration

- **Site:** paragontulsaresults.com (Netlify)
- **Netlify Site ID:** `d5746cd2-17b6-4e09-a348-9619018b738f`
- **Deploy folder:** `C:\Users\stephanie\paragon-deploy`
- **Deploy command:** `netlify deploy --prod` (add `--skip-functions-cache` when functions change)
- **Shell:** Command Prompt, not PowerShell
- **Data:** Netlify Blobs via `/api/blobs`

### Hard-won deploy lessons
- Root-level `_redirects` overrides all `netlify.toml` sources, including stale regenerated ones — treat it as the authoritative redirect source.
- Blobs functions must pass explicit `siteID` and token; path-based routing via `export const config` fails on redirected requests (original pathname is lost).
- When multiple API endpoints are needed, merge logic into one proven function and route by HTTP method + query params rather than separate files.
- SheetJS CDN (`cdn.sheetjs.com`) is unreliable — inline the library into the HTML.

---

## Key Design Constraints

- Output must match the Excel master exactly — **CEO will not accept visual changes.**
- Supers/foremen are the primary data-entry users — keep input UI simple (the 4-step model).
- Crew-to-row mapping must stay accurate across both the input form and the Gantt viewer.

---

## Future Enhancement Ideas

### High Priority
- **Mobile-friendly input form** — optimize for phone/tablet use in the field
- **Auto-export to Excel** — download a filled schedule in the exact master format
- **Crew validation** — warn if a super assigns more crew than available that week

### Medium Priority
- **Multi-week view toggle** — switch between weeks 1/2/3 in one interface
- **Conflict detection** — flag the same crew double-booked
- **PDF export** — print-ready PDF straight from the tool

### Lower Priority
- **Read-only Gantt** — view link without edit access
- **Change log** — who changed what, when
- **Email notifications** — alert PM on submission

---

## Rollout Checklist

- [ ] Confirm sandbox blob isolation before reviewers touch beta
- [ ] Fill in admin phone number in `SuperFieldCard.html` "Questions?" line
- [ ] Print and laminate `SuperFieldCard.html` for each site trailer
- [ ] Share `Paragon_GanttViewerGuide.docx` with Tyler and Dale
- [ ] Review/customize rollout email from Admin Guide before sending
- [ ] Deploy per Admin Guide instructions

---

## Project History

| Date | Work Done |
|---|---|
| May 2026 | Initial build — SuperFieldCard.html, GanttViewerGuide.docx, CrewSchedule_AdminGuide.docx |
| 2026-06-02 (morning) | Code port complete; beta/production split set up; brief restructured around two-surface workflow |
| 2026-06-02 (afternoon) | Git init paragon-deploy; pushed to github.com/StephanieAtParagonTulsa/paragon-sandbox; created threeweekbeta Netlify site; built v2 UI (Enter→right nav, yellow active cell, green done cells, My Jobs Only toggle, hint bar); sandbox deployed to paragontulsaresults.com/lookahead-sandbox.html |

*Add a row whenever work ships.*

---

*Shared source of truth for the Paragon Crew Schedule Tool. Keep one copy in `C:\Users\stephanie\paragon-deploy` and re-upload to the Claude Project after material changes.*
