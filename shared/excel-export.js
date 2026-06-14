/**
 * Paragon Look-Ahead — shared Excel export module
 * Outputs SpreadsheetML XML so Excel processes it as a real spreadsheet
 * with live SUM / subtraction formulas in Staff Required and Over/Under rows.
 *
 * Usage:
 *   ParagonExport.exportExcel(sections, weekOf, filenameBase)
 *
 * sections  — [{ id, label, capacity, jobs: [{ jn, pn, crew, pm, od, ad, status, imp, days[15] }] }]
 * weekOf    — ISO Monday string e.g. "2026-06-01"
 * filenameBase — e.g. "LookAhead" → Paragon_LookAhead_20260601.xlsx
 */

window.ParagonExport = (function () {

  // ── Date helpers ──────────────────────────────────────────────────────────────
  function getWeekDates(isoMonday) {
    if (!isoMonday) return Array(15).fill(null);
    const dates = [];
    const base = new Date(isoMonday + 'T12:00:00');
    for (let w = 0; w < 3; w++)
      for (let d = 0; d < 5; d++) {
        const dt = new Date(base);
        dt.setDate(base.getDate() + w * 7 + d);
        dates.push(dt);
      }
    return dates;
  }

  function fmtDate(dt) {
    return dt ? (dt.getMonth() + 1) + '/' + dt.getDate() : '';
  }

  function fmtFull(dt) {
    return dt ? (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear() : '';
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
    return jobs.reduce((s, j) => s + parseDay(j.days[colIdx]), 0);
  }

  function adjDueDate(od, addDays) {
    if (!od) return '';
    try {
      const p = od.split('/');
      if (p.length !== 3) return od;
      const d = new Date(+p[2], +p[0] - 1, +p[1]);
      d.setDate(d.getDate() + (parseInt(addDays) || 0));
      return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
    } catch { return od; }
  }

  function daysRemaining(adjDue, weekOfIso) {
    if (!adjDue || !weekOfIso) return '';
    try {
      const p = adjDue.split('/');
      if (p.length !== 3) return '';
      const due = new Date(+p[2], +p[0]-1, +p[1]);
      const ref = new Date(weekOfIso + 'T12:00:00');
      return Math.round((due - ref) / 86400000);
    } catch { return ''; }
  }

  function xe(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── SpreadsheetML builders ────────────────────────────────────────────────────

  // styleID, value (shown as fallback), type ('String'|'Number'), formula (R1C1), mergeAcross, colIndex
  // Row builder — emits an EXPLICIT ss:Index on every cell so MergeAcross spans
  // can never produce overlapping/ambiguous column positions (the #1 cause of
  // "Problems During Load" in SpreadsheetML). After a cell, the column cursor
  // advances by 1 + mergeAcross.
  function makeRow() {
    let col = 0;        // 1-based index of the LAST emitted cell's start
    let buf = '';
    return {
      // add(styleID, value, type, formula, mergeAcross)
      add(styleID, value, type, formula, mergeAcross) {
        const idx = col + 1;
        let a = ` ss:Index="${idx}"`;
        if (styleID)     a += ` ss:StyleID="${styleID}"`;
        if (mergeAcross) a += ` ss:MergeAcross="${mergeAcross}"`;
        if (formula)     a += ` ss:Formula="${xe(formula)}"`;
        const t = type || (typeof value === 'number' ? 'Number' : 'String');
        const d = (value !== '' && value !== null && value !== undefined)
          ? `<Data ss:Type="${t}">${xe(String(value))}</Data>` : '';
        buf += `<Cell${a}>${d}</Cell>`;
        col = idx + (mergeAcross || 0);   // advance past the merged span
        return this;
      },
      html() { return `<Row>${buf}</Row>\n`; }
    };
  }

  // Styles — borders included in every named style so they don't need inheritance
  const B = `<Borders>` +
      `<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8B8B8"/>` +
      `<Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8B8B8"/>` +
      `<Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8B8B8"/>` +
      `<Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B8B8B8"/>` +
    `</Borders>`;

  // SpreadsheetML requires child order: Alignment → Borders → Font → Interior
  // font: extra attrs appended after FontName; ss:Size="8.5" injected only if not already present
  function sty(id, interior, font, align) {
    const f = font || '';
    const sizeAttr = f.includes('ss:Size') ? '' : ' ss:Size="8.5"';
    const aln = align ? `<Alignment ss:Horizontal="${align}" ss:Vertical="Center"/>` : '<Alignment ss:Vertical="Center"/>';
    const int = interior ? `<Interior ss:Color="${interior}" ss:Pattern="Solid"/>` : '';
    return `<Style ss:ID="${id}">${aln}${B}<Font ss:FontName="Calibri"${sizeAttr}${f}/>${int}</Style>`;
  }

  const STYLES = `<Styles>
${sty('sD',    null,      '',                                               'Left')}
${sty('sN',    '#1F3864', ' ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"',  'Left')}
${sty('sNc',   '#1F3864', ' ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"',  'Center')}
${sty('sN2',   '#2F5496', ' ss:Bold="1" ss:Color="#FFFFFF"',               'Left')}
${sty('sN2c',  '#2F5496', ' ss:Bold="1" ss:Color="#FFFFFF"',               'Center')}
${sty('sDt',   '#D6DCE4', ' ss:Bold="1" ss:Color="#1F3864" ss:Size="8"',   'Center')}
${sty('sCap',  '#FCE4D6', ' ss:Bold="1"',                                  'Center')}
${sty('sCapL', '#FCE4D6', ' ss:Bold="1"',                                  'Left')}
${sty('sHdr',  '#BDD7EE', ' ss:Bold="1" ss:Color="#1F3864" ss:Size="8"',   'Center')}
${sty('sH2',   '#9DC3E6', ' ss:Bold="1" ss:Color="#1F3864"',               'Left')}
${sty('sReq',  '#DDEBF7', ' ss:Bold="1"',                                  'Center')}
${sty('sReqR', '#DDEBF7', ' ss:Bold="1"',                                  'Right')}
${sty('sOv',   '#C6EFCE', ' ss:Bold="1" ss:Color="#375623"',               'Center')}
${sty('sUn',   '#FFC7CE', ' ss:Bold="1" ss:Color="#9C0006"',               'Center')}
${sty('sZ',    '#FFFFCC', '',                                               'Center')}
${sty('sSub',  '#FFFF00', ' ss:Bold="1"',                                  'Center')}
${sty('sNum',  null,       '',                                              'Center')}
${sty('sWrn',  null,       ' ss:Bold="1" ss:Color="#C00000"',              'Center')}
${sty('sOk',   null,       ' ss:Color="#375623"',                          'Center')}
${sty('sSp',   null,       '',                                              'Left')}
</Styles>`;

  // ── Main export ───────────────────────────────────────────────────────────────
  function exportExcel(sections, weekOf, filenameBase) {
    const dates    = getWeekDates(weekOf);
    const weekLabel = weekOf
      ? 'WEEK OF ' + new Date(weekOf + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric' })
      : 'WEEK OF ___';

    let rowNum = 0;
    let rows = '';
    function emit(rb) { rowNum++; rows += rb.html(); }

    // Title
    { const rb = makeRow(); rb.add('sN', 'LOOK AHEAD RESOURCE REPORT — ' + weekLabel, 'String', null, 26); emit(rb); }
    // Spacer
    { const rb = makeRow(); rb.add('sSp', '', 'String', null, 26); emit(rb); }

    sections.forEach((sec, si) => {
      const cap = sec.capacity;

      // Section header row — label + week group labels (cols: 1-10, 11-15, 16-20, 21-25, 26, 27)
      { const rb = makeRow();
        rb.add('sN',  sec.label, 'String', null, 9);
        rb.add('sNc', 'WEEK 1',  'String', null, 4);
        rb.add('sNc', 'WEEK 2',  'String', null, 4);
        rb.add('sNc', 'WEEK 3',  'String', null, 4);
        rb.add('sNc', 'WEEK OF', 'String');
        rb.add('sN',  '',        'String');
        emit(rb); }

      // Dates row
      { const rb = makeRow();
        rb.add('sDt', 'Date:', 'String', null, 9);
        for (let i = 0; i < 15; i++) rb.add('sDt', dates[i] ? fmtDate(dates[i]) : '', 'String');
        rb.add('sDt', dates[0] ? fmtFull(dates[0]) : '', 'String');
        rb.add('sD', '', 'String');
        emit(rb); }

      // Headcount row (cols: 1-3, 4, 5-10, 11-25, 26, 27)
      { const rb = makeRow();
        rb.add('sH2',   sec.label,    'String', null, 2);
        rb.add('sCapL', 'Headcount:', 'String');
        rb.add('sCap',  '',           'String', null, 5);
        for (let i = 0; i < 15; i++) rb.add('sCap', cap, 'Number');
        rb.add('sD', '', 'String');
        rb.add('sD', '', 'String');
        emit(rb); }

      // Column headers
      { const rb = makeRow();
        ['#','PROJECT NAME','CREW','PM/GS','ORIG DUE','ADD DAYS','ADJ DUE','DAYS REM','STATUS','IMPACT']
          .forEach(h => rb.add('sH2', h, 'String'));
        for (let i = 0; i < 15; i++) rb.add('sHdr', DAY_LABELS[i], 'String');
        rb.add('sHdr', '', 'String');
        rb.add('sD', '', 'String');
        emit(rb); }

      const jobStartRow = rowNum + 1;

      // Job rows
      sec.jobs.forEach(job => {
        const adj = adjDueDate(job.od, job.ad);
        const rem = daysRemaining(adj, weekOf);
        const remSty = (rem !== '' && parseInt(rem) < 30) ? 'sWrn' : 'sOk';
        const rb = makeRow();
        rb.add('sD',   job.jn,     'String');
        rb.add('sD',   job.pn,     'String');
        rb.add('sD',   job.crew,   'String');
        rb.add('sD',   job.pm,     'String');
        rb.add('sNum', job.od,     'String');
        rb.add('sNum', job.ad,     'String');
        rb.add('sOk',  adj,        'String');
        rb.add(remSty, rem !== '' ? rem : '', rem !== '' ? 'Number' : 'String');
        rb.add('sNum', job.status, 'String');
        rb.add('sNum', job.imp,    'String');
        for (let i = 0; i < 15; i++) {
          const v = job.days[i];
          const isSub = typeof v === 'string' && v.toUpperCase() === 'SUB';
          if (isSub) {
            rb.add('sSub', 'SUB', 'String');
          } else if (v !== '' && v !== null && v !== undefined) {
            const n = parseFloat(v);
            rb.add('sNum', isNaN(n) ? v : n, isNaN(n) ? 'String' : 'Number');
          } else {
            rb.add('sD', '', 'String');
          }
        }
        rb.add('sD', '', 'String');
        rb.add('sD', '', 'String');
        emit(rb);
      });

      const jobEndRow = rowNum;
      const reqRow    = rowNum + 1;

      // Staff Required — live SUM formulas (R1C1). Day cols are 11-25.
      { const rb = makeRow();
        rb.add('sReqR', 'Staff Required', 'String', null, 9);
        for (let i = 0; i < 15; i++) {
          const col = 11 + i;
          rb.add('sReq', calcRequired(sec.jobs, i) || 0, 'Number',
            `=SUM(R${jobStartRow}C${col}:R${jobEndRow}C${col})`);
        }
        rb.add('sD', '', 'String');
        rb.add('sD', '', 'String');
        emit(rb); }

      // Staff Over/Under — cap minus the Staff Required cell above
      { const rb = makeRow();
        rb.add('sReqR', 'Staff Over / Under', 'String', null, 9);
        for (let i = 0; i < 15; i++) {
          const col = 11 + i;
          const ou = cap - calcRequired(sec.jobs, i);
          const style = ou > 0 ? 'sOv' : ou < 0 ? 'sUn' : 'sZ';
          rb.add(style, ou, 'Number', `=${cap}-R${reqRow}C${col}`);
        }
        rb.add('sD', '', 'String');
        rb.add('sD', '', 'String');
        emit(rb); }

      // Spacer between sections
      if (si < sections.length - 1) {
        const rb = makeRow(); rb.add('sSp', '', 'String', null, 26); emit(rb);
      }
    });

    // Column widths (info cols narrower, day cols uniform)
    const colWidths = [
      40, 160, 60, 60, 55, 45, 55, 45, 50, 40,  // cols 1-10
      28, 28, 28, 28, 28,                          // week 1
      28, 28, 28, 28, 28,                          // week 2
      28, 28, 28, 28, 28,                          // week 3
      50, 20                                        // spacers
    ];
    const colDefs = colWidths.map(w =>
      `<Column ss:Width="${w}" ss:AutoFitWidth="0"/>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${STYLES}
<Worksheet ss:Name="Look Ahead">
<Table>
${colDefs}
${rows}</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
  <FreezePanes/>
  <FrozenNoSplit/>
  <SplitHorizontal>1</SplitHorizontal>
  <TopRowBottomPane>1</TopRowBottomPane>
  <ActivePane>2</ActivePane>
</WorksheetOptions>
</Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
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
