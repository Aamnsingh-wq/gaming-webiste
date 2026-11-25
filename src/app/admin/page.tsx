import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BadgeCheck, ClipboardList, Coins, Gift, LayoutDashboard, Plus, ScrollText, Shield, Swords, Trophy, Users } from "lucide-react";
import { AwardPointsForm, CreateRewardForm, CreateTournamentForm, ReviewButtons, RewardToggle, TournamentActions, VerifyMatch } from "@/components/admin-controls";
import { Badge, EmptyState, Stat } from "@/components/ui";
import { getAdminOverview } from "@/lib/data/admin";
import { FORMAT_LABELS, formatDateTime, formatDay, formatNumber, formatRelative } from "@/lib/format";
import { gameName } from "@/lib/games";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";
import { isHttpUrl } from "@/lib/validation";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "registrations", label: "Registrations", icon: ClipboardList, badge: "pendingRegistrations" },
  { key: "matches", label: "Matches", icon: Swords, badge: "openMatches" },
  { key: "accounts", label: "Verifications", icon: BadgeCheck, badge: "pendingVerifications" },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "points", label: "Points", icon: Coins },
  { key: "audit", label: "Audit log", icon: ScrollText },
] as const;

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;
const first = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
type Named = { username?: string; display_name?: string | null; name?: string; slug?: string };
const entrantName = (player: Named | Named[] | null, team: Named | Named[] | null) => first(team)?.name ?? first(player)?.display_name ?? first(player)?.username ?? "Entrant";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!viewer.isAdmin) notFound();
  const requested = (await searchParams).tab;
  const tab = TABS.find((item) => item.key === requested)?.key ?? "overview";
  const overview = await getAdminOverview(supabase);

  return (
    <main className="page container">
      <div className="section-head reveal"><div><p className="eyebrow"><Shield size={13} />Admin control</p><h1 className="page-title">Operations</h1></div><Link className="btn btn-ghost" href="/dashboard">Player HQ</Link></div>
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Admin sections">
          {TABS.map((item) => {
            const badge = "badge" in item ? overview[item.badge] : 0;
            return <Link key={item.key} href={`/admin?tab=${item.key}`} aria-current={tab === item.key ? "page" : undefined}><span><item.icon size={16} />{item.label}</span>{badge > 0 && <span className="count">{badge}</span>}</Link>;
          })}
        </nav>
        <div className="stack" style={{ gap: 24, minWidth: 0 }}>
          {tab === "overview" && <OverviewTab overview={overview} />}
          {tab === "tournaments" && <TournamentsTab supabase={supabase} />}
          {tab === "registrations" && <RegistrationsTab supabase={supabase} />}
          {tab === "matches" && <MatchesTab supabase={supabase} />}
          {tab === "accounts" && <AccountsTab supabase={supabase} />}
          {tab === "rewards" && <RewardsTab supabase={supabase} />}
          {tab === "points" && <PointsTab supabase={supabase} />}
          {tab === "audit" && <AuditTab supabase={supabase} />}
        </div>
      </div>
    </main>
  );
}

function OverviewTab({ overview }: { overview: Overview }) {
  const queues = [
    { label: "registrations awaiting review", value: overview.pendingRegistrations, href: "/admin?tab=registrations" },
    { label: "matches awaiting a verified result", value: overview.openMatches, href: "/admin?tab=matches" },
    { label: "game accounts awaiting verification", value: overview.pendingVerifications, href: "/admin?tab=accounts" },
  ];
  return (
    <>
      <div className="stat-grid">
        <Stat icon={Users} label="Players" value={formatNumber(overview.players)} />
        <Stat icon={Shield} label="Teams" value={formatNumber(overview.teams)} accent="var(--violet)" />
        <Stat icon={Trophy} label="Active events" value={overview.activeTournaments} accent="var(--lime)" />
        <Stat icon={Trophy} label="Completed" value={overview.completedTournaments} accent="var(--text-3)" />
      </div>
      <section className="card panel-glow">
        <h2 className="card-title">Quick actions</h2>
        <p className="card-sub">Create an event, then open registration from the Tournaments tab so players can join.</p>
        <div className="row">
          <Link className="btn btn-primary" href="/admin?tab=tournaments#create"><Plus size={16} />Create tournament</Link>
          <Link className="btn btn-neon" href="/admin?tab=rewards">Add reward</Link>
          <Link className="btn btn-ghost" href="/admin?tab=points">Award points</Link>
        </div>
      </section>
      <section className="card"><h2 className="card-title">Action queue</h2>
        <ul className="list">{queues.map((queue) => <li key={queue.href} className="list-item"><span><strong style={{ fontFamily: "var(--font-display)", fontSize: 22, marginRight: 10, color: queue.value ? "var(--amber)" : "var(--text-3)" }}>{queue.value}</strong>{queue.label}</span><Link className="link" href={queue.href}>Open</Link></li>)}</ul>
      </section>
    </>
  );
}

