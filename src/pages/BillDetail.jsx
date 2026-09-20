import { ArrowLeft, Bell, BellRing, Calendar, ExternalLink, Landmark, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import StatusTimeline from "../components/StatusTimeline";
import { useCivic } from "../context/CivicContext";

export default function BillDetail() {
  const { billId } = useParams();
  const { allBills, isFollowing, toggleFollowing, isLoading } = useCivic();
  const bill = allBills.find((item) => item.id === decodeURIComponent(billId));

  if (isLoading) return <div className="page-container page-pad"><div className="detail-skeleton" /></div>;
  if (!bill) return <div className="page-container page-pad"><div className="empty-state"><h1>Bill not found</h1><p>This bill may belong to another session.</p><Link className="button primary" to="/explore">Explore legislation</Link></div></div>;

  const followed = isFollowing(bill.id);
  return (
    <div className="page-container page-pad bill-detail-page">
      <Link to="/explore" className="back-link"><ArrowLeft size={17} /> Back to legislation</Link>
      <header className="bill-detail-header">
        <div>
          <div className="bill-card-topline"><span className="bill-number">{bill.bill_number}</span><span className={`chamber-pill ${bill.chamber?.toLowerCase()}`}>{bill.chamber}</span><span className="topic-pill">{bill.topic}</span></div>
          <h1>{bill.short_title || bill.title}</h1>
          <p className="official-title">Official title: {bill.title}</p>
        </div>
        <button className={`button follow-large ${followed ? "active" : ""}`} onClick={() => toggleFollowing(bill.id)}>{followed ? <BellRing size={18} /> : <Bell size={18} />}{followed ? "Following" : "Follow this bill"}</button>
      </header>

      <section className="detail-card progress-card">
        <div className="detail-section-heading"><div><span className="eyebrow">Current status</span><h2>{bill.status || "Introduced"}</h2></div><span className="updated-label">Updated {bill.last_action_date || "recently"}</span></div>
        <StatusTimeline stage={bill.stage} />
        <div className="next-step"><strong>What happens next</strong><p>{bill.next_step}</p></div>
      </section>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-card"><span className="eyebrow">In plain language</span><h2>What this bill would do</h2><p className="lead-copy">{bill.summary}</p></section>
          <section className="detail-card impact-card"><span className="impact-icon">!</span><div><span className="eyebrow">Why it matters</span><h2>Potential impact</h2><p>{bill.why_it_matters}</p></div></section>
          <section className="detail-card"><span className="eyebrow">Recent activity</span><h2>Latest official action</h2><div className="action-entry"><span className="action-marker" /><div><strong>{bill.last_action || bill.status}</strong><p>{bill.last_action_date || "Date unavailable"}</p></div></div></section>
          <section className="detail-card source-card"><span className="eyebrow">Verify the details</span><h2>Official sources</h2><p>CivicPulse provides a plain-language overview. The Georgia General Assembly record is the source of truth.</p><a className="button secondary" href={bill.official_url} target="_blank" rel="noreferrer">View official bill record <ExternalLink size={16} /></a></section>
        </div>
        <aside className="detail-sidebar">
          <section className="detail-card fact-list"><h2>Bill details</h2><dl><div><dt><Landmark size={16} /> Chamber</dt><dd>{bill.chamber}</dd></div><div><dt><Users size={16} /> Sponsor{bill.sponsors?.length === 1 ? "" : "s"}</dt><dd>{bill.sponsors?.join(", ") || "Not listed"}</dd></div><div><dt><Landmark size={16} /> Committee</dt><dd>{bill.current_committee || "Not assigned"}</dd></div><div><dt><Calendar size={16} /> Last action</dt><dd>{bill.last_action_date || "Not available"}</dd></div></dl></section>
          <section className="ai-note"><strong>About this explanation</strong><p>Plain-language descriptions may be assisted by AI and should be checked against the official bill text.</p></section>
        </aside>
      </div>
    </div>
  );
}
