export const GAMES = [
  { slug: "bgmi", teamMax: 4, name: "BGMI", genre: "Battle Royale", accent: "#ffb020" },
  { slug: "valorant", teamMax: 5, name: "VALORANT", genre: "Tactical FPS", accent: "#ff4d6a" },
  { slug: "brawl-stars", teamMax: 3, name: "Brawl Stars", genre: "Arena Brawler", accent: "#00e5ff" },
  { slug: "free-fire", teamMax: 4, name: "Free Fire", genre: "Battle Royale", accent: "#ff7a1a" },
  { slug: "minecraft", teamMax: 8, name: "Minecraft", genre: "Sandbox PvP", accent: "#b6ff3b" },
] as const;

export type GameSlug = (typeof GAMES)[number]["slug"];
export const GAME_SLUGS = GAMES.map((game) => game.slug) as [GameSlug, ...GameSlug[]];

const bySlug = new Map<string, (typeof GAMES)[number]>(GAMES.map((game) => [game.slug, game]));

export function gameName(slug: string | null | undefined) {
  return (slug && bySlug.get(slug)?.name) || "Game";
}

export function gameTeamMax(slug: string | null | undefined) {
  return (slug && bySlug.get(slug)?.teamMax) || 5;
}

export function gameAccent(slug: string | null | undefined) {
  return (slug && bySlug.get(slug)?.accent) || "#00e5ff";
}