async function TournamentsTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("tournaments").select("id, slug, name, status, format, starts_at, capacity, team_size, game:games(slug)").order("starts_at", { ascending: false }).limit(100);
  return (
    <>
      <details id="create" className="card details panel-glow" open><summary>Create a tournament <span className="badge">Starts as draft</span></summary><CreateTournamentForm /></details>
      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 18 }}>All tournaments</h2>
        {data?.length ? (
          <div className="table-wrap"><table className="table"><thead><tr><th>Event</th><th>Status</th><th>Starts</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead><tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td><Link className="who-name link" href={`/tournaments/${row.slug}`}>{row.name}</Link><div className="who-sub">{gameName(first(row.game as { slug: string } | { slug: string }[] | null)?.slug)} · {FORMAT_LABELS[row.format]} · {row.capacity} slots · team {row.team_size}</div></td>
                <td><Badge status={row.status} /></td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDay(row.starts_at)}</td>
                <td><TournamentActions id={row.id} status={row.status} format={row.format} /></td>
              </tr>
            ))}
          </tbody></table></div>
        ) : <EmptyState icon={Trophy} title="No tournaments yet">Create your first draft above, then click “Open registration”.</EmptyState>}
      </section>
    </>
  );
}

async function RegistrationsTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("tournament_registrations")
    .select("id, created_at, player:player_id(username, display_name), team:team_id(name, slug), tournament:tournament_id(name, slug, capacity)")
    .eq("status", "pending").order("created_at").limit(100);
  return (
    <section className="card">
      <h2 className="card-title" style={{ marginBottom: 18 }}>Pending registrations</h2>
      {data?.length ? (
        <ul className="list">{data.map((row) => {
          const tournament = first(row.tournament as { name: string; slug: string } | { name: string; slug: string }[] | null);
          return (
            <li key={row.id} className="list-item">
              <span><span className="title">{entrantName(row.player as Named | null, row.team as Named | null)}</span><span className="sub" style={{ display: "block" }}>{first(row.team as Named | null) ? "Team · " : "Solo · "}{tournament ? <Link className="link" href={`/tournaments/${tournament.slug}`}>{tournament.name}</Link> : "Tournament"} · {formatRelative(row.created_at)}</span></span>
              <ReviewButtons url={`/api/admin/registrations/${row.id}`} />
            </li>
          );
        })}</ul>
      ) : <EmptyState icon={ClipboardList} title="Queue is clear">No registrations are waiting for review.</EmptyState>}
    </section>
  );
}

async function MatchesTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("matches")
    .select("id, round_number, match_number, status, tournament:tournament_id(name, slug), a:participant_a(id, player:player_id(username, display_name), team:team_id(name)), b:participant_b(id, player:player_id(username, display_name), team:team_id(name))")
    .neq("status", "verified").not("participant_a", "is", null).not("participant_b", "is", null)
    .order("round_number").order("match_number").limit(100);
  type Side = { id: string; player: Named | Named[] | null; team: Named | Named[] | null };
  return (
    <section className="card">
      <h2 className="card-title">Matches ready for results</h2>
      <p className="card-sub">Only matches with both participants decided are listed. Verifying advances the winner automatically; the final completes the event.</p>
      {data?.length ? data.map((row) => {
        const a = first(row.a as Side | Side[] | null);
        const b = first(row.b as Side | Side[] | null);
        const tournament = first(row.tournament as { name: string; slug: string } | { name: string; slug: string }[] | null);
        if (!a || !b) return null;
        const nameA = entrantName(a.player, a.team);
        const nameB = entrantName(b.player, b.team);
        return (
          <div key={row.id} className="match-admin" style={{ gridTemplateColumns: "1fr" }}>
            <div className="spread"><span><strong>{nameA}</strong> <span className="faint">vs</span> <strong>{nameB}</strong></span><span className="faint" style={{ fontSize: 13 }}>{tournament?.name} · R{row.round_number} M{row.match_number}</span></div>
            <VerifyMatch matchId={row.id} a={{ id: a.id, name: nameA }} b={{ id: b.id, name: nameB }} />
          </div>
        );
      }) : <EmptyState icon={Swords} title="No matches waiting">Draw a bracket from the Tournaments tab to create matches.</EmptyState>}
    </section>
  );
}

