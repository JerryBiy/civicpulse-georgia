import { ArrowRight, Bell, BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

export default function BillCard({ bill, compact = false }) {
  const { isFollowing, toggleFollowing } = useCivic();
  const followed = isFollowing(bill.id);

  return (
    <article className={`bill-card ${compact ? "compact" : ""}`}>
      <div className="bill-card-topline">
        <span className="bill-number">{bill.bill_number}</span>
        <span className={`chamber-pill ${bill.chamber?.toLowerCase()}`}>{bill.chamber}</span>
        <span className="topic-pill">{bill.topic}</span>
      </div>
      <h3><Link to={`/bills/${encodeURIComponent(bill.id)}`}>{bill.short_title || bill.title}</Link></h3>
      {!compact && <p className="bill-summary">{bill.summary}</p>}
      <div className="status-row">
        <span className="status-dot" aria-hidden="true" />
        <span><strong>{bill.status || "Introduced"}</strong><small>{bill.last_action_date || "Date unavailable"}</small></span>
      </div>
      <div className="bill-card-actions">
        <button
          className={`follow-button ${followed ? "active" : ""}`}
          type="button"
          aria-pressed={followed}
          onClick={() => toggleFollowing(bill.id)}
        >
          {followed ? <BellRing size={17} /> : <Bell size={17} />}
          {followed ? "Following" : "Follow"}
        </button>
        <Link className="text-link" to={`/bills/${encodeURIComponent(bill.id)}`}>View bill <ArrowRight size={16} /></Link>
      </div>
    </article>
  );
}
