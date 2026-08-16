import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="CivicPulse home">CIVICPULSE</Link>
        <div className="nav-links">
          <Link href="/citizen">Report an issue</Link>
          <Link className="nav-dashboard" href="/dashboard">Policymaker dashboard</Link>
        </div>
      </nav>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <p className="landing-kicker">CIVIC INTELLIGENCE, MADE PRACTICAL</p>
          <h1 id="landing-title">Turn local voices into better public priorities.</h1>
          <p className="landing-lede">CivicPulse brings together citizen reports, local civic signals, and clear evidence so communities and decision-makers can focus on what matters most.</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/citizen">Report a civic issue <span aria-hidden="true">→</span></Link>
            <Link className="secondary-action" href="/dashboard">Policymaker dashboard <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <aside className="signal-card" aria-label="How CivicPulse works">
          <p className="signal-card-label">FROM SIGNAL TO ACTION</p>
          <ol>
            <li><span>01</span><div><b>Listen</b><p>Capture civic issues from the people closest to them.</p></div></li>
            <li><span>02</span><div><b>Understand</b><p>AI structures reports into usable, local civic signals.</p></div></li>
            <li><span>03</span><div><b>Prioritize</b><p>Evidence-backed scoring makes trade-offs transparent.</p></div></li>
          </ol>
        </aside>
      </section>
      <section className="landing-proof" aria-label="CivicPulse principles">
        <div><p className="proof-number">AI-assisted</p><p>Turns unstructured reports into organized civic input.</p></div>
        <div><p className="proof-number">Signal-led</p><p>Connects citizen experience with local context and demand.</p></div>
        <div><p className="proof-number">Evidence-backed</p><p>Shows the factors behind each recommended priority.</p></div>
      </section>
      <section className="landing-footer-cta">
        <div><p className="landing-kicker">A SHARED VIEW OF WHAT NEEDS ATTENTION</p><h2>Make every civic signal count.</h2></div>
        <Link className="text-action" href="/citizen">Start with an issue <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
