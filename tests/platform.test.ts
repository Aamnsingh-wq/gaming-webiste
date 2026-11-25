import assert from "node:assert/strict";
import test from "node:test";
import { createSingleEliminationBracket } from "../src/lib/tournaments/bracket";
import { bracketChampion, buildBracketView, roundLabel } from "../src/lib/tournaments/bracket-view";
import { matchResultInputSchema, tournamentInputSchema } from "../src/lib/tournaments/schemas";
import { httpUrl, optionalHttpUrl, safeNextPath } from "../src/lib/validation";
import type { MatchRow } from "../src/lib/platform-types";

const toRows = (rounds: ReturnType<typeof createSingleEliminationBracket>): MatchRow[] =>
  rounds.flat().map((match) => ({ id: `${match.round}-${match.match}`, round_number: match.round, match_number: match.match, participant_a: match.playerA, participant_b: match.playerB, winner_id: match.winner, status: match.bye ? "verified" : "scheduled" }));

test("bracket view labels rounds from the final backwards", () => {
  assert.equal(roundLabel(3, 3), "Grand final");
  assert.equal(roundLabel(2, 3), "Semifinals");
  assert.equal(roundLabel(1, 3), "Quarterfinals");
  assert.equal(roundLabel(1, 5), "Round 1");
});

test("bracket view resolves names, byes and TBD slots", () => {
  const rows = toRows(createSingleEliminationBracket(["a", "b", "c"]));
  const view = buildBracketView(rows, [{ registrationId: "a", name: "Alpha", href: null, avatarUrl: null, kind: "player" }]);
  assert.equal(view.length, 2);
  const byeMatch = view[0].matches.find((match) => match.a.isBye || match.b.isBye);
  assert.ok(byeMatch, "a 3-player field has one bye");
  assert.equal(byeMatch.a.name, "Alpha");
  assert.equal(byeMatch.b.name, "BYE");
  assert.ok(byeMatch.a.isWinner);
  assert.equal(view[1].matches[0].b.name, "TBD");
  assert.equal(bracketChampion(rows), null);
});

test("champion is the winner of the final", () => {
  const rows = toRows(createSingleEliminationBracket(["a", "b"]));
  rows[0].winner_id = "b";
  assert.equal(bracketChampion(rows), "b");
});

test("only http(s) URLs are accepted", () => {
  assert.ok(httpUrl.safeParse("https://example.com/a.png").success);
  assert.ok(!httpUrl.safeParse("javascript:alert(1)").success);
  assert.ok(!httpUrl.safeParse("data:text/html,hi").success);
  assert.equal(optionalHttpUrl.parse(""), null);
  assert.equal(optionalHttpUrl.parse(undefined), null);
  assert.ok(!matchResultInputSchema.safeParse({ winnerRegistrationId: "8f14e45f-ceea-467a-9b52-4c1f7d0f2a11", evidenceUrl: "javascript:x" }).success);
});

test("next= redirects stay on this site", () => {
  assert.equal(safeNextPath("/teams"), "/teams");
  assert.equal(safeNextPath("//evil.com"), "/dashboard");
  assert.equal(safeNextPath("/\\evil.com"), "/dashboard");
  assert.equal(safeNextPath("https://evil.com"), "/dashboard");
  assert.equal(safeNextPath(null), "/dashboard");
});

test("tournament dates are compared as instants, not strings", () => {
  const base = { gameSlug: "valorant", slug: "cup-one", name: "Cup One", format: "single_elimination", capacity: 8 } as const;
  // As strings "…00Z" > "…00.000Z" would wrongly fail; as instants these are equal and valid.
  const ok = tournamentInputSchema.safeParse({ ...base, registrationOpensAt: "2026-12-01T00:00:00Z", registrationClosesAt: "2026-12-05T10:00:00Z", startsAt: "2026-12-05T10:00:00.000Z" });
  assert.ok(ok.success, JSON.stringify(ok.error?.issues));
  const bad = tournamentInputSchema.safeParse({ ...base, registrationOpensAt: "2026-12-06T00:00:00Z", registrationClosesAt: "2026-12-05T00:00:00Z", startsAt: "2026-12-07T00:00:00Z" });
  assert.ok(!bad.success);
});
