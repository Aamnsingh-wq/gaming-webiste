import Link from "next/link";
import { ArrowRight, Coins, Crown, GitBranch, ShieldCheck, Trophy, Users } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { Avatar, EmptyState } from "@/components/ui";
import { getLeaderboards, getPlatformStats, getTournamentFeed } from "@/lib/data/public";
import { formatNumber } from "@/lib/format";
import { GAMES } from "@/lib/games";
import { getViewer } from "@/lib/supabase/server";

export default async function HomePage() {
  const [feed, stats, boards, viewer] = await Promise.all([getTournamentFeed(), getPlatformStats(), getLeaderboards(5), getViewer()]);
  const active = feed.tournaments.filter((item) => item.status !== "completed");
  const featured = active.find((item) => item.status === "live") ?? active.find((item) => item.status === "registration_open") ?? active[0];
  const perGame = new Map<string, number>();
  for (const item of active) perGame.set(item.game, (perGame.get(item.game) ?? 0) + 1);
  const topPlayers = boards.players.slice(0, 5);

  return (
    <main>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true"><div className="hero-grid" /><div className="hero-orb one" /><div className="hero-orb two" /></div>
        <div className="container hero-inner">
          <div>
            <p className="hero-kicker reveal"><i className="pulse" aria-hidden="true" />{active.some((item) => item.status === "live") ? "Matches live now" : "Season registrations open"}</p>
            <h1 className="reveal reveal-2">Compete.<br /><span className="gradient-text">Conquer.</span><br />Get paid in glory.</h1>
            <p className="lead reveal reveal-3">Community tournaments for BGMI, VALORANT, Brawl Stars, Free Fire, and Minecraft. Verified brackets, real rankings, and rewards for every match you play.</p>
            <div className="hero-actions reveal reveal-4">
              <Link className="btn btn-primary" href="/tournaments">Browse tournaments <ArrowRight size={17} /></Link>
              <Link className="btn btn-neon" href={viewer ? "/dashboard" : "/register"}>{viewer ? "Open Player HQ" : "Create player card"}</Link>
            </div>
            <div className="hero-stats reveal reveal-4">
              <div><strong>{formatNumber(stats.players)}</strong><span>Players</span></div>
              <div><strong>{formatNumber(stats.teams)}</strong><span>Teams</span></div>
              <div><strong>{formatNumber(stats.tournaments)}</strong><span>Tournaments</span></div>
              <div><strong>{GAMES.length}</strong><span>Games</span></div>
            </div>
          </div>
          {featured && <div className="hero-feature reveal reveal-3"><TournamentCard tournament={featured} /></div>}
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...GAMES, ...GAMES, ...GAMES, ...GAMES].map((game, index) => (
            <span className="marquee-item" key={`${game.slug}-${index}`} style={{ "--item-accent": game.accent } as React.CSSProperties}><i />{game.name}</span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><p className="eyebrow">The competition board</p><h2 className="section-title">Open tournaments</h2></div>
            <Link className="link" href="/tournaments">View all <ArrowRight size={16} /></Link>
          </div>
          {feed.error && <p className="notice notice-error" style={{ marginBottom: 20 }}>{feed.error}</p>}
          {active.length ? (
            <div className="tournament-grid">{active.slice(0, 6).map((tournament, index) => <TournamentCard key={tournament.id} tournament={tournament} index={index} />)}</div>
          ) : (
            <EmptyState icon={Trophy} title="No open tournaments yet">The next season is being drafted. Create your account now and you&apos;ll be ready when registration opens.</EmptyState>
          )}
          {feed.source === "preview" && <p className="notice notice-info" style={{ marginTop: 20 }}>Preview data — connect Supabase to publish live events and accept registrations.</p>}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><p className="eyebrow">Five worlds, one ladder</p><h2 className="section-title">Choose your battlefield</h2></div></div>
          <div className="game-tiles">
            {GAMES.map((game) => (
              <Link key={game.slug} className="game-tile" href={`/tournaments?game=${game.slug}`} style={{ "--accent": game.accent } as React.CSSProperties}>
                <span className="badge">{game.genre}</span>
                <div><span className="count">{String(perGame.get(game.slug) ?? 0).padStart(2, "0")}</span><h3>{game.name}</h3><span className="faint" style={{ fontSize: 13 }}>active events</span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid-2" style={{ alignItems: "start", gap: 28 }}>
          <div>
            <p className="eyebrow">Hall of fame</p>
            <h2 className="section-title">Top of the ladder</h2>
            <p className="lead">Rankings update from verified match results and awarded points. Every win moves you up.</p>
            <div className="feature-list" style={{ gridTemplateColumns: "1fr", marginTop: 28 }}>
              <div className="feature"><span className="feature-icon"><GitBranch size={20} /></span><div><h3>Live brackets</h3><p>Seeded single-elimination brackets with automatic byes and winner advancement.</p></div></div>
              <div className="feature"><span className="feature-icon"><ShieldCheck size={20} /></span><div><h3>Verified results</h3><p>Admins confirm every result with evidence before it counts.</p></div></div>
              <div className="feature"><span className="feature-icon"><Coins size={20} /></span><div><h3>Rewards that matter</h3><p>Earn points for placements and redeem them in the rewards vault.</p></div></div>
            </div>
          </div>
          <div className="card panel-glow">
            <div className="spread" style={{ marginBottom: 8 }}><h3 className="card-title" style={{ margin: 0 }}><Crown size={18} style={{ verticalAlign: "-3px", color: "var(--amber)", marginRight: 8 }} />Top players</h3><Link className="link" href="/leaderboard">Full board <ArrowRight size={15} /></Link></div>
            {topPlayers.length ? (
              <ol className="list">
                {topPlayers.map((player, index) => (
                  <li key={player.player_id} className="list-item">
                    <span className="who"><span className="rank-cell" style={{ width: 28, color: index === 0 ? "var(--amber)" : undefined }}>{index + 1}</span><Avatar name={player.display_name || player.username} src={player.avatar_url} /><span style={{ minWidth: 0 }}><span className="who-name" style={{ display: "block" }}>{player.display_name || player.username}</span><span className="who-sub">@{player.username} · {player.match_wins} wins</span></span></span>
                    <span className="amount-plus">{formatNumber(player.points_earned)} pts</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={Users} title="The ladder is empty">Be the first name on the board — results appear as soon as matches are verified.</EmptyState>
            )}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <p className="eyebrow">Squad up</p>
            <h2>Bring your people. <span className="gradient-text">Build a legacy.</span></h2>
            <p className="lead">Create a team, invite your roster, and register for team events with one click as captain.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={viewer ? "/teams" : "/register"}>{viewer ? "Manage your team" : "Get started free"} <ArrowRight size={17} /></Link>
              <Link className="btn btn-ghost" href="/teams">Browse teams</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
