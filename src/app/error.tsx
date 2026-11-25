"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page container" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <p className="eyebrow" style={{ justifyContent: "center" }}>Connection lost</p>
        <h1 className="page-title">Something went wrong.</h1>
        <p className="lead" style={{ margin: "12px auto 28px" }}>The server didn&apos;t respond as expected. Try again in a moment.</p>
        <div className="row" style={{ justifyContent: "center" }}><button className="btn btn-primary" type="button" onClick={reset}>Try again</button><Link className="btn btn-ghost" href="/">Home</Link></div>
      </div>
    </main>
  );
}
