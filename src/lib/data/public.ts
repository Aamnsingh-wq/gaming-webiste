import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/public";
import { previewTournaments } from "@/lib/preview-data";
import type {
  Entrant, GameSlug, PlayerRank, TeamProfile, TeamRank, Tournament, TournamentDetail, TournamentResponse,
} from "@/lib/platform-types";

/**
 * Public data is read with the cookie-less anon client and cached in the Next.js
 * data cache. Mutations call revalidateTag(TAGS.x) so changes appear instantly,
 * while ordinary page views are served without touching the database.
 */
export const TAGS = {
  tournaments: "tournaments",
  leaderboard: "leaderboard",
  teams: "teams",
  catalog: "catalog",
} as const;

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

const TOURNAMENT_COLUMNS = "id, slug, name, game:games(slug), format, status, starts_at, registration_opens_at, registration_closes_at, capacity, team_size, prize_label, accent";

type TournamentRow = {
  id: string; slug: string; name: string; game: { slug: string } | { slug: string }[] | null; format: Tournament["format"];
  status: Tournament["status"]; starts_at: string; registration_closes_at: string; capacity: number; team_size: number;
  prize_label: string; accent: string;
};

function toTournament(row: TournamentRow, entries: number): Tournament {
  return {
    id: row.id, slug: row.slug, name: row.name, game: (one(row.game)?.slug ?? "bgmi") as GameSlug, format: row.format,
    startsAt: row.starts_at, registrationClosesAt: row.registration_closes_at, entryCount: entries, capacity: row.capacity,
    teamSize: row.team_size, prizeLabel: row.prize_label, status: row.status, accent: row.accent,
  };
}

async function entryCounts(ids: string[]) {
  const counts = new Map<string, number>();
  const supabase = getPublicSupabase();
  if (!supabase || !ids.length) return counts;
  const { data, error } = await supabase.rpc("tournament_entry_counts", { target_tournaments: ids });
  if (error) console.error("[data] entry counts", error.message);
  for (const row of (data ?? []) as { tournament_id: string; entries: number }[]) counts.set(row.tournament_id, Number(row.entries));
  return counts;
}

export const getTournamentFeed = unstable_cache(async (): Promise<TournamentResponse & { error?: string }> => {
  const supabase = getPublicSupabase();
  if (!supabase) return { tournaments: previewTournaments, source: "preview" };
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .in("status", ["registration_open", "upcoming", "live", "completed"])
    .order("starts_at", { ascending: true })
    .limit(120);
  if (error) {
    console.error("[data] tournament feed", error.code, error.message);
    return { tournaments: [], source: "supabase", error: "Tournaments could not be loaded right now." };
  }
  const rows = (data ?? []) as unknown as TournamentRow[];
  const counts = await entryCounts(rows.map((row) => row.id));
  return { tournaments: rows.map((row) => toTournament(row, counts.get(row.id) ?? 0)), source: "supabase" };
}, ["tournament-feed-v2"], { revalidate: 60, tags: [TAGS.tournaments] });

