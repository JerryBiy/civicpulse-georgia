import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadCivicData } from "../lib/civicData";

const CivicContext = createContext(null);
const FOLLOWING_KEY = "civicpulse:following";
const TOPICS_KEY = "civicpulse:topics";

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function CivicProvider({ children }) {
  const [data, setData] = useState({ source: "loading", sessions: [], bills: [], meetings: [] });
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [following, setFollowing] = useState(() => readList(FOLLOWING_KEY));
  const [topics, setTopics] = useState(() => readList(TOPICS_KEY));

  useEffect(() => {
    let active = true;
    loadCivicData().then((next) => {
      if (!active) return;
      setData(next);
      setSelectedSessionId((current) => current || next.sessions[0]?.session_id || null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
  }, [following]);

  useEffect(() => {
    localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
  }, [topics]);

  const visibleBills = useMemo(
    () => data.bills.filter((bill) => Number(bill.session_id) === Number(selectedSessionId)),
    [data.bills, selectedSessionId],
  );
  const visibleMeetings = useMemo(
    () => data.meetings.filter((meeting) => Number(meeting.session_id) === Number(selectedSessionId)),
    [data.meetings, selectedSessionId],
  );
  const selectedSession = data.sessions.find(
    (session) => Number(session.session_id) === Number(selectedSessionId),
  );

  const toggleFollowing = (billId) => {
    setFollowing((current) =>
      current.includes(billId) ? current.filter((id) => id !== billId) : [...current, billId],
    );
  };
  const toggleTopic = (topic) => {
    setTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic],
    );
  };

  const value = {
    ...data,
    isLoading: data.source === "loading",
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    bills: visibleBills,
    meetings: visibleMeetings,
    allBills: data.bills,
    following,
    isFollowing: (billId) => following.includes(billId),
    toggleFollowing,
    topics,
    toggleTopic,
  };

  return <CivicContext.Provider value={value}>{children}</CivicContext.Provider>;
}

export function useCivic() {
  const context = useContext(CivicContext);
  if (!context) throw new Error("useCivic must be used inside CivicProvider");
  return context;
}
