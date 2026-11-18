export type GameSlug =
  | "bgmi"
  | "brawl-stars"
  | "minecraft"
  | "free-fire"
  | "valorant";

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  game: GameSlug;
  format: "single_elimination" | "double_elimination" | "round_robin" | "points";
  startsAt: string;
  registrationClosesAt: string;
  entryCount: number;
  capacity: number;
  prizeLabel: string;
  status: "registration_open" | "upcoming" | "live" | "completed";
  accent: string;
};

export type TournamentResponse = {
  tournaments: Tournament[];
  source: "supabase" | "preview";
};