export const getTournamentBySlug = unstable_cache(async (slug: string): Promise<TournamentDetail | null> => {
  const supabase = getPublicSupabase();
  if (!supabase) {
    const preview = previewTournaments.find((item) => item.slug === slug);
    return preview ? { ...preview, description: "Preview event — connect Supabase to publish real tournaments.", registrationOpensAt: preview.startsAt, bannerUrl: null, entrants: [], matches: [], standings: [] } : null;
  }
  const { data: row, error } = await supabase
    .from("tournaments")
    .select(`${TOURNAMENT_COLUMNS}, description, banner_url`)
    .eq("slug", slug)
    .neq("status", "draft")
    .maybeSingle();
  if (error) console.error("[data] tournament", error.message);
  if (!row) return null;

  const [counts, registrations, matches, standings] = await Promise.all([
    entryCounts([row.id]),
    supabase.from("tournament_registrations")
      .select("id, player:player_id(username, display_name, avatar_url), team:team_id(name, slug, logo_url)")
      .eq("tournament_id", row.id).eq("status", "approved").order("created_at"),
    supabase.from("matches")
      .select("id, round_number, match_number, participant_a, participant_b, winner_id, status")
      .eq("tournament_id", row.id).order("round_number").order("match_number"),
    supabase.from("leaderboards")
      .select("position, score, player:player_id(username, display_name), team:team_id(name, slug)")
      .eq("tournament_id", row.id).order("position").limit(100),
  ]);

  type Person = { username: string; display_name: string | null; avatar_url?: string | null };
  type Squad = { name: string; slug: string; logo_url?: string | null };
  const entrants: Entrant[] = ((registrations.data ?? []) as unknown as { id: string; player: Person | Person[] | null; team: Squad | Squad[] | null }[]).map((entry) => {
    const team = one(entry.team);
    const player = one(entry.player);
    return team
      ? { registrationId: entry.id, name: team.name, href: `/teams/${team.slug}`, avatarUrl: team.logo_url ?? null, kind: "team" }
      : { registrationId: entry.id, name: player?.display_name || player?.username || "Player", href: null, avatarUrl: player?.avatar_url ?? null, kind: "player" };
  });

  const typed = row as unknown as TournamentRow & { description: string; banner_url: string | null; registration_opens_at: string };
  return {
    ...toTournament(typed, counts.get(row.id) ?? 0),
    description: typed.description,
    registrationOpensAt: typed.registration_opens_at,
    bannerUrl: typed.banner_url,
    entrants,
    matches: matches.data ?? [],
    standings: ((standings.data ?? []) as unknown as { position: number; score: number; player: Person | Person[] | null; team: Squad | Squad[] | null }[]).map((entry) => {
      const team = one(entry.team);
      const player = one(entry.player);
      return { position: entry.position, score: Number(entry.score), name: team?.name ?? player?.display_name ?? player?.username ?? "—", href: team ? `/teams/${team.slug}` : null };
    }),
  };
}, ["tournament-detail-v2"], { revalidate: 30, tags: [TAGS.tournaments] });

export const getLeaderboards = unstable_cache(async (limit = 50): Promise<{ players: PlayerRank[]; teams: TeamRank[] }> => {
  const supabase = getPublicSupabase();
  if (!supabase) return { players: [], teams: [] };
  const [players, teams] = await Promise.all([
    supabase.rpc("get_player_leaderboard", { result_limit: limit }),
    supabase.rpc("get_team_leaderboard", { result_limit: limit }),
  ]);
  if (players.error) console.error("[data] player leaderboard", players.error.message);
  if (teams.error) console.error("[data] team leaderboard", teams.error.message);
  const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
    (rows ?? []).map((row) => ({ ...row, ...Object.fromEntries(keys.map((key) => [key, Number(row[key] ?? 0)])) }));
  return {
    players: num(players.data as PlayerRank[] | null, ["points_earned", "match_wins", "tournaments_played"]) as PlayerRank[],
    teams: num(teams.data as TeamRank[] | null, ["members", "match_wins", "tournaments_played"]) as TeamRank[],
  };
}, ["leaderboards-v1"], { revalidate: 120, tags: [TAGS.leaderboard] });

export const getPlatformStats = unstable_cache(async () => {
  const supabase = getPublicSupabase();
  if (!supabase) return { players: 0, teams: 0, tournaments: previewTournaments.length };
  const [players, teams, tournaments] = await Promise.all([
    supabase.from("profiles").select("id", { count: "estimated", head: true }),
    supabase.from("teams").select("id", { count: "estimated", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }).neq("status", "draft"),
  ]);
  return { players: players.count ?? 0, teams: teams.count ?? 0, tournaments: tournaments.count ?? 0 };
}, ["platform-stats-v1"], { revalidate: 300, tags: [TAGS.tournaments, TAGS.teams] });

