import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const STATE = "GA";
const PAGE_SIZE = 500;
const LEGISCAN_BASE_URL = "https://api.legiscan.com/";
const LEGIS_GA_API_BASE = "https://www.legis.ga.gov/api";
const LEGIS_GA_TOKEN_SALT = "QFpCwKfd7f";
const LEGIS_GA_TOKEN_KEY = "jVEXFFwSu36BwwcP83xYgxLAhLYmKk";
const LEGIS_GA_TOKEN_CONST = "letvarconst";

function loadLocalEnv(file = ".env.sync") {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[name] == null) process.env[name] = value;
  }
}

function getConfig() {
  loadLocalEnv();
  const config = {
    legiscanKey: process.env.LEGISCAN_API_KEY,
    supabaseUrl: process.env.CIVICPULSE_SUPABASE_URL,
    supabaseKey: process.env.CIVICPULSE_SUPABASE_SECRET_KEY,
    syncMeetings: process.env.SYNC_MEETINGS !== "false",
  };
  const missing = [
    ["LEGISCAN_API_KEY", config.legiscanKey],
    ["CIVICPULSE_SUPABASE_URL", config.supabaseUrl],
    ["CIVICPULSE_SUPABASE_SECRET_KEY", config.supabaseKey],
  ]
    .filter(([, value]) => !String(value || "").trim())
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return {
    ...config,
    supabaseUrl: config.supabaseUrl.replace(/\/$/, ""),
  };
}

