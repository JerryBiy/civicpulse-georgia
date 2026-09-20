import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BillCard from "../components/BillCard";
import { civicTopics } from "../data/demo";
import { useCivic } from "../context/CivicContext";

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [topic, setTopic] = useState("All topics");
  const [chamber, setChamber] = useState("All chambers");
  const [status, setStatus] = useState("All statuses");
  const { bills, isLoading } = useCivic();

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "");
    return bills.filter((bill) => {
      const searchable = `${bill.bill_number} ${bill.title} ${bill.summary} ${bill.sponsors?.join(" ")}`.toLowerCase().replace(/\s+/g, "");
      return (!needle || searchable.includes(needle))
        && (topic === "All topics" || bill.topic === topic)
        && (chamber === "All chambers" || bill.chamber === chamber)
        && (status === "All statuses" || bill.status === status);
    });
  }, [bills, query, topic, chamber, status]);

  const clear = () => {
    setQuery(""); setTopic("All topics"); setChamber("All chambers"); setStatus("All statuses"); setParams({});
  };
  const statuses = [...new Set(bills.map((bill) => bill.status).filter(Boolean))];
  const filtered = query || topic !== "All topics" || chamber !== "All chambers" || status !== "All statuses";

  return (
    <div className="page-container page-pad">
      <div className="page-heading">
        <span className="eyebrow">Explore Georgia legislation</span>
        <h1>Find a bill that matters to you</h1>
        <p>Search by a bill number, everyday topic, sponsor, or phrase.</p>
      </div>

      <div className="explore-tools">
        <div className="large-search"><Search size={21} /><label className="sr-only" htmlFor="explore-search">Search legislation</label><input id="explore-search" value={query} onChange={(event) => { setQuery(event.target.value); setParams(event.target.value ? { q: event.target.value } : {}); }} placeholder="Search bills, topics, or sponsors" />{query && <button onClick={() => { setQuery(""); setParams({}); }} aria-label="Clear search"><X size={18} /></button>}</div>
        <div className="filter-row">
          <span><SlidersHorizontal size={17} /> Filter</span>
          <select aria-label="Filter by topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option>All topics</option>{civicTopics.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Filter by chamber" value={chamber} onChange={(event) => setChamber(event.target.value)}><option>All chambers</option><option>House</option><option>Senate</option></select>
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          {filtered && <button className="clear-filters" onClick={clear}>Clear all</button>}
        </div>
      </div>

      <div className="results-heading"><strong>{isLoading ? "Loading legislation…" : `${results.length} result${results.length === 1 ? "" : "s"}`}</strong><span>Sorted by most recent activity</span></div>
      <div className="results-list">
        {results.map((bill) => <BillCard key={bill.id} bill={bill} />)}
        {!isLoading && !results.length && <div className="empty-state"><Search size={32} /><h2>No matching legislation</h2><p>Try a broader phrase or remove one of the filters.</p><button className="button secondary" onClick={clear}>Clear filters</button></div>}
      </div>
    </div>
  );
}
