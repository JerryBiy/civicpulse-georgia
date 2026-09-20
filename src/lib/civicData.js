import { supabase } from "./supabase";
import { demoBills, demoMeetings, demoSessions } from "../data/demo";

const text = (value) => String(value ?? "").trim();

function normalizeBill(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row;
  const compactNumber = text(payload.bill_number).replace(/\s+/g, "").toUpperCase();
  const displayNumber = compactNumber.replace(/^([A-Z]+)(\d)/, "$1 $2");
  const title = text(payload.title) || "Untitled legislation";
  const extra = payload.extra && typeof payload.extra === "object" ? payload.extra : {};
  return {
    ...payload,
    id: `GA:${payload.session_id}:${compactNumber}`,
    bill_number: displayNumber,
    title,
    short_title: text(extra.short_title) || title,
    summary: text(payload.summary || extra.summary) || title,
    why_it_matters:
      text(extra.why_it_matters) ||
      "This proposal could change Georgia law or public policy. Review the official text for its complete legal effect.",
    next_step:
      text(extra.next_step) ||
      (payload.current_committee
        ? `The ${payload.current_committee} committee may decide whether the proposal advances.`
        : "The General Assembly may schedule additional action."),
    chamber: text(payload.chamber) || (compactNumber.startsWith("S") ? "Senate" : "House"),
    sponsors: Array.isArray(payload.sponsors)
      ? payload.sponsors.map((sponsor) => sponsor.name || sponsor).filter(Boolean)
      : [payload.sponsor].filter(Boolean),
    topic: inferTopic(title, payload.current_committee),
    stage: inferStage(payload.status, payload.last_action),
    official_url: payload.url || "https://www.legis.ga.gov/legislation/all",
  };
}

function inferTopic(title, committee) {
  const source = `${title} ${committee}`.toLowerCase();
  if (/school|education|student|teacher/.test(source)) return "Education";
  if (/health|medical|insurance|hospital/.test(source)) return "Healthcare";
  if (/home|housing|tenant|property/.test(source)) return "Housing";
  if (/tax|budget|revenue|appropriation/.test(source)) return "Taxes & Budget";
  if (/election|vote|ballot/.test(source)) return "Elections";
  if (/road|transport|vehicle|transit/.test(source)) return "Transportation";
  if (/crime|police|public safety/.test(source)) return "Public Safety";
  if (/environment|water|energy|natural resource/.test(source)) return "Environment";
  return "Government & Community";
}

function inferStage(status, action) {
  const source = `${status} ${action}`.toLowerCase();
  if (/signed|became law|act /.test(source)) return 5;
  if (/governor|sent to/.test(source)) return 4;
  if (/passed|adopted/.test(source)) return 3;
  if (/committee|referred/.test(source)) return 2;
  return 1;
}

function normalizeMeeting(row) {
  const stored = row?.data && typeof row.data === "object" ? row.data : {};
  const chamberValue = stored.chamber || row.chamber;
  const chamber = chamberValue === 1 || chamberValue === "1"
    ? "House"
    : chamberValue === 2 || chamberValue === "2"
      ? "Senate"
      : chamberValue === 3 || chamberValue === "3"
        ? "Joint"
        : text(chamberValue);
  return {
    ...row,
    ...stored,
    id: stored.id || row.id,
    title: stored.title || row.title || "Legislative meeting",
    committee: stored.committeeName || stored.committee || row.title,
    agenda_url: stored.agendaUrl || row.agenda_url,
    video_url: stored.videoUrl || row.video_url,
    chamber,
    bills: (stored.agendaBills || stored.bills || []).map((bill) =>
      text(bill.bill_number || bill.identifier || bill),
    ),
  };
}

export async function loadCivicData() {
  if (!supabase) return demoBundle("demo");

  try {
    const { data: sessions, error: sessionsError } = await supabase.rpc(
      "get_civic_sessions",
      { p_state: "GA" },
    );
    if (sessionsError || !sessions?.length) throw sessionsError || new Error("No public sessions available");

    const active = sessions.find((session) => !session.is_prior) || sessions[0];
    const [{ data: bills, error: billsError }, { data: meetings, error: meetingsError }] =
      await Promise.all([
        supabase.rpc("get_civic_bills", {
          p_state: "GA",
          p_session_id: active.session_id,
          p_limit: 300,
          p_offset: 0,
          p_search: null,
          p_chamber: null,
        }),
        supabase.rpc("get_civic_meetings", {
          p_state: "GA",
          p_session_id: active.session_id,
          p_start: null,
          p_end: null,
        }),
      ]);
    if (billsError) throw billsError;
    if (meetingsError) console.warn("Public meetings are unavailable", meetingsError);

    return {
      source: "live",
      sessions,
      bills: (bills || []).map(normalizeBill),
      meetings: (meetings || []).map(normalizeMeeting),
    };
  } catch (error) {
    console.warn("CivicPulse public data API unavailable; using demo content.", error);
    return demoBundle("demo");
  }
}

function demoBundle(source) {
  return {
    source,
    sessions: demoSessions,
    bills: demoBills,
    meetings: demoMeetings,
  };
}
