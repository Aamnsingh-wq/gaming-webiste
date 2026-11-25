import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { getLeaderboards } from "@/lib/data/public";
import { formatNumber } from "@/lib/format";
import { gameName } from "@/lib/games";

export const metadata: Metadata = { title: "Leaderboard", description: "Top players and teams ranked by verified wins and earned points." };

type Props = { searchParams: Promise<{ view?: string }> };
const PODIUM = [{ className: "second", label: "#2" }, { className: "first", label: "#1" }, { className: "third", label: "#3" }];

export default async function LeaderboardPage({ searchParams }: Props) {
  const view = (await searchParams).view === "teams" ? "teams" : "players";
  const { players, teams } = await getLeaderboards(100);

  return (
    <main className="page container">
      <PageHeader eyebrow="Rankings" title={<>The <span className="gradient-text">leaderboard</span></>} lead="Players are ranked by points earned, then verified match wins. Teams are ranked by match wins and events played." />
      <nav className="tabs" aria-label="Leaderboard type">
        <Link className="tab" href="/leaderboard" aria-current={view === "players" ? "page" : undefined}><Medal size={15} />Players</Link>
        <Link className="tab" href="/leaderboard?view=teams" aria-current={view === "teams" ? "page" : undefined}><Users size={15} />Teams</Link>
      </nav>

      {view === "players" ? (
        players.length ? (
          <>
            {players.length >= 3 && (
              <div className="podium">
                {[players[1], players[0], players[2]].map((player, index) => (
                  <div key={player.player_id} className={`podium-card ${PODIUM[index].className} reveal reveal-${index + 2}`}>
                    {index === 1 && <Crown size={26} style={{ color: "var(--amber)", position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }} />}
                    <Avatar name={player.display_name || player.username} src={player.avatar_url} size="lg" />
                    <div className="podium-rank">{PODIUM[index].label}</div>
                    <div className="podium-name">{player.display_name || player.username}</div>
                    <div className="faint" style={{ fontSize: 13 }}>@{player.username}</div>
                    <div className="podium-score">{formatNumber(player.points_earned)}<span className="faint" style={{ fontSize: 13, marginLeft: 6 }}>pts</span></div>
                  </div>
                ))}
              </div>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Rank</th><th>Player</th><th className="num">Points</th><th className="num">Wins</th><th className="num">Events</th></tr></thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr key={player.player_id}>
                      <td className="rank-cell" style={index < 3 ? { color: ["var(--amber)", "#c8d2e6", "#cd7f32"][index] } : undefined}>{index + 1}</td>
                      <td><span className="who"><Avatar name={player.display_name || player.username} src={player.avatar_url} /><span style={{ minWidth: 0 }}><span className="who-name" style={{ display: "block" }}>{player.display_name || player.username}</span><span className="who-sub">@{player.username}</span></span></span></td>
                      <td className="num" style={{ color: "var(--lime)" }}>{formatNumber(player.points_earned)}</td>
                      <td className="num">{player.match_wins}</td>
                      <td className="num">{player.tournaments_played}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <EmptyState icon={Trophy} title="No ranked players yet">Rankings appear once players are approved into tournaments and results are verified.</EmptyState>
      ) : teams.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Rank</th><th>Team</th><th>Game</th><th className="num">Wins</th><th className="num">Events</th><th className="num">Roster</th></tr></thead>
            <tbody>
              {teams.map((team, index) => (
                <tr key={team.team_id}>
                  <td className="rank-cell" style={index < 3 ? { color: ["var(--amber)", "#c8d2e6", "#cd7f32"][index] } : undefined}>{index + 1}</td>
                  <td><Link className="who" href={`/teams/${team.slug}`}><Avatar name={team.name} src={team.logo_url} /><span className="who-name">{team.name}</span></Link></td>
                  <td><span className="badge">{gameName(team.game_slug)}</span></td>
                  <td className="num">{team.match_wins}</td>
                  <td className="num">{team.tournaments_played}</td>
                  <td className="num">{team.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon={Users} title="No teams yet" action={<Link className="btn btn-neon" href="/teams">Create the first team</Link>}>Teams appear here as soon as they are created.</EmptyState>}
    </main>
  );
}