export const getTeamDirectory = unstable_cache(async () => {
  const supabase = getPublicSupabase();
  if (!supabase) return [] as TeamRank[];
  const { data, error } = await supabase.rpc("get_team_leaderboard", { result_limit: 100 });
  if (error) console.error("[data] teams", error.message);
  return ((data ?? []) as TeamRank[]).map((team) => ({ ...team, members: Number(team.members), match_wins: Number(team.match_wins), tournaments_played: Number(team.tournaments_played) }));
}, ["team-directory-v1"], { revalidate: 120, tags: [TAGS.teams, TAGS.leaderboard] });

export const getTeamBySlug = unstable_cache(async (slug: string): Promise<TeamProfile | null> => {
  const supabase = getPublicSupabase();
  if (!supabase) return null;
  const { data: team } = await supabase.from("teams").select("id, name, slug, logo_url, captain_id, created_at, game:games(slug)").eq("slug", slug).maybeSingle();
  if (!team) return null;
  const [members, registrations] = await Promise.all([
    supabase.from("team_members").select("player_id, role, joined_at, profile:player_id(username, display_name, avatar_url)").eq("team_id", team.id).order("joined_at"),
    supabase.from("tournament_registrations").select("tournament:tournament_id(id, name, slug, status, starts_at)").eq("team_id", team.id).eq("status", "approved"),
  ]);
  type MemberRow = { player_id: string; role: "captain" | "member"; joined_at: string; profile: { username: string; display_name: string | null; avatar_url: string | null } | { username: string; display_name: string | null; avatar_url: string | null }[] | null };
  type HistoryRow = { tournament: { id: string; name: string; slug: string; status: TeamProfile["history"][number]["status"]; starts_at: string } | { id: string; name: string; slug: string; status: TeamProfile["history"][number]["status"]; starts_at: string }[] | null };
  return {
    id: team.id, name: team.name, slug: team.slug, logoUrl: team.logo_url, captainId: team.captain_id, createdAt: team.created_at,
    game: (one(team.game as { slug: string } | { slug: string }[] | null)?.slug ?? "bgmi") as GameSlug,
    roster: ((members.data ?? []) as unknown as MemberRow[]).map((member) => {
      const profile = one(member.profile);
      return { playerId: member.player_id, role: member.role, joinedAt: member.joined_at, username: profile?.username ?? "player", displayName: profile?.display_name || profile?.username || "Player", avatarUrl: profile?.avatar_url ?? null };
    }).sort((a, b) => (a.role === "captain" ? -1 : b.role === "captain" ? 1 : 0)),
    history: ((registrations.data ?? []) as unknown as HistoryRow[]).map((row) => one(row.tournament)).filter((value): value is NonNullable<typeof value> => Boolean(value))
      .map((tournament) => ({ tournamentId: tournament.id, name: tournament.name, slug: tournament.slug, status: tournament.status, startsAt: tournament.starts_at }))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  };
}, ["team-profile-v1"], { revalidate: 60, tags: [TAGS.teams] });

export const getRewardCatalog = unstable_cache(async () => {
  const supabase = getPublicSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("rewards").select("id, name, description, points_cost, inventory").eq("is_active", true).order("points_cost");
  if (error) console.error("[data] rewards", error.message);
  return (data ?? []).map((reward) => ({ ...reward, points_cost: Number(reward.points_cost) }));
}, ["reward-catalog-v1"], { revalidate: 60, tags: [TAGS.catalog] });

export const getStoreProducts = unstable_cache(async () => {
  const supabase = getPublicSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("products").select("id, name, description, image_url, category, purchase_type, affiliate_url, price_cents").eq("is_active", true).order("name");
  if (error) console.error("[data] products", error.message);
  return data ?? [];
}, ["store-products-v1"], { revalidate: 300, tags: [TAGS.catalog] });
