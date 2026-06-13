const { getStore } = require("@netlify/blobs");

const SITE_ID = "d5746cd2-17b6-4e09-a348-9619018b738f";
const WIP_SLOTS = new Set(['wip', '505', 'act', 'ct', '520', 'pc10021', 'pvb']);

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getCrewStore(env) {
  // env='sandbox' → physically separate store; anything else → production store (name unchanged)
  const name = (env === 'sandbox') ? 'lookahead-sandbox' : 'lookahead';
  return getStore({ name, siteID: SITE_ID, token: process.env.NETLIFY_ACCESS_TOKEN });
}

function getWipStore() {
  return getStore({ name: "wip-reports", siteID: SITE_ID, token: process.env.NETLIFY_ACCESS_TOKEN });
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };

  const params = event.queryStringParameters || {};
  const path   = event.path || "";

  try {
    // ── WIP Report routes (/api/store-report, /api/get-report, /api/list-reports) ──
    if (path.includes("list-reports") || path.includes("store-report") || path.includes("get-report")) {
      return await handleWip(event, params);
    }

    // ── Crew Schedule routes (/api/blobs) ──
    return await handleCrew(event, params);

  } catch (err) {
    console.error("error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ── WIP handlers ─────────────────────────────────────────────────────────────

async function handleWip(event, params) {
  const store = getWipStore();

  // GET /api/list-reports
  if (event.httpMethod === "GET" && !params.slot) {
    const slots = {};
    await Promise.allSettled([...WIP_SLOTS].map(async (slot) => {
      try {
        const result = await store.getWithMetadata(slot, { type: "text" });
        if (result && result.metadata) {
          slots[slot] = {
            filename:   result.metadata.filename   || slot,
            mimeType:   result.metadata.mimeType   || "",
            uploadedAt: result.metadata.uploadedAt || null,
          };
        }
      } catch (_) {}
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ slots }) };
  }

  // GET /api/get-report?slot=wip
  if (event.httpMethod === "GET" && params.slot) {
    const slot = params.slot;
    if (!WIP_SLOTS.has(slot)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid slot" }) };
    try {
      const result = await store.getWithMetadata(slot, { type: "text" });
      if (!result || !result.data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      return { statusCode: 200, headers, body: JSON.stringify({
        data:       result.data,
        filename:   result.metadata && result.metadata.filename   || slot,
        mimeType:   result.metadata && result.metadata.mimeType   || "application/octet-stream",
        uploadedAt: result.metadata && result.metadata.uploadedAt || null,
      })};
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // POST /api/store-report
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body); } catch (_) { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }
    const { slot, filename, mimeType, data } = body;
    if (!slot || !WIP_SLOTS.has(slot)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid slot" }) };
    if (!filename) return { statusCode: 400, headers, body: JSON.stringify({ error: "filename required" }) };
    if (!data)     return { statusCode: 400, headers, body: JSON.stringify({ error: "data required" }) };
    const uploadedAt = new Date().toISOString();
    await store.set(slot, data, { metadata: { slot, filename, mimeType: mimeType || "application/octet-stream", uploadedAt } });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, slot, uploadedAt }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
}

// ── Crew Schedule handlers ────────────────────────────────────────────────────

async function handleCrew(event, params) {
  // env param selects the blob store; unknown/absent → prod (safe fallback)
  const env = (params.env || 'prod').toLowerCase();
  const store = getCrewStore(env === 'sandbox' ? 'sandbox' : 'prod');
  const { week, super: superName, job: jobNum, sandbox } = params;

  // Legacy key-prefix isolation (job-detail-sandbox.html still uses ?sandbox=true / body sandbox:true)
  const ns = sandbox === "true" ? "sandbox:" : "";

  // ── Rollup: GET /api/blobs?week=<iso>&rollup=true  ──────────────────────
  // Returns all job-detail saves for the week, aggregated into crew sections
  if (params.rollup === "true" && event.httpMethod === "GET") {
    const prefix = ns + "job:" + week + ":";
    let blobs = [];
    try { const r = await store.list({ prefix }); blobs = r.blobs || []; } catch(e) {}
    const jobs = [];
    await Promise.all(blobs.map(async (b) => {
      try {
        const raw = await store.get(b.key);
        if (raw) jobs.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch {}
    }));
    // Aggregate: one row per job, days = sum of numeric task.days per column
    const sections = {};
    jobs.forEach(({ jobMeta, tasks }) => {
      if (!jobMeta || !tasks) return;
      const sec = jobMeta.section || "site";
      if (!sections[sec]) sections[sec] = { cap: jobMeta.cap, rows: [] };
      const days = Array(15).fill(0);
      tasks.forEach(t => {
        (t.days || []).forEach((v, i) => { const n = parseFloat(v); if (!isNaN(n)) days[i] += n; });
      });
      sections[sec].rows.push({
        jn: jobMeta.jn, pn: jobMeta.pn, crew: jobMeta.primaryCrew || "",
        pm: jobMeta.pm, days
      });
    });
    return { statusCode: 200, headers, body: JSON.stringify({ week, sections }) };
  }

  // ── Job-detail routes (job= param present) ──────────────────────────────
  if (jobNum !== undefined) {
    if (event.httpMethod === "GET") {
      const key = ns + "job:" + week + ":" + jobNum;
      let data = null;
      try {
        const raw = await store.get(key);
        if (raw !== null && raw !== undefined) data = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch(e) { console.log("job GET error:", e.message); }
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "Not found" }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { week: w, job: jn, jobMeta, tasks, sandbox: sbx } = body;
      const keyNs = sbx === true ? "sandbox:" : "";
      const key = keyNs + "job:" + w + ":" + jn;
      const value = JSON.stringify({ week: w, job: jn, jobMeta, tasks, updated: new Date().toISOString() });
      await store.set(key, value);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, key }) };
    }
  }


  if (event.httpMethod === "GET" && superName) {
    const key = ns + week + ":" + superName;
    let data = null;
    try {
      const raw = await store.get(key);
      console.log("GET raw type:", typeof raw, "value:", raw);
      if (raw !== null && raw !== undefined) data = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch(e) { console.log("GET error:", e.message); }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "GET" && week) {
    const prefix = ns + week + ":";
    let blobs = [];
    try {
      const r = await store.list({ prefix });
      blobs = r.blobs || [];
      console.log("list count:", blobs.length);
    } catch(e) { console.log("list error:", e.message); }
    const out = {};
    await Promise.all(blobs.map(async (b) => {
      const name = b.key.slice(prefix.length);
      try {
        const raw = await store.get(b.key);
        if (raw) out[name] = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {}
    }));
    return { statusCode: 200, headers, body: JSON.stringify(out) };
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const { week: w, super: s, rows, sandbox: sbx } = body;
    const keyNs = sbx === true ? "sandbox:" : "";
    const key = keyNs + w + ":" + s;
    const value = JSON.stringify({ week: w, super: s, rows, updated: new Date().toISOString() });
    console.log("POST key:", key, "len:", value.length);
    await store.set(key, value);
    console.log("set() done");
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, key }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
}
