# Paragon Tools — Deploy Instructions

## Folder structure

paragon-deploy/
  netlify.toml                   ← Netlify config (do not edit)
  netlify/
    functions/
      blobs.mjs                  ← Live data API (do not edit)
  lookahead.html                 ← 3-Week Look-Ahead (updated)
  crew-schedule.html             ← Crew Deployment Gantt (updated)
  [your other tools here]        ← Copy these from your old deploy folder

## Before your first deploy — copy your existing tools

Copy these files into this folder (paragon-deploy):
  - wip-dashboard.html  (or whatever your WIP Dashboard is named)
  - odot-price-history.html
  - production-factor.html
  - hb-vista-compare.html
  - index.html (if you have one)
  - Any other tools currently live on paragontulsaresults.com

## Deploy command

Open Command Prompt, navigate to your home folder (C:\Users\stephanie),
and run:

  netlify deploy --prod --dir=paragon-deploy

That's it. Every deploy going forward uses this same command.

## How the live data works

FOR SUPERS (in the field or office):
1. Go to paragontulsaresults.com/lookahead.html
2. Select their name from the "YOUR NAME" dropdown
3. Select the week
4. Enter headcount numbers in their highlighted rows (yellow)
5. Click "☁ Save My Rows"
   → Green bar appears confirming save

FOR TYLER / DALE (viewing the Gantt):
1. Go to paragontulsaresults.com/crew-schedule.html
2. Click "📡 Load Live Data" button (top right)
   → Cells with live data show: faded baseline + colored actual number
   → ▼ = fewer than scheduled, ▲ = more, ● = same
3. Click "Clear" to go back to baseline view

## Blob storage keys

Data is stored in Netlify Blobs as:
  lookahead : {week-date} : {super-name}
  e.g.       2026-05-25  :  jared

Each super's save only touches their own key.
No one can overwrite another super's data.

## Troubleshooting

"Load Live Data" shows error:
  → Function may not be deployed yet. Run netlify deploy --prod again.

Super's rows aren't highlighted:
  → The crew field in their row must match their name exactly.
     Edit the CREW column in the Look-Ahead Tool to fix.

"No live data found":
  → Either no super has saved yet, or the week date doesn't match.
     Confirm the week in the Look-Ahead Tool matches what you're viewing.
