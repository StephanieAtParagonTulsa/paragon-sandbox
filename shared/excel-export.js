/**
 * Paragon Look-Ahead — shared Excel export module
 * Self-hosted at /shared/excel-export.js (Netlify static).
 *
 * Usage:
 *   ParagonExport.exportExcel(sections, weekOf, filenameBase)
 *
 * sections  — array matching state.sections shape:
 *   [{ id, label, capacity, jobs: [{ jn, pn, crew, pm, od, ad, status, imp, days[15] }] }]
 * weekOf    — ISO Monday string, e.g. "2026-06-01"
 * filenameBase — e.g. "LookAhead" → downloads "Paragon_LookAhead_20260601.xls"
 *
 * Staff Required and Over/Under rows use x:Formula so they recalculate
 * when headcount cells are edited directly in Excel.
 */

window.ParagonExport = (function() {

  // ── Date helpers ─────────────────────────────────────────────────────────────
  function getWeekDates(isoMonday) {
    if (!isoMonday) return Array(15).fill(null);
    const dates = [];
    const base = new Date(isoMonday + 'T12:00:00');
    for (let w = 0; w < 3; w++) {
      for (let d = 0; d < 5; d++) {
        const dt = new Date(base);
        dt.setDate(base.getDate() + w * 7 + d);
        dates.push(dt);
      }
    }
    return dates;
  }

  function fmtDate(dt) {
    if (!dt) return '';
    return (dt.getMonth() + 1) + '/' + dt.getDate();
  }

  function fmtFull(dt) {
    if (!dt) return '';
    return (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();
  }

  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Mon','Tue','Wed','Thu','Fri','Mon','Tue','Wed','Thu','Fri'];

  // ── Calc helpers ──────────────────────────────────────────────────────────────
  function parseDay(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'string' && v.toUpperCase() === 'SUB') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function calcRequired(jobs, colIdx) {
    return jobs.reduce((sum, j) => sum + parseDay(j.days[colIdx]), 0);
  }

  function adjDueDate(od, addDays) {
    if (!od) return '';
    try {
      const parts = od.split('/');
      if (parts.length !== 3) return od;
      const d = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      d.setDate(d.getDate() + (parseInt(addDays) || 0));
      return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    } catch { return od; }
  }

  function daysRemaining(adjDue, weekOfIso) {
    if (!adjDue || !weekOfIso) return '';
    try {
      const parts = adjDue.split('/');
      if (parts.length !== 3) return '';
      const due = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      const ref = new Date(weekOfIso + 'T12:00:00');
      return Math.round((due - ref) / 86400000);
    } catch { return ''; }
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Excel column letter for a day index (0-14 → K-Y, i.e. cols 11-25)
  // Info columns A-J (10 cols), day columns K-Y (15 cols)
  function colLetter(dayIdx) {
    return String.fromCharCode(64 + 11 + dayIdx); // K=75, Y=89
  }

  // ── Main export function ──────────────────────────────────────────────────────
  function exportExcel(sections, weekOf, filenameBase) {
    const dates = getWeekDates(weekOf);
    const weekLabel = weekOf
      ? 'WEEK OF ' + (new Date(weekOf + 'T12:00:00')).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
      : 'WEEK OF ___';

    const N = '#1F3864', N2 = '#2F5496';
    const CAP_BG = '#FCE4D6', HDR_BG = '#BDD7EE', HDR_BG2 = '#9DC3E6';
    const DATE_BG = '#D6DCE4', REQ_BG = '#DDEBF7';
    const OVER = '#C6EFCE', OVER_FG = '#375623', UNDER = '#FFC7CE', UNDER_FG = '#9C0006';

    const css = `<style>
      body { font-family: Calibri, Arial; font-size: 11pt; }
      table { border-collapse: collapse; }
      td, th { border: 1px solid #B8B8B8; padding: 2px 5px; white-space: nowrap; font-size: 8.5pt; }
      .navy  { background: ${N};  color: #FFF; font-weight: bold; }
      .navy2 { background: ${N2}; color: #FFF; font-weight: bold; }
      .date-bg { background: ${DATE_BG}; color: ${N}; font-weight: bold; text-align: center; font-size: 8pt; }
      .cap-bg  { background: ${CAP_BG}; font-weight: bold; text-align: center; }
      .hdr-bg  { background: ${HDR_BG};  color: ${N}; font-weight: bold; text-align: center; font-size: 8pt; text-transform: uppercase; }
      .hdr-bg2 { background: ${HDR_BG2}; color: ${N}; font-weight: bold; }
      .req-bg  { background: ${REQ_BG}; font-weight: bold; text-align: center; }
      .over    { background: ${OVER};  color: ${OVER_FG}; font-weight: bold; text-align: center; }
      .under   { background: ${UNDER}; color: ${UNDER_FG}; font-weight: bold; text-align: center; }
      .zero-ou { background: #FFFFCC; text-align: center; }
      .sub-cell { background: #FFFF00; font-weight: bold; text-align: center; }
      .num-cell { text-align: center; }
      .lbl-r   { text-align: right; font-weight: bold; }
      .info-hdr { font-weight: bold; background: ${N2}; color: #FFF; }
    </style>`;

    // Single table — track rowNum (1-indexed) so x:Formula refs are exact
    let rowNum = 0;
    function row(inner) { rowNum++; return `<tr>${inner}</tr>`; }

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8">${css}</head><body><table>`;

    // Title row
    html += row(`<td colspan="27" class="navy" style="font-size:11pt;padding:5px 8px;">LOOK AHEAD RESOURCE REPORT — ${weekLabel}</td>`);
    // Blank spacer after title
    html += row(`<td colspan="27"></td>`);

    sections.forEach((sec, si) => {
      const cap = sec.capacity;

      // Row 1: section title + week labels
      html += row(`
        <td colspan="10" class="navy" style="text-align:left">${esc(sec.label)}</td>
        <td colspan="5"  class="navy" style="text-align:center">WEEK 1</td>
        <td colspan="5"  class="navy" style="text-align:center">WEEK 2</td>
        <td colspan="5"  class="navy" style="text-align:center">WEEK 3</td>
        <td class="navy" style="font-size:8pt">WEEK OF</td>
        <td class="navy"></td>`);

      // Row 2: dates
      let dateInner = `<td colspan="10" class="date-bg" style="text-align:right">Date:</td>`;
      for (let i = 0; i < 15; i++) dateInner += `<td class="date-bg">${dates[i] ? fmtDate(dates[i]) : ''}</td>`;
      dateInner += `<td class="date-bg">${dates[0] ? fmtFull(dates[0]) : ''}</td><td></td>`;
      html += row(dateInner);

      // Row 3: headcount
      let capInner = `<td colspan="3" class="cap-bg hdr-bg2">${esc(sec.label)}</td>
        <td class="cap-bg" style="text-align:left;font-weight:bold">Headcount:</td>
        <td colspan="6" class="cap-bg"></td>`;
      for (let i = 0; i < 15; i++) capInner += `<td class="cap-bg">${cap}</td>`;
      capInner += `<td></td><td></td>`;
      html += row(capInner);

      // Row 4: column headers
      const colHdrs = ['#','PROJECT NAME','CREW','PM/GS','ORIG DUE','ADD DAYS','ADJ DUE','DAYS REM','STATUS','IMPACT'];
      let hdrInner = colHdrs.map(h => `<th class="hdr-bg2" style="text-align:left">${h}</th>`).join('');
      for (let i = 0; i < 15; i++) hdrInner += `<th class="hdr-bg">${DAY_LABELS[i]}</th>`;
      hdrInner += `<th class="hdr-bg"></th><th></th>`;
      html += row(hdrInner);

      const jobStartRow = rowNum + 1;

      // Job rows
      sec.jobs.forEach(job => {
        const adj = adjDueDate(job.od, job.ad);
        const rem = daysRemaining(adj, weekOf);
        const remStyle = rem !== '' && parseInt(rem) < 30 ? 'color:#C00000;font-weight:bold' : 'color:#375623';

        let jobInner = `
          <td>${esc(job.jn)}</td>
          <td>${esc(job.pn)}</td>
          <td>${esc(job.crew)}</td>
          <td>${esc(job.pm)}</td>
          <td style="text-align:center">${esc(job.od)}</td>
          <td class="num-cell">${esc(job.ad)}</td>
          <td style="text-align:center;font-size:8pt;color:#666">${esc(adj)}</td>
          <td class="num-cell" style="${remStyle}">${rem !== '' ? rem : ''}</td>
          <td style="text-align:center">${esc(job.status)}</td>
          <td class="num-cell">${esc(job.imp)}</td>`;
        for (let i = 0; i < 15; i++) {
          const v = job.days[i] || '';
          const isSub = typeof v === 'string' && v.toUpperCase() === 'SUB';
          const cls = isSub ? 'sub-cell' : (v ? 'num-cell' : '');
          jobInner += `<td class="${cls}">${v}</td>`;
        }
        jobInner += `<td></td><td></td>`;
        html += row(jobInner);
      });

      const jobEndRow = rowNum;
      const reqRow   = rowNum + 1;

      // Staff Required — SUM formula per day column
      let reqInner = `<td colspan="10" class="lbl-r req-bg">Staff Required</td>`;
      for (let i = 0; i < 15; i++) {
        const col = colLetter(i);
        const staticVal = calcRequired(sec.jobs, i) || '';
        reqInner += `<td class="req-bg" x:Formula="=SUM(${col}${jobStartRow}:${col}${jobEndRow})">${staticVal}</td>`;
      }
      reqInner += `<td></td><td></td>`;
      html += row(reqInner);

      // Staff Over/Under — cap minus Staff Required cell
      let ouInner = `<td colspan="10" class="lbl-r req-bg">Staff Over / Under</td>`;
      for (let i = 0; i < 15; i++) {
        const col = colLetter(i);
        const reqVal = calcRequired(sec.jobs, i);
        const ou = cap - reqVal;
        const cls = ou > 0 ? 'over' : ou < 0 ? 'under' : 'zero-ou';
        ouInner += `<td class="${cls}" x:Formula="=${cap}-${col}${reqRow}">${ou}</td>`;
      }
      ouInner += `<td></td><td></td>`;
      html += row(ouInner);

      // Spacer between sections
      if (si < sections.length - 1) {
        html += row(`<td colspan="27"></td>`);
      }
    });

    html += `</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const wo   = weekOf ? weekOf.replace(/-/g, '') : 'NoDate';
    a.href     = url;
    a.download = `Paragon_${filenameBase}_${wo}.xls`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return { exportExcel };

})();
