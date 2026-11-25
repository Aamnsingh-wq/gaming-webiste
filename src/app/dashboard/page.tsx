import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Coins, Gamepad2, LogOut, Shield, Swords, Trophy } from "lucide-react";
import { GameAccountLinker, MarkAllRead, ProfileEditor } from "@/components/dashboard-controls";
import { InvitationControls } from "@/components/team-controls";
import { Avatar, Badge, EmptyState, Stat } from "@/components/ui";
import { formatDay, formatNumber, formatRelative } from "@/lib/format";
import { gameName } from "@/lib/games";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Player HQ" };

const first = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <main className="page container"><EmptyState icon={Shield} title="Supabase not connected" action={<Link className="btn btn-primary" href="/">Back home</Link>}>Add the project URL and anon key to enable player accounts.</EmptyState></main>;
  }
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/dashboard");
  const id = viewer.id;

  const [profile, registrations, entryCount, accounts, membership, invitations, ledger, notifications] = await Promise.all([
    supabase.from("profiles").select("bio, created_at").eq("id", id).maybeSingle(),
    supabase.from("tournament_registrations").select("id, status, created_at, tournament:tournament_id(name, slug, starts_at, status)").eq("player_id", id).order("created_at", { ascending: false }).limit(6),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("player_id", id).in("status", ["pending", "approved"]),
    supabase.from("connected_game_accounts").select("id, game_username, external_player_id, verification_status, game:game_id(slug)").eq("player_id", id).order("created_at"),
    supabase.from("team_members").select("role, team:team_id(name, slug)").eq("player_id", id).maybeSingle(),
    supabase.from("team_invitations").select("id, team:team_id(name, slug)").eq("invited_player_id", id).eq("status", "pending"),
    supabase.from("point_transactions").select("id, kind, amount, description, created_at").eq("player_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id, title, body, read_at, created_at").eq("player_id", id).order("created_at", { ascending: false }).limit(8),
  ]);

  type TournamentJoin = { name: string; slug: string; starts_at: string; status: string };
  type TeamJoin = { name: string; slug: string };
  const team = membership.data ? { role: membership.data.role as string, ...first(membership.data.team as TeamJoin | TeamJoin[] | null) } : null;
  const unread = (notifications.data ?? []).filter((item) => !item.read_at).length;

  return (
    <main className="page container">
      <div className="spread reveal" style={{ marginBottom: 32 }}>
        <div className="profile-head">
          <Avatar name={viewer.displayName} src={viewer.avatarUrl} size="xl" />
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Player HQ</p>
            <h1 className="page-title">{viewer.displayName}</h1>
            <p className="faint">@{viewer.username}{profile.data?.created_at ? ` · joined ${formatDay(profile.data.created_at)}` : ""}</p>
          </div>
        </div>
        <div className="row">
          {viewer.isAdmin && <Link className="btn btn-neon" href="/admin"><Shield size={16} />Admin panel</Link>}
          <Link className="btn btn-primary" href="/tournaments"><Swords size={16} />Find a match</Link>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost" type="submit"><LogOut size={16} />Log out</button></form>
        </div>
      </div>

      <div className="stat-grid reveal reveal-2" style={{ marginBottom: 32 }}>
        <Stat icon={Coins} label="Reward points" value={formatNumber(viewer.points)} accent="var(--lime)" />
        <Stat icon={Trophy} label="Active entries" value={entryCount.count ?? 0} />
        <Stat icon={Gamepad2} label="Linked games" value={accounts.data?.length ?? 0} accent="var(--violet)" />
        <Stat icon={Bell} label="Unread alerts" value={unread} accent="var(--magenta)" />
      </div>

      <div className="layout-sidebar">
        <div className="stack" style={{ gap: 24 }}>
          <section className="card">
            <div className="spread" style={{ marginBottom: 6 }}><h2 className="card-title" style={{ margin: 0 }}>Your tournaments</h2><Link className="link" href="/tournaments">Browse</Link></div>
            {registrations.data?.length ? (
              <ul className="list">{registrations.data.map((entry) => {
                const tournament = first(entry.tournament as TournamentJoin | TournamentJoin[] | null);
                return <li key={entry.id} className="list-item"><span>{tournament ? <Link className="title link" href={`/tournaments/${tournament.slug}`}>{tournament.name}</Link> : <span className="title">Tournament</span>}<span className="sub" style={{ display: "block" }}>{tournament ? `Starts ${formatDay(tournament.starts_at)}` : ""}</span></span><Badge status={entry.status} /></li>;
              })}</ul>
            ) : <EmptyState icon={Trophy} title="No entries yet" action={<Link className="btn btn-neon btn-sm" href="/tournaments">Find a tournament</Link>}>Your bracket is waiting.</EmptyState>}
          </section>

          <section className="card"><h2 className="card-title">Player profile</h2><p className="card-sub">This is how you appear on brackets and leaderboards.</p>
            <ProfileEditor username={viewer.username} displayName={viewer.displayName} bio={profile.data?.bio ?? ""} avatarUrl={viewer.avatarUrl ?? ""} />
          </section>

          <section className="card"><h2 className="card-title">Game accounts</h2><p className="card-sub">Linked accounts are verified by admins before verified-only events.</p>
            {accounts.data?.length ? (
              <ul className="list" style={{ marginBottom: 20 }}>{accounts.data.map((account) => (
                <li key={account.id} className="list-item"><span><span className="title">{account.game_username}</span><span className="sub" style={{ display: "block" }}>{gameName(first(account.game as { slug: string } | { slug: string }[] | null)?.slug)} · {account.external_player_id}</span></span><Badge status={account.verification_status} /></li>
              ))}</ul>
            ) : null}
            <GameAccountLinker />
          </section>
        </div>

        <aside className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="spread" style={{ marginBottom: 6 }}><h2 className="card-title" style={{ margin: 0 }}>Notifications</h2>{unread > 0 && <MarkAllRead />}</div>
            {notifications.data?.length ? (
              <ul className="list">{notifications.data.map((item) => (
                <li key={item.id} className="list-item" style={{ display: "block" }}><span className={`title ${item.read_at ? "" : "unread"}`} style={{ display: "block" }}>{item.title}</span><span className="sub">{item.body} · {formatRelative(item.created_at)}</span></li>
              ))}</ul>
            ) : <p className="faint" style={{ fontSize: 14 }}>You&apos;re all caught up.</p>}
          </section>

          <section className="card">
            <h2 className="card-title">Team</h2>
            {team?.slug ? (
              <div className="spread"><Link className="link" href={`/teams/${team.slug}`}>{team.name}</Link><Badge status={team.role} /></div>
            ) : <><p className="faint" style={{ fontSize: 14, marginBottom: 14 }}>You&apos;re not on a team yet.</p><Link className="btn btn-neon btn-sm" href="/teams">Create or join</Link></>}
            {invitations.data?.length ? (
              <ul className="list" style={{ marginTop: 12 }}>{invitations.data.map((invite) => { const invTeam = first(invite.team as TeamJoin | TeamJoin[] | null); return <li key={invite.id} className="list-item" style={{ alignItems: "start" }}><span className="title">{invTeam?.name ?? "Team"}</span><InvitationControls invitationId={invite.id} /></li>; })}</ul>
            ) : null}
          </section>

          <section className="card">
            <div className="spread" style={{ marginBottom: 6 }}><h2 className="card-title" style={{ margin: 0 }}>Points ledger</h2><Link className="link" href="/rewards">Spend</Link></div>
            {ledger.data?.length ? (
              <ul className="list">{ledger.data.map((entry) => {
                const credit = entry.kind === "award" || entry.kind === "refund";
                return <li key={entry.id} className="list-item"><span><span className="title" style={{ fontSize: 14 }}>{entry.description}</span><span className="sub" style={{ display: "block" }}>{formatRelative(entry.created_at)}</span></span><span className={credit ? "amount-plus" : "amount-minus"}>{credit ? "+" : "−"}{formatNumber(entry.amount)}</span></li>;
              })}</ul>
            ) : <p className="faint" style={{ fontSize: 14 }}>Earn points by placing in tournaments.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
