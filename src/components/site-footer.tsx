import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { GAMES } from "@/lib/games";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link className="brand" href="/"><BrandMark /></Link>
            <p className="muted" style={{ marginTop: 14, maxWidth: 320, fontSize: 14 }}>Community-run esports. Fair brackets, verified results, and rewards for every match you show up for.</p>
          </div>
          <div>
            <h4>Compete</h4>
            <ul>
              <li><Link href="/tournaments">Tournaments</Link></li>
              <li><Link href="/leaderboard">Leaderboard</Link></li>
              <li><Link href="/teams">Teams</Link></li>
            </ul>
          </div>
          <div>
            <h4>Games</h4>
            <ul>{GAMES.map((game) => <li key={game.slug}><Link href={`/tournaments?game=${game.slug}`}>{game.name}</Link></li>)}</ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              <li><Link href="/dashboard">Player HQ</Link></li>
              <li><Link href="/rewards">Rewards</Link></li>
              <li><Link href="/store">Store</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ARENA Community. All rights reserved.</span>
          <span className="mono">Built by players, for players.</span>
        </div>
      </div>
    </footer>
  );
}
