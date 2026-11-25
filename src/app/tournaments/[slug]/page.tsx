import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ListOrdered, Users } from "lucide-react";
import { Bracket } from "@/components/bracket";
import { Countdown } from "@/components/countdown";
import { RegistrationPanel, type RegistrationState } from "@/components/registration-panel";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { getTournamentBySlug } from "@/lib/data/public";
import { FORMAT_LABELS, formatDateTime, formatNumber } from "@/lib/format";
import { gameName } from "@/lib/games";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";
import type { TournamentDetail } from "@/lib/platform-types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tournament = await getTournamentBySlug((await params).slug);
  return tournament ? { title: tournament.name, description: `${gameName(tournament.game)} · ${FORMAT_LABELS[tournament.format]} · ${tournament.prizeLabel}` } : { title: "Tournament not found" };
}

async function viewerRegistration(tournament: TournamentDetail, viewerId: string | null): Promise<Pick<RegistrationState, "registration" | "captainTeam">> {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !viewerId || tournament.id.startsWith("preview-")) return { registration: null, captainTeam: null };
  const [solo, membership] = await Promise.all([
    supabase.from("tournament_registrations").select("id, status").eq("tournament_id", tournament.id).eq("player_id", viewerId).maybeSingle(),
    supabase.from("team_members").select("team_id, role, team:team_id(id, name, captain_id, game:games(slug))").eq("player_id", viewerId).maybeSingle(),
  ]);
  type TeamJoin = { id: string; name: string; captain_id: string; game: { slug: string } | { slug: string }[] | null };
  const rawTeam = membership.data?.team as TeamJoin | TeamJoin[] | null | undefined;
  const team = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam;
  const teamGame = team ? (Array.isArray(team.game) ? team.game[0] : team.game)?.slug : null;
  const bracketDrawn = tournament.matches.length > 0;
  const withdrawable = ["registration_open", "upcoming"].includes(tournament.status) && !bracketDrawn;

  let registration: RegistrationState["registration"] = solo.data ? { id: solo.data.id, status: solo.data.status, viaTeam: null, canWithdraw: withdrawable && ["pending", "approved"].includes(solo.data.status) } : null;
  let captainTeam: RegistrationState["captainTeam"] = null;
  if (team && teamGame === tournament.game) {
    const [teamEntry, roster] = await Promise.all([
      supabase.from("tournament_registrations").select("id, status").eq("tournament_id", tournament.id).eq("team_id", team.id).maybeSingle(),
      supabase.from("team_members").select("player_id", { count: "exact", head: true }).eq("team_id", team.id),
    ]);
    if (teamEntry.data && !registration) {
      registration = { id: teamEntry.data.id, status: teamEntry.data.status, viaTeam: team.name, canWithdraw: withdrawable && team.captain_id === viewerId && ["pending", "approved"].includes(teamEntry.data.status) };
    }
    if (team.captain_id === viewerId) captainTeam = { id: team.id, name: team.name, members: roster.count ?? 0 };
  }
  return { registration, captainTeam };
}

