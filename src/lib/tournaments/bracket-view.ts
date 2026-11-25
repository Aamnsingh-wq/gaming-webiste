import type { Entrant, MatchRow } from "@/lib/platform-types";

export type BracketSlot = { registrationId: string | null; name: string; href: string | null; isWinner: boolean; isBye: boolean };
export type BracketMatchView = { id: string; number: number; status: string; a: BracketSlot; b: BracketSlot; decided: boolean };
export type BracketRoundView = { round: number; label: string; matches: BracketMatchView[] };

export function roundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Grand final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

/** Turns flat match rows into labelled rounds with resolved entrant names. */
export function buildBracketView(matches: MatchRow[], entrants: Entrant[]): BracketRoundView[] {
  if (!matches.length) return [];
  const names = new Map(entrants.map((entrant) => [entrant.registrationId, entrant]));
  const totalRounds = Math.max(...matches.map((match) => match.round_number));
  const rounds = new Map<number, BracketMatchView[]>();

  for (const match of [...matches].sort((x, y) => x.round_number - y.round_number || x.match_number - y.match_number)) {
    const isByeMatch = match.round_number === 1 && (match.participant_a === null || match.participant_b === null);
    const slot = (registrationId: string | null): BracketSlot => {
      const entrant = registrationId ? names.get(registrationId) : undefined;
      return {
        registrationId,
        name: registrationId ? entrant?.name ?? "Entrant" : isByeMatch ? "BYE" : "TBD",
        href: entrant?.href ?? null,
        isWinner: Boolean(registrationId && match.winner_id === registrationId),
        isBye: !registrationId && isByeMatch,
      };
    };
    const list = rounds.get(match.round_number) ?? [];
    list.push({ id: match.id, number: match.match_number, status: match.status, a: slot(match.participant_a), b: slot(match.participant_b), decided: Boolean(match.winner_id) });
    rounds.set(match.round_number, list);
  }

  return [...rounds.entries()].map(([round, list]) => ({ round, label: roundLabel(round, totalRounds), matches: list }));
}

/** The registration that won the final, if the bracket is complete. */
export function bracketChampion(matches: MatchRow[]) {
  if (!matches.length) return null;
  const finalRound = Math.max(...matches.map((match) => match.round_number));
  return matches.find((match) => match.round_number === finalRound)?.winner_id ?? null;
}
