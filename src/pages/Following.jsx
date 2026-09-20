import { BellRing, Compass, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import BillCard from "../components/BillCard";
import TopicPicker from "../components/TopicPicker";
import { useCivic } from "../context/CivicContext";

export default function Following() {
  const { allBills, following, topics } = useCivic();
  const followedBills = allBills.filter((bill) => following.includes(bill.id));

  return (
    <div className="page-container page-pad">
      <div className="page-heading inline-heading">
        <div><span className="eyebrow">Your interests</span><h1>Following</h1><p>One place for the bills and issues you care about.</p></div>
        <div className="following-count"><BellRing size={20} /><strong>{followedBills.length}</strong><span>bill{followedBills.length === 1 ? "" : "s"}</span></div>
      </div>

      <TopicPicker title="Topics you follow" condensed />

      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">Saved legislation</span><h2>Your bills</h2></div><Link className="text-link" to="/explore"><Compass size={16} /> Find more</Link></div>
        {followedBills.length ? (
          <div className="results-list">{followedBills.map((bill) => <BillCard key={bill.id} bill={bill} />)}</div>
        ) : (
          <div className="empty-state"><Heart size={34} /><h2>No bills followed yet</h2><p>Follow a bill to keep it here and quickly see what changed.</p><Link className="button primary" to="/explore">Explore legislation</Link></div>
        )}
      </section>

      <section className="notification-preview"><div><span className="eyebrow light">Coming next</span><h2>Meaningful alerts, not noise</h2><p>Email and push alerts will focus on hearings, committee decisions, chamber votes, and governor action.</p></div><BellRing size={56} aria-hidden="true" /></section>
    </div>
  );
}
