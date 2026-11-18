"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronDown, Users } from "lucide-react";
import type { Tournament, TournamentResponse } from "@/lib/platform-types";

const gameLabels: Record<string, string> = {
  bgmi: "BGMI",
  "brawl-stars": "Brawl Stars",
  minecraft: "Minecraft",
  "free-fire": "Free Fire",
  valorant: "VALORANT",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function TournamentBrowser({ initialData }: { initialData: TournamentResponse }) {
  const [game, setGame] = useState("all");
  const [message, setMessage] = useState("");
  const tournaments = initialData.tournaments.filter((item) => game === "all" || item.game === game);

  async function register(tournament: Tournament) {
    setMessage("");
    if (initialData.source === "preview") {
      setMessage("Connect Supabase to enable registrations. Preview entries are not saved.");
      return;
    }
    const response = await fetch(`/api/tournaments/${tournament.id}/register`, { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? "Request sent. Your registration is pending review." : result.error);
  }

  return (
    <>
      <div className="tournament-toolbar">
        <div><p className="eyebrow">Pick your next fight</p><h2>Open registrations<span className="heading-count"> / {tournaments.length.toString().padStart(2, "0")}</span></h2></div>
        <label className="filter-select"><span className="sr-only">Filter by game</span><select value={game} onChange={(event) => setGame(event.target.value)}><option value="all">All games</option>{Object.entries(gameLabels).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}</select><ChevronDown size={16} /></label>
      </div>
      <div className="tournament-grid">
        {tournaments.map((tournament, index) => (
          <article className="tournament-card" key={tournament.id} style={{ "--card-accent": tournament.accent } as React.CSSProperties}>
            <div className="card-topline"><span className="game-label">{gameLabels[tournament.game] ?? tournament.game}</span><span className="open-indicator"><i /> OPEN</span></div>
            <div className={`game-art art-${tournament.game}`}><span className="art-index">0{index + 1}</span><span className="art-wordmark">{gameLabels[tournament.game]}</span></div>
            <div className="tournament-info"><h3>{tournament.name}</h3><div className="tournament-meta"><span><CalendarDays size={14} /> {formatDate(tournament.startsAt)}</span><span><Users size={14} /> {tournament.entryCount}/{tournament.capacity}</span></div>
              <div className="card-bottom"><div><span className="prize-caption">PRIZE POOL</span><strong>{tournament.prizeLabel}</strong></div><button className="icon-button" aria-label={`Register for ${tournament.name}`} onClick={() => void register(tournament)}><ArrowUpRight size={18} /></button></div>
            </div>
          </article>
        ))}
      </div>
      {message && <p className="form-notice" role="status">{message}</p>}
      {initialData.source === "preview" && <p className="preview-note">PREVIEW DATA <span>Connect Supabase to publish live events and accept registrations.</span> <Link href="/login">Configure account <ArrowUpRight size={13} /></Link></p>}
    </>
  );
}