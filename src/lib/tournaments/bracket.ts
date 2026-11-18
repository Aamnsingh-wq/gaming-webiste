export type BracketMatch = {
  round: number;
  match: number;
  playerA: string | null;
  playerB: string | null;
  winner: string | null;
  bye: boolean;
};

export function createSingleEliminationBracket(entrantIds: string[]): BracketMatch[][] {
  if (entrantIds.length < 2) {
    throw new Error("At least two entrants are required.");
  }
  if (new Set(entrantIds).size !== entrantIds.length) {
    throw new Error("Entrant IDs must be unique.");
  }

  const size = 2 ** Math.ceil(Math.log2(entrantIds.length));
  let seedOrder = [1, 2];
  while (seedOrder.length < size) {
    const nextSize = seedOrder.length * 2;
    seedOrder = seedOrder.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }
  const slots: (string | null)[] = seedOrder.map((seed) => entrantIds[seed - 1] ?? null);
  const rounds: BracketMatch[][] = [];

  for (let round = 1; round <= Math.log2(size); round += 1) {
    const matches: BracketMatch[] = [];
    for (let index = 0; index < slots.length; index += 2) {
      const playerA = slots[index];
      const playerB = slots[index + 1];
      const bye = round === 1 && (playerA === null || playerB === null);
      matches.push({
        round,
        match: index / 2 + 1,
        playerA,
        playerB,
        winner: bye ? (playerA ?? playerB) : null,
        bye,
      });
    }
    rounds.push(matches);
    slots.length = Math.ceil(slots.length / 2);
    for (let index = 0; index < matches.length; index += 1) {
      slots[index] = matches[index].winner;
    }
  }

  return rounds;
}