export type PlacementPoints = Record<number, number>;

export function calculateBattleRoyalePoints(
  placement: number,
  kills: number,
  placementPoints: PlacementPoints,
  pointsPerKill: number,
): number {
  if (!Number.isInteger(placement) || placement < 1) {
    throw new Error("Placement must be a positive whole number.");
  }
  if (!Number.isInteger(kills) || kills < 0) {
    throw new Error("Kills must be a non-negative whole number.");
  }
  if (!Number.isFinite(pointsPerKill) || pointsPerKill < 0) {
    throw new Error("Points per kill must be a non-negative number.");
  }

  return (placementPoints[placement] ?? 0) + kills * pointsPerKill;
}