async function AccountsTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("connected_game_accounts")
    .select("id, game_username, external_player_id, verification_status, verification_evidence, created_at, game:game_id(slug), player:player_id(username)")
    .in("verification_status", ["unverified", "pending"]).order("created_at").limit(100);
  return (
    <section className="card">
      <h2 className="card-title" style={{ marginBottom: 18 }}>Game account verifications</h2>
      {data?.length ? (
        <ul className="list">{data.map((row) => (
          <li key={row.id} className="list-item">
            <span><span className="title">{row.game_username} <span className="faint">({row.external_player_id})</span></span><span className="sub" style={{ display: "block" }}>{gameName(first(row.game as { slug: string } | { slug: string }[] | null)?.slug)} · @{first(row.player as Named | null)?.username} · {formatRelative(row.created_at)}{isHttpUrl(row.verification_evidence) && <> · <a className="link" href={row.verification_evidence} target="_blank" rel="noopener noreferrer nofollow">evidence</a></>}</span></span>
            <ReviewButtons url={`/api/admin/game-accounts/${row.id}`} approve="verified" />
          </li>
        ))}</ul>
      ) : <EmptyState icon={BadgeCheck} title="All accounts reviewed" />}
    </section>
  );
}

async function RewardsTab({ supabase }: { supabase: SupabaseClient }) {
  const [rewards, redemptions] = await Promise.all([
    supabase.from("rewards").select("id, name, points_cost, inventory, is_active").order("created_at", { ascending: false }),
    supabase.from("point_transactions").select("id, description, amount, created_at, player:player_id(username)").eq("kind", "redemption").order("created_at", { ascending: false }).limit(25),
  ]);
  return (
    <>
      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 18 }}>Reward catalogue</h2>
        {rewards.data?.length ? (
          <div className="table-wrap"><table className="table"><thead><tr><th>Reward</th><th className="num">Cost</th><th className="num">Stock</th><th>Status</th><th /></tr></thead><tbody>
            {rewards.data.map((row) => <tr key={row.id}><td className="who-name">{row.name}</td><td className="num">{formatNumber(row.points_cost)}</td><td className="num">{row.inventory ?? "∞"}</td><td><Badge status={row.is_active ? "live" : "draft"} label={row.is_active ? "Visible" : "Hidden"} live={false} /></td><td style={{ textAlign: "right" }}><RewardToggle id={row.id} active={row.is_active} /></td></tr>)}
          </tbody></table></div>
        ) : <p className="faint">No rewards yet.</p>}
      </section>
      <details className="card details"><summary>Publish a reward</summary><CreateRewardForm /></details>
      <section className="card">
        <h2 className="card-title">Recent redemptions (to fulfil)</h2>
        {redemptions.data?.length ? <ul className="list">{redemptions.data.map((row) => <li key={row.id} className="list-item"><span><span className="title">{row.description}</span><span className="sub" style={{ display: "block" }}>@{first(row.player as Named | null)?.username} · {formatDateTime(row.created_at)}</span></span><span className="amount-minus">−{formatNumber(row.amount)}</span></li>)}</ul> : <p className="faint">No redemptions yet.</p>}
      </section>
    </>
  );
}

async function PointsTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("point_transactions").select("id, kind, amount, description, created_at, player:player_id(username)").neq("kind", "redemption").order("created_at", { ascending: false }).limit(25);
  return (
    <>
      <section className="card"><h2 className="card-title">Award or adjust points</h2><p className="card-sub">Every change is written to the ledger and the player is notified. Duplicate submissions are ignored.</p><AwardPointsForm /></section>
      <section className="card"><h2 className="card-title">Recent ledger entries</h2>
        {data?.length ? <ul className="list">{data.map((row) => { const credit = row.kind !== "adjustment"; return <li key={row.id} className="list-item"><span><span className="title">{row.description}</span><span className="sub" style={{ display: "block" }}>@{first(row.player as Named | null)?.username} · {row.kind} · {formatRelative(row.created_at)}</span></span><span className={credit ? "amount-plus" : "amount-minus"}>{credit ? "+" : "−"}{formatNumber(row.amount)}</span></li>; })}</ul> : <p className="faint">No entries yet.</p>}
      </section>
    </>
  );
}

async function AuditTab({ supabase }: { supabase: SupabaseClient }) {
  const { data } = await supabase.from("audit_logs").select("id, action, entity_type, entity_id, changes, created_at, actor:actor_id(username)").order("created_at", { ascending: false }).limit(100);
  return (
    <section className="card">
      <h2 className="card-title" style={{ marginBottom: 18 }}>Audit log</h2>
      {data?.length ? (
        <div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>
          {data.map((row) => <tr key={row.id}><td style={{ whiteSpace: "nowrap" }}>{formatRelative(row.created_at)}</td><td>@{first(row.actor as Named | null)?.username ?? "system"}</td><td><span className="badge">{row.action}</span></td><td className="code">{row.entity_type} {row.entity_id?.slice(0, 8)} {Object.keys(row.changes ?? {}).length ? JSON.stringify(row.changes).slice(0, 120) : ""}</td></tr>)}
        </tbody></table></div>
      ) : <p className="faint">No audit entries yet.</p>}
    </section>
  );
}
