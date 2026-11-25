import type { Metadata } from "next";
import { Suspense } from "react";
import { TournamentBrowser } from "@/components/tournament-browser";
import { PageHeader } from "@/components/ui";
import { getTournamentFeed } from "@/lib/data/public";

export const metadata: Metadata = { title: "Tournaments", description: "Browse open, live, and completed community esports tournaments." };

export default async function TournamentsPage() {
  const feed = await getTournamentFeed();
  return (
    <main className="page container">
      <PageHeader eyebrow="Compete" title={<>Find your next <span className="gradient-text">bracket</span></>} lead="Filter by game and status. Solo cups and team events, all with verified results." />
      {feed.error && <p className="notice notice-error" style={{ marginBottom: 20 }}>{feed.error}</p>}
      {feed.source === "preview" && <p className="notice notice-info" style={{ marginBottom: 20 }}>Preview data — connect Supabase to publish real events.</p>}
      <Suspense fallback={<div className="skeleton" style={{ height: 420 }} />}>
        <TournamentBrowser tournaments={feed.tournaments} />
      </Suspense>
    </main>
  );
}
