import { CalendarDays, ExternalLink, MapPin, Play, ScrollText } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

export default function CalendarPage() {
  const { meetings, allBills } = useCivic();
  const [chamber, setChamber] = useState("All");
  const filtered = meetings.filter((meeting) => chamber === "All" || meeting.chamber === chamber);
  const grouped = useMemo(() => filtered.reduce((result, meeting) => {
    const day = meeting.start_time.slice(0, 10);
    result[day] = [...(result[day] || []), meeting];
    return result;
  }, {}), [filtered]);
  const billMap = new Map(allBills.map((bill) => [bill.bill_number.replace(/\s+/g, ""), bill]));

  return (
    <div className="page-container page-pad">
      <div className="page-heading calendar-heading">
        <div><span className="eyebrow">Public meetings</span><h1>Georgia legislative calendar</h1><p>See what is being heard, where to watch, and which bills are on the agenda.</p></div>
        <a className="button secondary" href="https://www.legis.ga.gov/" target="_blank" rel="noreferrer">Official calendar <ExternalLink size={16} /></a>
      </div>

      <div className="calendar-filters" role="group" aria-label="Filter meetings by chamber">
        {["All", "House", "Senate", "Joint"].map((item) => <button key={item} className={chamber === item ? "active" : ""} onClick={() => setChamber(item)}>{item}</button>)}
      </div>

      <div className="agenda-list">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayMeetings]) => (
          <section key={day} className="agenda-day">
            <div className="agenda-date"><span>{format(parseISO(`${day}T12:00:00`), "EEE")}</span><strong>{format(parseISO(`${day}T12:00:00`), "d")}</strong><small>{format(parseISO(`${day}T12:00:00`), "MMM")}</small></div>
            <div className="agenda-day-events">
              {dayMeetings.map((meeting) => (
                <article key={meeting.id} className="agenda-event">
                  <div className="agenda-event-header"><div><span className={`chamber-pill ${meeting.chamber?.toLowerCase()}`}>{meeting.chamber}</span><span className="meeting-time">{format(parseISO(meeting.start_time), "h:mm a")}</span></div><span className="meeting-type">{meeting.classification}</span></div>
                  <h2>{meeting.title}</h2>
                  <p className="location-line"><MapPin size={15} /> {meeting.location || "Location not posted"}</p>
                  <div className="agenda-bills"><strong><ScrollText size={16} /> Bills on agenda</strong>{meeting.bills?.length ? <div>{meeting.bills.map((number) => { const bill = billMap.get(number.replace(/\s+/g, "")); return bill ? <Link key={number} to={`/bills/${encodeURIComponent(bill.id)}`}>{number}</Link> : <span key={number}>{number}</span>; })}</div> : <p>No bill agenda has been posted.</p>}</div>
                  <div className="event-actions">{meeting.agenda_url && <a href={meeting.agenda_url} target="_blank" rel="noreferrer">View agenda <ExternalLink size={14} /></a>}{meeting.video_url && <a href={meeting.video_url} target="_blank" rel="noreferrer"><Play size={14} /> Watch meeting</a>}</div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!filtered.length && <div className="empty-state"><CalendarDays size={34} /><h2>No meetings found</h2><p>Try another chamber or check the official Georgia calendar.</p></div>}
      </div>
    </div>
  );
}
