export function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-visual" aria-hidden="true">
        <div className="hero-grid" />
        <h2>Every legend<br /><span className="gradient-text">starts unranked.</span></h2>
        <p>Join tournaments, build a squad, and climb a ladder that remembers every verified win.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-card reveal">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted" style={{ marginBottom: 28 }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