export default async function TournamentPage({ params }: Props) {
  const { slug } = await params;
  const [tournament, viewer] = await Promise.all([getTournamentBySlug(slug), getViewer()]);
  if (!tournament) notFound();
  const mine = await viewerRegistration(tournament, viewer?.id ?? null);
  const fill = Math.min(100, Math.round((tournament.entryCount / tournament.capacity) * 100));
  const state: RegistrationState = {
    tournamentId: tournament.id, slug: tournament.slug, status: tournament.status, teamSize: tournament.teamSize,
    full: tournament.entryCount >= tournament.capacity, closesAt: tournament.registrationClosesAt,
    preview: tournament.id.startsWith("preview-"), signedIn: Boolean(viewer), ...mine,
  };

  return (
    <main>
      <section className="event-hero" style={{ "--accent": tournament.accent } as React.CSSProperties}>
        <div className="container event-hero-inner">
          <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/tournaments">Tournaments</Link><ChevronRight size={14} /><span>{gameName(tournament.game)}</span></nav>
          <div className="row"><Badge status={tournament.status} /><span className="badge">{gameName(tournament.game)}</span><span className="badge">{tournament.teamSize > 1 ? `${tournament.teamSize}-player teams` : "Solo"}</span></div>
          <h1>{tournament.name}</h1>
          <div className="meta" style={{ fontSize: 15 }}><span>Starts {formatDateTime(tournament.startsAt)}</span><span>· {FORMAT_LABELS[tournament.format]}</span><span>· Prize: <strong style={{ color: "var(--lime)" }}>{tournament.prizeLabel}</strong></span></div>
        </div>
      </section>

      <div className="container page">
        <div className="layout-sidebar">
          <div className="stack" style={{ gap: 28 }}>
            {tournament.description && <section className="card"><h2 className="card-title">About this event</h2><p className="prose">{tournament.description}</p></section>}

            <section className="card">
              <div className="spread" style={{ marginBottom: 18 }}><h2 className="card-title" style={{ margin: 0 }}>Bracket</h2>{tournament.format !== "single_elimination" && <span className="badge">{FORMAT_LABELS[tournament.format]}</span>}</div>
              {tournament.format === "points" && tournament.standings.length ? (
                <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Entrant</th><th className="num">Score</th></tr></thead><tbody>
                  {tournament.standings.map((row) => <tr key={row.position}><td className="rank-cell">{row.position}</td><td>{row.href ? <Link className="link" href={row.href}>{row.name}</Link> : row.name}</td><td className="num">{formatNumber(row.score)}</td></tr>)}
                </tbody></table></div>
              ) : tournament.format === "points" ? (
                <EmptyState icon={ListOrdered} title="Standings not published yet">Points-race standings are published after each round of matches.</EmptyState>
              ) : (
                <Bracket matches={tournament.matches} entrants={tournament.entrants} />
              )}
            </section>

            <section className="card">
              <div className="spread" style={{ marginBottom: 18 }}><h2 className="card-title" style={{ margin: 0 }}>Confirmed entrants</h2><span className="badge">{tournament.entrants.length} approved</span></div>
              {tournament.entrants.length ? (
                <div className="entrant-grid">
                  {tournament.entrants.map((entrant) => (
                    <div className="entrant" key={entrant.registrationId}><Avatar name={entrant.name} src={entrant.avatarUrl} />{entrant.href ? <Link href={entrant.href}><span>{entrant.name}</span></Link> : <span>{entrant.name}</span>}</div>
                  ))}
                </div>
              ) : <EmptyState icon={Users} title="No confirmed entrants yet">Entries appear here once an admin approves them.</EmptyState>}
            </section>
          </div>

          <aside className="stack" style={{ gap: 20, position: "sticky", top: "calc(var(--header-h) + 20px)" }}>
            <div className="card panel-glow stack">
              {tournament.status === "registration_open" && <Countdown target={tournament.registrationClosesAt} label="Registration closes in" />}
              {(tournament.status === "upcoming") && <Countdown target={tournament.startsAt} label="Starts in" />}
              <div>
                <div className="spread" style={{ marginBottom: 8, fontSize: 14 }}><span className="muted">Slots filled</span><strong className="mono">{tournament.entryCount}/{tournament.capacity}</strong></div>
                <div className="progress" style={{ "--accent": tournament.accent } as React.CSSProperties}><i style={{ width: `${fill}%` }} /></div>
              </div>
              <RegistrationPanel state={state} />
            </div>
            <div className="card">
              <h2 className="card-title">Event details</h2>
              <dl className="fact-list">
                <div className="fact"><dt>Game</dt><dd>{gameName(tournament.game)}</dd></div>
                <div className="fact"><dt>Format</dt><dd>{FORMAT_LABELS[tournament.format]}</dd></div>
                <div className="fact"><dt>Team size</dt><dd>{tournament.teamSize}</dd></div>
                <div className="fact"><dt>Registration opens</dt><dd>{formatDateTime(tournament.registrationOpensAt)}</dd></div>
                <div className="fact"><dt>Registration closes</dt><dd>{formatDateTime(tournament.registrationClosesAt)}</dd></div>
                <div className="fact"><dt>Starts</dt><dd>{formatDateTime(tournament.startsAt)}</dd></div>
                <div className="fact"><dt>Prize</dt><dd style={{ color: "var(--lime)" }}>{tournament.prizeLabel}</dd></div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
