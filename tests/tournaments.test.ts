import assert from "node:assert/strict";
import test from "node:test";
import { createSingleEliminationBracket } from "../src/lib/tournaments/bracket";
import { calculateBattleRoyalePoints } from "../src/lib/tournaments/scoring";

test("single elimination pads non-power-of-two fields and advances byes", () => {
  const rounds = createSingleEliminationBracket(["a", "b", "c", "d", "e"]);
  assert.equal(rounds[0].length, 4);
  assert.equal(rounds[0].filter((match) => match.bye).length, 3);
  assert.equal(rounds[1].filter((match) => match.bye).length, 0);
  assert.deepEqual(rounds[1][0].playerA, "a");
  assert.deepEqual(rounds[1][0].playerB, null);
  assert.deepEqual(rounds[1][1].playerA, "b");
  assert.deepEqual(rounds[1][1].playerB, "c");
  assert.equal(rounds.at(-1)?.length, 1);
  assert.ok(rounds[0].every((match) => match.winner !== null || !match.bye));
});

test("bracket rejects duplicate entrants", () => {
  assert.throws(() => createSingleEliminationBracket(["a", "a"]), /unique/);
});

test("BGMI scoring combines placement and kill points", () => {
  assert.equal(calculateBattleRoyalePoints(2, 5, { 1: 15, 2: 12 }, 2), 22);
});