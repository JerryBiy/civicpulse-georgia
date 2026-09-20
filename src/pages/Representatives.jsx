import { ArrowRight, ExternalLink, Landmark, LockKeyhole, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function Representatives() {
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    if (address.trim()) setSubmitted(true);
  };

  return (
    <div className="page-container page-pad representatives-page">
      <section className="representatives-hero">
        <div><span className="eyebrow light"><MapPin size={15} /> Representation starts where you live</span><h1>Find your Georgia lawmakers</h1><p>Your address determines your state House and Senate districts. CivicPulse will always use an official lookup for this information.</p></div>
        <form className="address-card" onSubmit={submit}>
          <label htmlFor="address">Home address</label>
          <div><MapPin size={19} /><input id="address" value={address} onChange={(event) => { setAddress(event.target.value); setSubmitted(false); }} placeholder="Street, city, ZIP code" autoComplete="street-address" /><button type="submit">Find my district</button></div>
          <p><LockKeyhole size={14} /> This preview does not transmit or store your address.</p>
        </form>
      </section>

      {submitted ? (
        <section className="lookup-result">
          <div className="lookup-icon"><ShieldCheck /></div>
          <div><span className="eyebrow">Official district lookup</span><h2>Continue with the Georgia General Assembly</h2><p>To avoid giving you the wrong representatives, Version 1 sends district lookup to Georgia’s official tool. Direct in-app results are planned after an authoritative address API is connected.</p><a className="button primary" href="https://www.legis.ga.gov/find-my-legislator" target="_blank" rel="noreferrer">Open official lookup <ExternalLink size={16} /></a></div>
        </section>
      ) : (
        <section className="representatives-empty"><Landmark size={40} /><h2>Your representatives will appear here</h2><p>Enter an address above to begin the official district lookup.</p></section>
      )}

      <section className="what-youll-see"><div><span className="eyebrow">Built for accountability</span><h2>Everything in one understandable profile</h2></div><div className="profile-features"><article><strong>Sponsored bills</strong><p>See the proposals each lawmaker introduced.</p></article><article><strong>Recent votes</strong><p>Understand how they voted on legislation you follow.</p></article><article><strong>Committee work</strong><p>Learn which policy areas they help oversee.</p></article><article><strong>Contact details</strong><p>Use official channels to share your perspective.</p></article></div><a className="text-link" href="https://www.legis.ga.gov/members" target="_blank" rel="noreferrer">Browse all Georgia legislators <ArrowRight size={16} /></a></section>
    </div>
  );
}
