import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, Crown, Trophy, Users } from "lucide-react";
import { InviteForm, RosterAction } from "@/components/team-controls";
import { Avatar, Badge, EmptyState, Stat } from "@/components/ui";
import { getTeamBySlug, getTeamDirectory } from "@/lib/data/public";
import { formatDay } from "@/lib/format";
import { gameAccent, gameName, gameTeamMax } from "@/lib/games";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await getTeamBySlug((await params).slug);
  return team ? { title: team.name, description: `${team.name} — ${gameName(team.game)} team on ARENA.` } : { title: "Team not found" };
}

export default async function TeamProfilePage({ params }: Props) {
  const { slug } = await params;
  const [team, viewer, directory] = await Promise.all([getTeamBySlug(slug), getViewer(), getTeamDirectory()]);
  if (!team) notFound();
  const stats = directory.find((entry) => entry.team_id === team.id);
  const isCaptain = viewer?.id === team.captainId;
  const isMember = Boolean(viewer && team.roster.some((member) => member.playerId === viewer.id));
  const rosterMax = gameTeamMax(team.game);

  let pendingInvites: { id: string; username: string }[] = [];
  if (isCaptain) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.from("team_invitations").select("id, invitee:invited_player_id(username)").eq("team_id", team.id).eq("status", "pending")) ?? { data: [] };
    pendingInvites = (data ?? []).map((row) => { const invitee = Array.isArray(row.invitee) ? row.invitee[0] : row.invitee; return { id: row.id, username: (invitee as { username: string } | null)?.username ?? "player" }; });
  }

  return (
    <main>
      <section className="team-banner" style={{ "--accent": gameAccent(team.game) } as React.CSSProperties}>
        <div className="container">
          <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/teams">Teams</Link><ChevronRight size={14} /><span>{team.name}</span></nav>
          <div className="profile-head">
            {team.logoUrl ? <Avatar name={team.name} src={team.logoUrl} size="xl" /> : <span className="team-logo" aria-hidden="true">{team.name[0]?.toUpperCase()}</span>}
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ marginBottom: 10 }}><span className="badge" style={{ color: gameAccent(team.game), borderColor: "currentColor" }}>{gameName(team.game)}</span>{isMember && <Badge status="captain" label={isCaptain ? "You captain this team" : "Your team"} />}</div>
              <h1 className="page-title" style={{ overflowWrap: "anywhere" }}>{team.name}</h1>
              <p className="faint" style={{ marginTop: 8 }}>Founded {formatDay(team.createdAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="container page">
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          <Stat icon={Users} label="Roster" value={`${team.roster.length}/${rosterMax}`} />
          <Stat icon={Trophy} label="Match wins" value={stats?.match_wins ?? 0} accent="var(--lime)" />
          <Stat icon={CalendarDays} label="Events played" value={stats?.tournaments_played ?? 0} accent="var(--violet)" />
        </div>

        <div className="layout-sidebar">
          <div className="stack" style={{ gap: 24 }}>
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 18 }}>Roster</h2>
              <div className="roster">
                {team.roster.map((member) => (
                  <div className="roster-card" key={member.playerId}>
                    <Avatar name={member.displayName} src={member.avatarUrl} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="who-name">{member.displayName}{member.role === "captain" && <Crown size={14} style={{ color: "var(--amber)", marginLeft: 6, verticalAlign: "-2px" }} aria-label="Captain" />}</div>
                      <div className="who-sub">@{member.username}</div>
                    </div>
                    {isCaptain && member.role !== "captain" && <RosterAction teamId={team.id} playerId={member.playerId} mode="remove" label={member.displayName} />}
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: 12 }}>Tournament history</h2>
              {team.history.length ? (
                <ul className="list">{team.history.map((entry) => (
                  <li key={entry.tournamentId} className="list-item"><span><Link className="title link" href={`/tournaments/${entry.slug}`}>{entry.name}</Link><span className="sub" style={{ display: "block" }}>{formatDay(entry.startsAt)}</span></span><Badge status={entry.status} /></li>
                ))}</ul>
              ) : <EmptyState icon={Trophy} title="No tournaments yet">Approved team entries will appear here.</EmptyState>}
            </section>
          </div>

          {isMember && (
            <aside className="stack" style={{ gap: 20 }}>
              {isCaptain && (
                <div className="card panel-glow stack">
                  <h2 className="card-title">Recruit players</h2>
                  {team.roster.length >= rosterMax ? <p className="notice notice-info">Your roster is full for {gameName(team.game)}.</p> : <InviteForm teamId={team.id} />}
                  {pendingInvites.length > 0 && <div><p className="faint" style={{ fontSize: 13, marginBottom: 8 }}>Pending invitations</p><div className="row">{pendingInvites.map((invite) => <span key={invite.id} className="badge badge-pending">@{invite.username}</span>)}</div></div>}
                </div>
              )}
              <div className="card stack">
                <h2 className="card-title">Team settings</h2>
                {isCaptain
                  ? team.roster.length > 1
                    ? <p className="faint" style={{ fontSize: 14 }}>Remove other members before you can disband the team.</p>
                    : <RosterAction teamId={team.id} playerId={viewer!.id} mode="disband" label={team.name} />
                  : <RosterAction teamId={team.id} playerId={viewer!.id} mode="leave" label={team.name} />}
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
