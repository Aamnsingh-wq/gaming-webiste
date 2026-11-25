import type { GameSlug } from "@/lib/games";

export type { GameSlug };

export type TournamentStatus = "draft" | "registration_open" | "upcoming" | "live" | "completed" | "cancelled";
export type TournamentFormat = "single_elimination" | "double_elimination" | "round_robin" | "points";

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  game: GameSlug;
  format: TournamentFormat;
  startsAt: string;
  registrationClosesAt: string;
  entryCount: number;
  capacity: number;
  teamSize: number;
  prizeLabel: string;
  status: TournamentStatus;
  accent: string;
};

export type TournamentResponse = {
  tournaments: Tournament[];
  source: "supabase" | "preview";
};

export type Entrant = {
  registrationId: string;
  name: string;
  href: string | null;
  avatarUrl: string | null;
  kind: "player" | "team";
};

export type MatchRow = {
  id: string;
  round_number: number;
  match_number: number;
  participant_a: string | null;
  participant_b: string | null;
  winner_id: string | null;
  status: string;
};

export type TournamentDetail = Tournament & {
  description: string;
  registrationOpensAt: string;
  bannerUrl: string | null;
  entrants: Entrant[];
  matches: MatchRow[];
  standings: { position: number; score: number; name: string; href: string | null }[];
};

export type PlayerRank = {
  player_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  points_earned: number;
  match_wins: number;
  tournaments_played: number;
};

export type TeamRank = {
  team_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  game_slug: GameSlug;
  members: number;
  match_wins: number;
  tournaments_played: number;
};

export type TeamProfile = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  game: GameSlug;
  captainId: string;
  createdAt: string;
  roster: { playerId: string; role: "captain" | "member"; username: string; displayName: string; avatarUrl: string | null; joinedAt: string }[];
  history: { tournamentId: string; name: string; slug: string; status: TournamentStatus; startsAt: string }[];
};