async function parseResponse(response, context) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${context} failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function supabaseRequest(database, path, options = {}) {
  const response = await fetch(`${database.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: database.key,
      Authorization: `Bearer ${database.key}`,
      ...options.headers,
    },
  });
  return parseResponse(response, "Supabase REST request");
}

async function readAll(database, table, select, { filters = [], order = [] } = {}) {
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
      params.set("order", order.map(([column, direction]) => `${column}.${direction}`).join(","));
    }
    const data = await supabaseRequest(database, `${table}?${params}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function hasRows(database, table, filters) {
  const params = new URLSearchParams({ select: "id", limit: "1" });
  for (const [column, operator, value] of filters) {
    params.append(column, `${operator}.${value}`);
  }
  const data = await supabaseRequest(database, `${table}?${params}`);
  return Boolean(data?.length);
}

async function upsertBatches(database, table, rows, onConflict) {
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
    const batch = rows.slice(offset, offset + PAGE_SIZE);
    const params = new URLSearchParams({ on_conflict: onConflict });
    await supabaseRequest(database, `${table}?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    written += batch.length;
  }
  return written;
}

async function legiscanRequest(apiKey, operation, params = {}) {
  const url = new URL(LEGISCAN_BASE_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("op", operation);
  for (const [name, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(name, String(value));
  }
  const response = await fetch(url);
  const data = await parseResponse(response, `LegiScan ${operation}`);
  if (data?.status === "ERROR") {
    throw new Error(`LegiScan ${operation}: ${data.alert?.message || "provider error"}`);
  }
  return data;
}

export function normalizeSessions(rows) {
  return (rows || [])
    .map((row) => ({
      session_id: Number(row.session_id),
      session_name:
        row.session_title || row.session_name || row.name || `Session ${row.session_id}`,
      year_start: Number(row.year_start) || null,
      year_end: Number(row.year_end) || Number(row.year_start) || null,
      special: Number(row.special) === 1,
      prior: Number(row.prior) === 1,
      sine_die: Number(row.sine_die) === 1,
      dataset_hash: row.dataset_hash || null,
    }))
    .filter((row) => Number.isSafeInteger(row.session_id) && row.session_id > 0)
    .sort(
      (left, right) =>
        (right.year_end || 0) - (left.year_end || 0) ||
        (right.year_start || 0) - (left.year_start || 0) ||
        right.session_id - left.session_id,
    );
}

export function activeSessionIds(sessions) {
  const active = sessions.filter((session) => !session.prior);
  if (active.length) return new Set(active.map((session) => session.session_id));
  const newestYear = Math.max(...sessions.map((session) => session.year_end || session.year_start || 0));
  return new Set(
    sessions
      .filter((session) => (session.year_end || session.year_start || 0) === newestYear)
      .map((session) => session.session_id),
  );
}

export function shouldRefreshSession(session, stored, activeIds) {
  if (!stored || Number(stored.bill_count) === 0) return true;
  if (activeIds.has(session.session_id)) return true;
  return Boolean(session.dataset_hash) && session.dataset_hash !== stored.dataset_hash;
}

function compactBillNumber(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function sponsorNames(sponsors) {
  return Array.isArray(sponsors)
    ? sponsors.map((sponsor) => sponsor?.name).filter(Boolean)
    : [];
}

function sponsorParty(sponsors) {
  const first = Array.isArray(sponsors) ? sponsors[0] : null;
  if (typeof first?.party === "string" && first.party.trim()) {
    return first.party.trim().toUpperCase();
  }
  return ({ 1: "R", 2: "D", 3: "I", 4: "G", 5: "L", 6: "NP" })[
    Number(first?.party_id)
  ] || null;
}

function committeeFromAction(action) {
  const match = String(action || "").match(
    /(?:assigned to|referred to|re-referred to|recommitted to)\s+(.+?)(?:\s*[.,;]|$)/i,
  );
  const name = match?.[1]?.trim() || null;
  return /^(?:house|senate|governor)$/i.test(name || "") ? null : name;
}

function billStatus(code, action) {
  const description = String(action || "").toLowerCase();
  if (/signed|enacted|approved/.test(description)) return "signed";
  if (/veto/.test(description)) return "vetoed";
  if (/fail|dead|died in/.test(description)) return "dead";
  if (description.includes("governor")) return "sent_to_governor";
  if (description.includes("third") && description.includes("read")) return "passed_third_reading";
  if (description.includes("second") && description.includes("read")) return "passed_second_reading";
  if (description.includes("first") && description.includes("read")) return "passed_first_reading";
  if (/assigned to|referred to|committee|subcommittee/.test(description)) return "in_committee";
  return ({
    1: "introduced",
    2: "in_committee",
    3: "passed_third_reading",
    4: "sent_to_other_chamber",
    5: "passed_both_chambers",
    6: "vetoed",
    7: "dead",
  })[Number(code)] || "introduced";
}

export function normalizeMasterList(masterList, session) {
  const rows = [];
  for (const [key, wrapper] of Object.entries(masterList || {})) {
    if (key === "session") continue;
    const bill = wrapper?.bill || wrapper;
    const billNumber = compactBillNumber(bill?.bill_number || bill?.number);
    if (!billNumber || !bill?.bill_id) continue;
    const sponsors = sponsorNames(bill.sponsors);
    const action = bill.last_action || bill.status_desc || "Introduced";
    rows.push({
      state: STATE,
      session_id: session.session_id,
      bill_number: billNumber,
      legiscan_id: String(bill.bill_id),
      title: bill.title || bill.description || "Untitled legislation",
      chamber: String(bill.chamber || bill.body || (billNumber.startsWith("S") ? "senate" : "house")).toLowerCase(),
      bill_type: /^(?:HR|SR)/.test(billNumber) ? "resolution" : "bill",
      sponsor: sponsors[0] || undefined,
      sponsor_party: sponsorParty(bill.sponsors) || undefined,
      sponsors: sponsors.length ? sponsors : undefined,
      co_sponsors: sponsors.length > 1 ? sponsors.slice(1) : undefined,
      session_name: session.session_name,
      session_year: session.year_start,
      status: billStatus(bill.status, action),
      last_action: action,
      last_action_date: bill.last_action_date || bill.status_date || undefined,
      current_committee:
        bill.committee?.name ||
        (typeof bill.committee === "string" ? bill.committee : null) ||
        committeeFromAction(action) ||
        undefined,
      url: bill.state_link || bill.url || undefined,
      extra: {
        change_hash: bill.change_hash || null,
        pending_committee_id: bill.pending_committee_id || null,
      },
    });
  }
  return rows;
}

function withoutUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function billRow(incoming, existing, importedAt) {
  const existingPayload = existing?.payload && typeof existing.payload === "object"
    ? existing.payload
    : {};
  const payload = withoutUndefined({
    ...existingPayload,
    ...incoming,
    extra: {
      ...(existingPayload.extra && typeof existingPayload.extra === "object"
        ? existingPayload.extra
        : {}),
      ...incoming.extra,
    },
  });
  const actionDate = Date.parse(incoming.last_action_date || "");
  return {
    state: STATE,
    session_id: incoming.session_id,
    bill_number: incoming.bill_number,
    legiscan_id: incoming.legiscan_id,
    payload,
    source_updated_at: Number.isFinite(actionDate)
      ? new Date(actionDate).toISOString()
      : importedAt,
    imported_at: importedAt,
  };
}

async function syncBillsForSession(database, config, session, importedAt) {
  const [masterResponse, existingRows] = await Promise.all([
    legiscanRequest(config.legiscanKey, "getMasterList", { id: session.session_id }),
    readAll(database, "civic_bills", "bill_number,legiscan_id,payload", {
      filters: [["state", "eq", STATE], ["session_id", "eq", session.session_id]],
    }),
  ]);
  const incoming = normalizeMasterList(masterResponse?.masterlist, session);
  const existingByNumber = new Map(existingRows.map((row) => [row.bill_number, row]));
  const changed = incoming.filter((bill) => {
    const existingHash = existingByNumber.get(bill.bill_number)?.payload?.extra?.change_hash;
    return !existingHash || !bill.extra.change_hash || existingHash !== bill.extra.change_hash;
  });
  const rows = changed.map((bill) => billRow(bill, existingByNumber.get(bill.bill_number), importedAt));
  await upsertBatches(database, "civic_bills", rows, "state,session_id,bill_number");
  return { total: incoming.length, written: rows.length };
}

let officialToken = null;
let officialTokenExpiresAt = 0;

async function getOfficialToken() {
  if (officialToken && Date.now() < officialTokenExpiresAt) return officialToken;
  const milliseconds = Date.now();
  const key = createHash("sha512")
    .update(LEGIS_GA_TOKEN_SALT + LEGIS_GA_TOKEN_KEY + LEGIS_GA_TOKEN_CONST + milliseconds)
    .digest("hex");
  const response = await fetch(
    `${LEGIS_GA_API_BASE}/authentication/token?key=${key}&ms=${milliseconds}`,
  );
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Georgia General Assembly token request failed (${response.status})`);
  }
  officialToken = raw.trim().replace(/^"|"$/g, "");
  officialTokenExpiresAt = milliseconds + 4.5 * 60 * 1000;
  return officialToken;
}

async function officialRequest(path, retry = true) {
  const token = await getOfficialToken();
  const response = await fetch(`${LEGIS_GA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 && retry) {
    officialToken = null;
    officialTokenExpiresAt = 0;
    return officialRequest(path, false);
  }
  return parseResponse(response, `Georgia General Assembly ${path}`);
}

function providerSession(row) {
  const id = Number(row?.id ?? row?.sessionId ?? row?.session_id ?? row?.value ?? row?.key);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const label = [row?.description, row?.name, row?.sessionName, row?.library]
    .filter(Boolean)
    .join(" ");
  const years = [...label.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  const start = Number(row?.yearStart ?? row?.year_start ?? row?.startYear) || years[0] || null;
  const end = Number(row?.yearEnd ?? row?.year_end ?? row?.endYear) || years[1] || years[0] || null;
  const specialValue = row?.special ?? row?.isSpecial ?? row?.is_special;
  const special = specialValue == null
    ? /\bspecial\b/i.test(label)
    : specialValue === true || Number(specialValue) === 1;
  return { id, start, end, special, label, library: String(row?.library || "") };
}

export function matchProviderSession(session, directory) {
  const providerSessions = (Array.isArray(directory?.sessions) ? directory.sessions : [])
    .map(providerSession)
    .filter(Boolean);
  const exact = providerSessions.filter(
    (provider) =>
      provider.start === session.year_start &&
      provider.end === session.year_end &&
      provider.special === session.special,
  );
  if (exact.length === 1) return exact[0];
  const current = providerSessions.find((provider) => provider.id === Number(directory?.sessionId));
  if (
    current &&
    !session.special &&
    current.start === session.year_start &&
    current.end === session.year_end
  ) {
    return current;
  }
  return null;
}

function officialSessionId(meeting) {
  const value =
    meeting?.sessionId ??
    meeting?.session_id ??
    meeting?.legislativeSessionId ??
    meeting?.legislative_session_id ??
    meeting?.session?.id ??
    meeting?.session?.sessionId;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function meetingRow(meeting, session, provider, existing, importedAt) {
  const start = meeting.start || meeting.start_time || importedAt;
  const startDate = new Date(start);
  const end = meeting.end || meeting.end_time || new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
  const subject = String(meeting.subject || meeting.title || "Legislative Event").trim();
  const agendaUrl = /^https?:\/\//i.test(String(meeting.agendaUri || meeting.agenda_url || ""))
    ? String(meeting.agendaUri || meeting.agenda_url).replace(/^http:\/\//i, "https://")
    : null;
  const rawId = String(meeting.id).replace(/^legis-/, "");
  const publicId = `legis-${rawId}`;
  const date = startDate;
  const scheduleDate = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  const previousData = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const normalized = {
    ...previousData,
    id: publicId,
    title: subject,
    description: String(meeting.body || meeting.description || "").trim(),
    start_time: start,
    end_time: end,
    all_day: meeting.isTbd === true,
    location: String(meeting.location || "").trim(),
    classification: /floor session/i.test(subject) ? "Floor Session" : "Committee Meeting",
    chamber: meeting.chamber ?? null,
    videoUrl: meeting.livestreamUrl || meeting.video_url || null,
    agendaUrl,
    scheduleUrl: `https://www.legis.ga.gov/schedule/all?start=${scheduleDate}&end=${scheduleDate}`,
    willBroadcast: Boolean(meeting.willBroadcast),
    isVimeo: Boolean(meeting.isVimeo),
    provider_session_id: officialSessionId(meeting) || provider.id,
    session_label: provider.label || session.session_name,
    is_special_session: session.special,
    agendaBills: previousData.agendaBills || previousData.bills || [],
    _source: "legis-ga",
  };
  return {
    state: STATE,
    session_id: session.session_id,
    id: `${STATE}:${session.session_id}:${publicId}`,
    legis_id: Number.isFinite(Number(rawId)) ? Number(rawId) : null,
    title: normalized.title,
    description: normalized.description || null,
    start_time: normalized.start_time,
    end_time: normalized.end_time,
    all_day: normalized.all_day,
    color: meeting.color || null,
    location: normalized.location || null,
    classification: normalized.classification,
    chamber: normalized.chamber,
    video_url: normalized.videoUrl,
    agenda_url: normalized.agendaUrl,
    schedule_url: normalized.scheduleUrl,
    will_broadcast: normalized.willBroadcast,
    is_vimeo: normalized.isVimeo,
    data: normalized,
    source_updated_at: importedAt,
    imported_at: importedAt,
  };
}

function meetingRange(session, hasStoredMeetings, now = new Date()) {
  const sessionStart = new Date(Date.UTC(session.year_start || now.getUTCFullYear(), 0, 1));
  const sessionEnd = new Date(Date.UTC(session.year_end || now.getUTCFullYear(), 11, 31));
  const rollingStart = new Date(now);
  rollingStart.setUTCDate(rollingStart.getUTCDate() - 45);
  const rollingEnd = new Date(now);
  rollingEnd.setUTCDate(rollingEnd.getUTCDate() + 365);
  return {
    start: hasStoredMeetings && rollingStart > sessionStart ? rollingStart : sessionStart,
    end: rollingEnd < sessionEnd ? rollingEnd : sessionEnd,
  };
}

function meetingDate(value) {
  return (value instanceof Date ? value : new Date(value)).toDateString();
}

async function syncMeetingsForSession(database, session, directory, importedAt) {
  const provider = matchProviderSession(session, directory);
  if (!provider) {
    return { written: 0, warning: "No exact official Georgia session mapping" };
  }
  const hasStoredMeetings = await hasRows(database, "civic_meetings", [
    ["state", "eq", STATE],
    ["session_id", "eq", session.session_id],
  ]);
  const { start, end } = meetingRange(session, hasStoredMeetings);
  const existingRows = await readAll(database, "civic_meetings", "id,data", {
    filters: [["state", "eq", STATE], ["session_id", "eq", session.session_id]],
  });
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const meetings = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 30);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    const params = new URLSearchParams({
      startDate: meetingDate(cursor),
      endDate: meetingDate(chunkEnd),
    });
    const data = await officialRequest(`/meetings?${params}`);
    for (const meeting of Array.isArray(data) ? data : []) {
      const meetingSessionId = officialSessionId(meeting);
      if (meetingSessionId && meetingSessionId !== provider.id) continue;
      meetings.push(meeting);
    }
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const deduplicated = [...new Map(meetings.map((meeting) => [String(meeting.id), meeting])).values()];
  const rows = deduplicated.map((meeting) => {
    const id = `${STATE}:${session.session_id}:legis-${String(meeting.id).replace(/^legis-/, "")}`;
    return meetingRow(meeting, session, provider, existingById.get(id), importedAt);
  });
  await upsertBatches(database, "civic_meetings", rows, "state,session_id,id");
  return { written: rows.length, warning: null };
}

