import Link from "next/link";
import { ArrowUpRight, CalendarDays, Swords, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { FORMAT_LABELS, formatDay } from "@/lib/format";
import { gameName } from "@/lib/games";
import type { Tournament } from "@/lib/platform-types";

export function TournamentCard({ tournament, index = 0 }: { tournament: Tournament; index?: number }) {
  const fill = Math.min(100, Math.round((tournament.entryCount / Math.max(tournament.capacity, 1)) * 100));
  const full = tournament.entryCount >= tournament.capacity;
  const cta = tournament.status === "registration_open" ? (full ? "Full" : "Register") : tournament.status === "live" ? "Watch" : tournament.status === "completed" ? "Results" : "Details";
  return (
    <article className="tournament-card" style={{ "--accent": tournament.accent, "--i": index } as React.CSSProperties}>
      <div className="card-art">
        <div className="card-art-top">
          <Badge status={tournament.status} />
          <span className="badge">{tournament.teamSize > 1 ? `${tournament.teamSize}v${tournament.teamSize}` : "Solo"}</span>
        </div>
        <span className="card-art-word">{gameName(tournament.game)}</span>
      </div>
      <div className="card-body">
        <h3><Link href={`/tournaments/${tournament.slug}`}>{tournament.name}</Link></h3>
        <div className="meta">
          <span><CalendarDays size={14} />{formatDay(tournament.startsAt)}</span>
          <span><Swords size={14} />{FORMAT_LABELS[tournament.format] ?? tournament.format}</span>
          <span><Users size={14} />{tournament.entryCount}/{tournament.capacity}</span>
        </div>
        <div className="progress" role="progressbar" aria-label="Slots filled" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${fill}%` }} /></div>
        <div className="card-foot">
          <div><span className="prize-label">Prize pool</span><span className="prize-value">{tournament.prizeLabel}</span></div>
          <span className="card-cta" aria-hidden="true">{cta} <ArrowUpRight size={16} /></span>
        </div>
      </div>
    </article>
  );
}
