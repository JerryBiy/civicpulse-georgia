const required = [
  "SOURCE_SUPABASE_URL",
  "SOURCE_SUPABASE_SECRET_KEY",
  "TARGET_SUPABASE_URL",
  "TARGET_SUPABASE_SECRET_KEY",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

if (process.env.SOURCE_SUPABASE_URL === process.env.TARGET_SUPABASE_URL) {
  throw new Error("Source and target Supabase URLs must be different projects.");
}

const source = {
  url: process.env.SOURCE_SUPABASE_URL.replace(/\/$/, ""),
  key: process.env.SOURCE_SUPABASE_SECRET_KEY,
};
const target = {
  url: process.env.TARGET_SUPABASE_URL.replace(/\/$/, ""),
  key: process.env.TARGET_SUPABASE_SECRET_KEY,
};

const PAGE_SIZE = 500;
const importedAt = new Date().toISOString();
const privateBillFields = new Set([
  "id",
  "user_id",
  "summary",
  "changes_analysis",
  "ai_analysis",
  "tracked",
  "is_tracked",
  "pdf_url",
  "tags",
  "created_date",
]);

function publicBillPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key]) => !privateBillFields.has(key)),
  );
}

async function restRequest(project, path, options = {}) {
  const response = await fetch(`${project.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: project.key,
      Authorization: `Bearer ${project.key}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase REST request failed (${response.status}): ${detail}`);
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function readAll(table, select, { filters = [], order = [] } = {}) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    for (const [column, operator, value] of filters) {
      params.append(column, `${operator}.${value}`);
    }
    if (order.length) {
      params.set(
        "order",
        order.map(([column, direction]) => `${column}.${direction}`).join(","),
      );
    }

    let data;
    try {
      data = await restRequest(source, `${table}?${params}`);
    } catch (error) {
      throw new Error(`Could not read ${table}: ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function upsertBatches(table, rows, onConflict) {
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
    const batch = rows.slice(offset, offset + PAGE_SIZE);
    const params = new URLSearchParams({ on_conflict: onConflict });
    try {
      await restRequest(target, `${table}?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(batch),
      });
    } catch (error) {
      throw new Error(`Could not write ${table}: ${error.message}`);
    }
    written += batch.length;
  }
  return written;
}

async function syncSessions() {
  const rows = await readAll(
    "bill_session_sync_state",
    "state,session_id,dataset_hash,session_name,year_start,year_end,is_special,is_prior,is_sine_die,bill_count,last_synced_at",
    {
      filters: [["state", "eq", "GA"]],
      order: [["session_id", "asc"]],
    },
  );
  return upsertBatches(
    "civic_sessions",
    rows.map((row) => ({
      state: row.state,
      session_id: row.session_id,
      dataset_hash: row.dataset_hash,
      session_name: row.session_name,
      year_start: row.year_start,
      year_end: row.year_end,
      is_special: row.is_special,
      is_prior: row.is_prior,
      is_sine_die: row.is_sine_die,
      bill_count: row.bill_count,
      source_updated_at: row.last_synced_at,
      imported_at: importedAt,
    })),
    "state,session_id",
  );
}

async function syncBills() {
  const rows = await readAll(
    "legislative_bill_cache",
    "state,session_id,bill_number,legiscan_id,payload,updated_at",
    {
      filters: [["state", "eq", "GA"]],
      order: [["session_id", "asc"], ["bill_number", "asc"]],
    },
  );
  return upsertBatches(
    "civic_bills",
    rows.map((row) => ({
      state: row.state,
      session_id: row.session_id,
      bill_number: row.bill_number,
      legiscan_id: row.legiscan_id,
      payload: publicBillPayload(row.payload),
      source_updated_at: row.updated_at,
      imported_at: importedAt,
    })),
    "state,session_id,bill_number",
  );
}

async function syncMeetings() {
  const rows = await readAll(
    "ga_meetings_cache",
    "state,session_id,id,legis_id,title,description,start_time,end_time,all_day,color,location,classification,chamber,video_url,agenda_url,schedule_url,will_broadcast,is_vimeo,data,updated_at",
    {
      filters: [["state", "eq", "GA"], ["session_id", "gt", 0]],
      order: [["session_id", "asc"], ["start_time", "asc"]],
    },
  );
  return upsertBatches(
    "civic_meetings",
    rows.map(({ updated_at: sourceUpdatedAt, ...row }) => ({
      ...row,
      data: row.data || {},
      source_updated_at: sourceUpdatedAt,
      imported_at: importedAt,
    })),
    "state,session_id,id",
  );
}

console.log("Copying public legislative data into the standalone CivicPulse database…");
const sessionCount = await syncSessions();
const billCount = await syncBills();
const meetingCount = await syncMeetings();
console.log(`Done: ${sessionCount} sessions, ${billCount} bills, ${meetingCount} meetings.`);
