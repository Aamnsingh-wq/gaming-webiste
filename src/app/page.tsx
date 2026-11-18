import Link from "next/link";
import { ArrowDown, ArrowUpRight, Play, Radio, Trophy, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TournamentBrowser } from "@/components/tournament-browser";
import { previewTournaments } from "@/lib/preview-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tournament, TournamentResponse } from "@/lib/platform-types";

async function getTournamentData(): Promise<TournamentResponse> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { tournaments: previewTournaments, source: "preview" };

  const { data, error } = await supabase.from("tournaments").select("id, slug, name, game:games(slug), format, starts_at, registration_closes_at, capacity, prize_label, status, accent").in("status", ["registration_open", "upcoming", "live"]).order("starts_at", { ascending: true });
  if (error || !data?.length) return { tournaments: [], source: "supabase" };
  const ids = data.map((item) => item.id);
  const { data: registrations } = await supabase.from("tournament_registrations").select("tournament_id").in("tournament_id", ids);
  const counts = new Map<string, number>();
  for (const registration of registrations ?? []) counts.set(registration.tournament_id, (counts.get(registration.tournament_id) ?? 0) + 1);
  const tournaments: Tournament[] = data.map((item) => {
    const game = Array.isArray(item.game) ? item.game[0] : item.game;
    return { id: item.id, slug: item.slug, name: item.name, game: (game?.slug ?? "bgmi") as Tournament["game"], format: item.format, startsAt: item.starts_at, registrationClosesAt: item.registration_closes_at, entryCount: counts.get(item.id) ?? 0, capacity: item.capacity, prizeLabel: item.prize_label, status: item.status, accent: item.accent };
  });
  return { tournaments, source: "supabase" };
}

const games = ["BGMI", "Brawl Stars", "Minecraft", "Free Fire", "VALORANT"];

export default async function HomePage() {
  const tournamentData = await getTournamentData();
  return <><SiteHeader /><main><section className="hero"><div className="hero-grid" /><div className="hero-copy"><p className="hero-kicker"><span className="live-dot" /> COMMUNITY BUILT. COMPETITION READY.</p><h1>Play hard.<br /><span>Leave a mark.</span></h1><p className="hero-description">Your community is the competition. Enter the arena, find your squad, and make every match count.</p><div className="hero-actions"><Link className="button" href="#tournaments">Find your tournament <ArrowUpRight size={17} /></Link><Link className="hero-secondary" href="/register"><Play size={15} fill="currentColor" /> Create player account</Link></div><div className="hero-stats"><div><strong>05</strong><span>GAMES</span></div><div><strong>01</strong><span>COMMUNITY</span></div><div><strong>∞</strong><span>RIVALRIES</span></div></div></div><div className="hero-art" aria-label="Abstract tournament arena artwork"><div className="hero-ring ring-one" /><div className="hero-ring ring-two" /><div className="hero-cross">A</div><div className="hero-coordinate">19°04&apos;N<br />72°52&apos;E</div><div className="hero-vertical">ARENA / EST. MMXXVI</div><div className="hero-art-label"><span>COMMUNITY<br />MATCHMAKING</span><span>01 — 05</span></div></div><a className="scroll-hint" href="#tournaments"><ArrowDown size={15} /> SCOUT THE FIELD</a><div className="hero-index">01 <span>/</span> 04</div></section>
    <section className="tournaments-section section-wrap" id="tournaments"><div className="section-heading"><div><p className="eyebrow">THE COMPETITION BOARD</p><h2>Every match starts<br />with a <span>yes.</span></h2></div><p className="section-aside">Solo queue is over. Find a bracket, show up for your people, and earn your place on the board.</p></div><TournamentBrowser initialData={tournamentData} /></section>
    <section className="games-section" id="games"><div className="section-wrap games-inner"><div><p className="eyebrow">ONE COMMUNITY / FIVE WORLDS</p><h2>Choose your<br /><span>battlefield.</span></h2></div><div className="game-list">{games.map((game, index) => <div className="game-row" key={game}><span className="game-number">0{index + 1}</span><span>{game}</span><ArrowUpRight size={17} /></div>)}</div></div></section>
    <section className="community-section section-wrap" id="rankings"><div className="community-art"><div className="score-slab"><Trophy size={21} /><span>YOUR NEXT<br />W IS CLOSER.</span><strong>+ XP</strong></div><div className="community-stamp">PLAY / PROVE / REPEAT</div></div><div className="community-copy"><p className="eyebrow">MORE THAN A MATCH</p><h2>Bring your<br />people. <span>Build<br />your legacy.</span></h2><p>Make a team, track every finish, and turn community nights into a story worth telling. The ladder moves when you do.</p><div className="community-features"><span><Users size={16} /> TEAM PROFILES</span><span><Radio size={16} /> LIVE BRACKETS</span></div><Link className="button" href="/register">Make your player card <ArrowUpRight size={16} /></Link></div></section>
    <section className="rewards-strip" id="rewards"><div className="section-wrap rewards-inner"><p className="eyebrow">EVERY GAME COUNTS</p><h2>Show up. Stack points.<br /><span>Cash in your good work.</span></h2><Link className="button button-dark" href="/register">Get in the game <ArrowUpRight size={16} /></Link><div className="reward-sticker">PLAY<br />EARN<br />REPEAT</div></div></section>
    <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ARENA<span className="brand-dot">.</span></span></Link><p>Built by the community. Played everywhere.</p><div><Link href="/login">Player login</Link><a href="mailto:hello@arena.community">Contact</a><a href="#games">Games</a></div><span className="footer-copy">© 2026 ARENA COMMUNITY</span></footer>
  </main></>;
}