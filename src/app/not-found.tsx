import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page container" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
      <div className="reveal">
        <p className="eyebrow" style={{ justifyContent: "center" }}>Error 404</p>
        <h1 className="page-title" style={{ fontSize: "clamp(64px, 14vw, 160px)" }}><span className="gradient-text">GG.</span></h1>
        <p className="lead" style={{ margin: "12px auto 28px" }}>This page was eliminated in an earlier round.</p>
        <div className="row" style={{ justifyContent: "center" }}><Link className="btn btn-primary" href="/">Back to base</Link><Link className="btn btn-ghost" href="/tournaments">Browse tournaments</Link></div>
      </div>
    </main>
  );
}
