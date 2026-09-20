import { ArrowRight, CalendarDays, MapPin, Search, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import BillCard from "../components/BillCard";
import TopicPicker from "../components/TopicPicker";
import { useCivic } from "../context/CivicContext";

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { bills, meetings, topics, isLoading, selectedSession } = useCivic();
  const featured = useMemo(() => {
    const personalized = topics.length ? bills.filter((bill) => topics.includes(bill.topic)) : bills;
    return (personalized.length ? personalized : bills).slice(0, 3);
  }, [bills, topics]);

  const submit = (event) => {
    event.preventDefault();
    navigate(query.trim() ? `/explore?q=${encodeURIComponent(query.trim())}` : "/explore");
  };

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow light"><Sparkles size={15} /> Georgia government, made understandable</span>
          <h1>Know what Georgia is deciding—and why it matters to you.</h1>
          <p>CivicPulse turns bills, votes, and hearings into clear explanations you can follow without being a policy expert.</p>
          <form className="hero-search" onSubmit={submit} role="search">
            <Search size={21} aria-hidden="true" />
            <label className="sr-only" htmlFor="hero-search">Search Georgia legislation</label>
            <input id="hero-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “property taxes,” “schools,” or “HB 90”" />
            <button type="submit">Search</button>
          </form>
          <div className="hero-trust">
            <span>Plain-language summaries</span><span>Official sources</span><span>Free to use</span>
          </div>
        </div>
        <div className="hero-brief" aria-label="Today's civic briefing">
          <div className="brief-header"><span>YOUR CIVIC BRIEF</span><span>{selectedSession?.session_name || "Georgia"}</span></div>
          <div className="brief-stat"><strong>{bills.length || "—"}</strong><span>bills available in this preview</span></div>
          <div className="brief-divider" />
          <h2>Start with what affects you</h2>
          <p>Follow issues, bills, and representatives. We’ll surface meaningful changes—not every procedural update.</p>
          <Link to="/representatives" className="brief-link"><MapPin size={17} /> Find my representatives <ArrowRight size={16} /></Link>
        </div>
      </section>

      <div className="page-container home-content">
        {topics.length === 0 && <TopicPicker />}

        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow">What’s moving</span><h2>{topics.length ? "Updates for your interests" : "Legislation to know"}</h2></div>
            <Link to="/explore" className="text-link">Explore all bills <ArrowRight size={17} /></Link>
          </div>
          {isLoading ? (
            <div className="loading-grid"><div /><div /><div /></div>
          ) : (
            <div className="bill-grid">{featured.map((bill) => <BillCard key={bill.id} bill={bill} />)}</div>
          )}
        </section>

        <section className="section-block soft-section">
          <div className="section-heading">
            <div><span className="eyebrow">Public meetings</span><h2>Hear the decisions being made</h2></div>
            <Link to="/calendar" className="text-link">Full calendar <ArrowRight size={17} /></Link>
          </div>
          <div className="meeting-preview-grid">
            {meetings.slice(0, 3).map((meeting) => (
              <article key={meeting.id} className="meeting-preview-card">
                <div className="meeting-date"><span>{format(parseISO(meeting.start_time), "MMM")}</span><strong>{format(parseISO(meeting.start_time), "d")}</strong></div>
                <div><span className="meeting-kicker">{meeting.chamber} · {format(parseISO(meeting.start_time), "h:mm a")}</span><h3>{meeting.title}</h3><p><MapPin size={14} /> {meeting.location || "Location not posted"}</p></div>
                <Link to="/calendar" aria-label={`View ${meeting.title}`}><ArrowRight size={19} /></Link>
              </article>
            ))}
          </div>
          {!meetings.length && <div className="empty-inline"><CalendarDays /> No meetings are available for this session yet.</div>}
        </section>

        <section className="how-it-works">
          <div><span className="eyebrow">New to the legislature?</span><h2>We explain each step.</h2><p>See where a proposal stands, what happens next, and what legislative terms mean.</p><Link className="button secondary" to="/learn">Learn how a bill becomes law</Link></div>
          <ol><li><span>1</span><strong>Discover</strong><small>Find bills by topic or number</small></li><li><span>2</span><strong>Understand</strong><small>Read a clear, sourced explanation</small></li><li><span>3</span><strong>Follow</strong><small>Save what matters to you</small></li></ol>
        </section>
      </div>
    </>
  );
}
