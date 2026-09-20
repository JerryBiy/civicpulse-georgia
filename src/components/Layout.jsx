import {
  BookOpen,
  CalendarDays,
  Compass,
  Heart,
  Home,
  Landmark,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCivic } from "../context/CivicContext";

const navigation = [
  ["/", "Home", Home],
  ["/explore", "Explore", Compass],
  ["/following", "Following", Heart],
  ["/calendar", "Calendar", CalendarDays],
  ["/representatives", "Representatives", Landmark],
  ["/learn", "Learn", BookOpen],
];

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { source, selectedSession } = useCivic();

  const submitSearch = (event) => {
    event.preventDefault();
    const value = search.trim();
    navigate(value ? `/explore?q=${encodeURIComponent(value)}` : "/explore");
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="CivicPulse Georgia home">
            <span className="brand-mark" aria-hidden="true"><Landmark size={22} /></span>
            <span><strong>CivicPulse</strong><small>Georgia</small></span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.slice(0, 4).map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>
            ))}
          </nav>

          <form className="header-search" role="search" onSubmit={submitSearch}>
            <Search size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor="site-search">Search bills</label>
            <input
              id="site-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bills or topics"
            />
          </form>

          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <div className="context-bar">
          <div className="context-inner">
            <span className={`source-badge ${source}`}>{source === "live" ? "Official data" : source === "loading" ? "Loading" : "Preview data"}</span>
            <span className="session-label">Current session</span>
            <strong className="session-name">{selectedSession?.session_name || "Georgia General Assembly"}</strong>
            {selectedSession?.is_special && <span className="special-label">Special session</span>}
          </div>
        </div>

        {menuOpen && (
          <div className="mobile-menu">
            <form className="mobile-search" role="search" onSubmit={submitSearch}>
              <Search size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bills or topics" />
            </form>
            {navigation.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={() => setMenuOpen(false)}>
                <Icon size={19} /> {label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main id="main-content">{children}</main>

      <footer className="site-footer">
        <div>
          <Link to="/" className="footer-brand">CivicPulse Georgia</Link>
          <p>Georgia lawmaking, explained clearly.</p>
        </div>
        <div className="footer-links">
          <Link to="/learn">How it works</Link>
          <a href="https://www.legis.ga.gov/" target="_blank" rel="noreferrer">Official Georgia Legislature</a>
        </div>
        <p className="disclaimer">CivicPulse is an independent civic information tool. Official legislative records remain the source of truth.</p>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={20} /><span>{label === "Representatives" ? "My reps" : label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