function sessionRow(session, stored, importedAt, completed = null) {
  return {
    state: STATE,
    session_id: session.session_id,
    session_name: session.session_name,
    year_start: session.year_start,
    year_end: session.year_end,
    is_special: session.special,
    is_prior: session.prior,
    is_sine_die: session.sine_die,
    bill_count: completed?.total ?? (Number(stored?.bill_count) || 0),
    dataset_hash: completed ? session.dataset_hash : stored?.dataset_hash || null,
    source_updated_at: completed ? importedAt : stored?.source_updated_at || null,
    imported_at: importedAt,
  };
}

export async function runIndependentSync() {
  const config = getConfig();
  const database = { url: config.supabaseUrl, key: config.supabaseKey };
  const importedAt = new Date().toISOString();
  const sessionResponse = await legiscanRequest(config.legiscanKey, "getSessionList", {
    state: STATE,
  });
  const sessions = normalizeSessions(sessionResponse?.sessions);
  if (!sessions.length) throw new Error("LegiScan returned no Georgia sessions.");

  const storedSessions = await readAll(database, "civic_sessions", "*", {
    filters: [["state", "eq", STATE]],
  });
  const storedById = new Map(storedSessions.map((session) => [Number(session.session_id), session]));
  const activeIds = activeSessionIds(sessions);
  const planned = sessions.filter((session) =>
    shouldRefreshSession(session, storedById.get(session.session_id), activeIds),
  );

  await upsertBatches(
    database,
    "civic_sessions",
    sessions.map((session) => sessionRow(session, storedById.get(session.session_id), importedAt)),
    "state,session_id",
  );

  console.log(
    `LegiScan returned ${sessions.length} Georgia sessions; refreshing ${planned.length} and preserving ${sessions.length - planned.length} stored archives.`,
  );

  let billsSeen = 0;
  let billsWritten = 0;
  for (const session of planned) {
    const result = await syncBillsForSession(database, config, session, importedAt);
    billsSeen += result.total;
    billsWritten += result.written;
    await upsertBatches(
      database,
      "civic_sessions",
      [sessionRow(session, storedById.get(session.session_id), importedAt, result)],
      "state,session_id",
    );
    console.log(
      `Bills ${session.session_id} (${session.session_name}): ${result.total} checked, ${result.written} updated.`,
    );
  }

  let meetingsWritten = 0;
  const meetingWarnings = [];
  if (config.syncMeetings) {
    const directory = await officialRequest("/committees/details/87");
    for (const session of sessions.filter((entry) => activeIds.has(entry.session_id))) {
      const result = await syncMeetingsForSession(database, session, directory, importedAt);
      meetingsWritten += result.written;
      if (result.warning) meetingWarnings.push(`${session.session_name}: ${result.warning}`);
      console.log(
        `Meetings ${session.session_id} (${session.session_name}): ${result.written} refreshed${result.warning ? `; ${result.warning}` : ""}.`,
      );
    }
  }

  const summary = {
    completedAt: importedAt,
    sessionsChecked: sessions.length,
    sessionsRefreshed: planned.length,
    archivedSessionsPreserved: sessions.length - planned.length,
    billsChecked: billsSeen,
    billsWritten,
    meetingsWritten,
    meetingWarnings,
  };
  console.log(`Independent CivicPulse sync complete: ${JSON.stringify(summary)}`);
  return summary;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runIndependentSync().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
