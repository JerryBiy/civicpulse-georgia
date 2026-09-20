import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { glossary } from "../data/demo";

const steps = [
  ["An idea becomes a bill", "A legislator works with Legislative Counsel to draft a proposal."],
  ["The bill is introduced", "It receives a bill number, is formally read, and is usually assigned to a committee."],
  ["A committee studies it", "Members may hear testimony, change the text, recommend passage, or hold the bill."],
  ["The first chamber votes", "If it passes, the proposal moves to the other chamber for a similar process."],
  ["The chambers agree", "Both chambers must approve the same text before it can go to the governor."],
  ["The governor acts", "The governor may sign or veto the bill. Some bills can become law without a signature."],
];

export default function Learn() {
  const [openTerm, setOpenTerm] = useState(glossary[0][0]);
  return (
    <div className="page-container page-pad learn-page">
      <div className="page-heading"><span className="eyebrow">Civic basics</span><h1>How Georgia lawmaking works</h1><p>A practical guide to the process, the people, and the words you will see.</p></div>

      <section className="process-section">
        <div className="section-heading"><div><span className="eyebrow">From proposal to law</span><h2>The journey of a Georgia bill</h2></div><a className="text-link" href="https://www.legis.ga.gov/legislation/about" target="_blank" rel="noreferrer">Read the official guide <ArrowRight size={16} /></a></div>
        <ol className="process-steps">{steps.map(([title, description], index) => <li key={title}><span className="process-number">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div>{index < steps.length - 1 && <span className="process-line" />}</li>)}</ol>
      </section>

      <section className="glossary-section">
        <div><span className="eyebrow">Words without the jargon</span><h2>Legislative glossary</h2><p>Open a term for a short, practical definition.</p></div>
        <div className="glossary-list">{glossary.map(([term, definition]) => { const open = openTerm === term; return <article key={term}><button type="button" aria-expanded={open} onClick={() => setOpenTerm(open ? null : term)}><span>{term}</span><span>{open ? "−" : "+"}</span></button>{open && <p>{definition}</p>}</article>; })}</div>
      </section>

      <section className="learn-cta"><BookOpen size={42} /><div><h2>Ready to follow a real proposal?</h2><p>Explore current bills and use the progress timeline to see these steps in action.</p></div><Link className="button light" to="/explore">Explore legislation <ArrowRight size={16} /></Link></section>

      <section className="trust-principles"><h2>How CivicPulse earns trust</h2><div><span><CheckCircle2 /> Links to official records</span><span><CheckCircle2 /> Clearly labeled preview and AI-assisted content</span><span><CheckCircle2 /> No party scores or passage predictions</span><span><CheckCircle2 /> Corrections should be visible and timestamped</span></div></section>
    </div>
  );
}
