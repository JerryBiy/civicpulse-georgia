import { createClient } from "@supabase/supabase-js";

const required = [
  "SOURCE_SUPABASE_URL",
  "SOURCE_SUPABASE_SERVICE_ROLE_KEY",
  "TARGET_SUPABASE_URL",
  "TARGET_SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

if (process.env.SOURCE_SUPABASE_URL === process.env.TARGET_SUPABASE_URL) {
  throw new Error("Source and target Supabase URLs must be different projects.");
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const source = createClient(
  process.env.SOURCE_SUPABASE_URL,
  process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY,
  options,
);
const target = createClient(
  process.env.TARGET_SUPABASE_URL,
  process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY,
  options,
);

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

async function readAll(table, select, configure) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = source
      .from(table)
      .select(select)
      .range(offset, offset + PAGE_SIZE - 1);
    query = configure(query);
    const { data, error } = await query;
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function upsertBatches(table, rows, onConflict) {
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
    const batch = rows.slice(offset, offset + PAGE_SIZE);
    const { error } = await target.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Could not write ${table}: ${error.message}`);
    written += batch.length;
  }
  return written;
}

async function syncSessions() {
  const rows = await readAll(
    "bill_session_sync_state",
    "state,session_id,dataset_hash,session_name,year_start,year_end,is_special,is_prior,is_sine_die,bill_count,last_synced_at",
    (query) => query.eq("state", "GA").order("session_id", { ascending: true }),
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
    (query) => query.eq("state", "GA")
      .order("session_id", { ascending: true })
      .order("bill_number", { ascending: true }),
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
    (query) => query.eq("state", "GA")
      .gt("session_id", 0)
      .order("session_id", { ascending: true })
      .order("start_time", { ascending: true }),
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
