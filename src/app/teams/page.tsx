import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, Shield, Users } from "lucide-react";
import { InvitationControls, TeamCreator } from "@/components/team-controls";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { getTeamDirectory } from "@/lib/data/public";
import { gameAccent, gameName } from "@/lib/games";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teams", description: "Browse community teams or create your own squad." };

type TeamJoin = { name: string; slug: string };
const first = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

async function getMyTeamState(viewerId: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!supabase || !viewerId) return null;
  const [membership, invitations] = await Promise.all([
    supabase.from("team_members").select("role, team:team_id(name, slug)").eq("player_id", viewerId).maybeSingle(),
    supabase.from("team_invitations").select("id, created_at, team:team_id(name, slug)").eq("invited_player_id", viewerId).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  return {
    team: membership.data ? { role: membership.data.role as string, ...(first(membership.data.team as TeamJoin | TeamJoin[] | null) ?? { name: "Team", slug: "" }) } : null,
    invitations: (invitations.data ?? []).map((row) => ({ id: row.id, team: first(row.team as TeamJoin | TeamJoin[] | null) })),
  };
}

export default async function TeamsPage() {
  const viewer = await getViewer();
  const [teams, mine] = await Promise.all([getTeamDirectory(), getMyTeamState(viewer?.id ?? null)]);

  return (
    <main className="page container">
      <PageHeader eyebrow="Squads" title={<>Teams &amp; <span className="gradient-text">rosters</span></>} lead="Every team plays one game. Captains invite players and register the roster for team events." />

      <div className="layout-sidebar" style={{ marginBottom: 48 }}>
        <section>
          <div className="spread" style={{ marginBottom: 18 }}><h2 className="section-title" style={{ fontSize: 26 }}>All teams</h2><span className="badge">{teams.length} teams</span></div>
          {teams.length ? (
            <div className="grid-2">
              {teams.map((team) => (
                <Link key={team.team_id} href={`/teams/${team.slug}`} className="card card-hover" style={{ padding: 18 }}>
                  <div className="team-tile"><Avatar name={team.name} src={team.logo_url} size="lg" /><div style={{ minWidth: 0 }}><h3 style={{ fontSize: 19, overflowWrap: "anywhere" }}>{team.name}</h3><span className="badge" style={{ marginTop: 8, color: gameAccent(team.game_slug), borderColor: "currentColor" }}>{gameName(team.game_slug)}</span></div></div>
                  <div className="meta" style={{ marginTop: 14 }}><span><Users size={14} />{team.members} players</span><span>{team.match_wins} wins</span><span>{team.tournaments_played} events</span></div>
                </Link>
              ))}
            </div>
          ) : <EmptyState icon={Shield} title="No teams yet">Be the first captain on the platform.</EmptyState>}
        </section>

        <aside className="stack" style={{ gap: 20 }}>
          {!viewer ? (
            <div className="card panel-glow stack"><h2 className="card-title">Build your squad</h2><p className="muted">Log in to create a team or accept invitations.</p><Link className="btn btn-primary btn-block" href="/login?next=/teams">Log in</Link></div>
          ) : mine?.team ? (
            <div className="card panel-glow stack"><p className="eyebrow" style={{ margin: 0 }}>Your team</p><h2 className="card-title">{mine.team.name}</h2><p className="muted">You are the {mine.team.role} of this roster.</p><Link className="btn btn-neon btn-block" href={`/teams/${mine.team.slug}`}>Open team page <ArrowRight size={16} /></Link></div>
          ) : (
            <div className="card panel-glow"><h2 className="card-title">Create a team</h2><p className="card-sub">You can be on one team at a time.</p><TeamCreator /></div>
          )}
          {viewer && (
            <div className="card">
              <h2 className="card-title"><Mail size={17} style={{ verticalAlign: "-3px", marginRight: 8 }} />Invitations</h2>
              {mine?.invitations.length ? (
                <ul className="list">{mine.invitations.map((invite) => (
                  <li key={invite.id} className="list-item" style={{ alignItems: "start" }}><span className="title">{invite.team ? <Link className="link" href={`/teams/${invite.team.slug}`}>{invite.team.name}</Link> : "Team"}</span><InvitationControls invitationId={invite.id} /></li>
                ))}</ul>
              ) : <p className="faint" style={{ fontSize: 14 }}>No pending invitations.</p>}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
