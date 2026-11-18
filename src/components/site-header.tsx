import Link from "next/link";
import { ArrowUpRight, Crosshair } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link aria-label="Arena home" className="brand" href="/">
        <span className="brand-mark"><Crosshair size={19} strokeWidth={2.5} /></span>
        <span>ARENA<span className="brand-dot">.</span></span>
      </Link>
      <nav aria-label="Main navigation" className="main-nav">
        <a href="#tournaments">Tournaments</a>
        <a href="#games">Games</a>
        <a href="#rankings">Rankings</a>
        <Link href="/teams">Teams</Link>
        <Link href="/rewards">Rewards</Link>
        <Link href="/store">Store</Link>
      </nav>
      <div className="header-actions">
        <Link className="header-login" href="/login">Log in</Link>
        <Link className="button button-small" href="/register">Join the arena <ArrowUpRight size={15} /></Link>
      </div>
    </header>
  );
}