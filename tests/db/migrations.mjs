/* eslint-disable @typescript-eslint/no-unused-expressions -- test harness uses `cond ? ok() : bad()` reporting */
// Applies the real migrations to PGlite with a stubbed Supabase auth schema,
// then exercises the workflows as the `authenticated` / `anon` roles.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const db = new PGlite();
const ids = { admin: "00000000-0000-4000-8000-000000000001", cap: "00000000-0000-4000-8000-000000000002", p3: "00000000-0000-4000-8000-000000000003", p4: "00000000-0000-4000-8000-000000000004" };
let failures = 0;
const ok = (name) => console.log("  ok  ", name);
const bad = (name, e) => { failures++; console.log("  FAIL", name, "->", e?.message ?? e); };

async function as(user, fn) {
  await db.exec(user === "anon" ? "set role anon; select set_config('request.jwt.claim.sub','',false);" : `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
async function expectOk(name, fn) { try { const r = await fn(); ok(name); return r; } catch (e) { bad(name, e); } }
async function expectErr(name, re, fn) { try { await fn(); bad(name, "expected error " + re); } catch (e) { re.test(e.message) ? ok(name + " (" + e.message + ")") : bad(name, e); } }
const one = async (sql, p) => (await db.query(sql, p)).rows[0];

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of ["0001_platform.sql", "0002_platform_workflows.sql", "0003_hardening_and_workflows.sql"]) {
  const sql = readFileSync(path.join(dir, f), "utf8").replace(/create extension[^;]+;/i, "");
  try { await db.exec(sql); console.log("applied", f); } catch (e) { console.log("MIGRATION FAILED", f, e.message); process.exit(1); }
}
// Re-applying 0003 must be safe (idempotent).
await expectOk("0003 is re-runnable", () => db.exec(readFileSync(path.join(dir, "0003_hardening_and_workflows.sql"), "utf8")));

console.log("signup trigger");
await db.exec(`insert into auth.users values ('${ids.admin}','admin@x.io','{"username":"admin_one"}'),
  ('${ids.cap}','cap@x.io','{"username":"captain"}'), ('${ids.p3}','averyveryverylongemailprefix_abc@x.io','{}'),
  ('${ids.p4}','p4@x.io','{"username":"captain"}');`);
const names = (await db.query("select id, username from public.profiles order by id")).rows;
names.every((r) => /^[A-Za-z0-9_]{3,24}$/.test(r.username)) && names.length === 4 ? ok("4 profiles, valid usernames: " + names.map((r) => r.username).join(", ")) : bad("profiles", JSON.stringify(names));
await db.exec(`update public.profiles set role='administrator' where id='${ids.admin}'`);

console.log("privileges");
await as("anon", () => expectOk("anon reads games", () => db.query("select * from public.games")));
await as("anon", () => expectErr("anon cannot read game accounts", /permission denied/, () => db.query("select * from public.connected_game_accounts")));
await as(ids.cap, () => expectErr("player cannot change own role", /permission denied/, () => db.query("update public.profiles set role='administrator' where id=$1", [ids.cap])));
await as(ids.cap, () => expectErr("player cannot change points", /permission denied/, () => db.query("update public.profiles set points_balance=999 where id=$1", [ids.cap])));
await as(ids.cap, () => expectOk("player edits bio", () => db.query("update public.profiles set bio='hi' where id=$1", [ids.cap])));
await as(ids.cap, () => expectErr("javascript: avatar rejected", /check constraint/, () => db.query("update public.profiles set avatar_url='javascript:alert(1)' where id=$1", [ids.cap])));

console.log("game accounts");
const valorant = (await one("select id from public.games where slug='valorant'")).id;
await as(ids.cap, () => expectOk("insert as 'verified' is downgraded", async () => {
  const r = await one("insert into public.connected_game_accounts(player_id,game_id,game_username,external_player_id,verification_status) values ($1,$2,'cap','cap#1','verified') returning verification_status", [ids.cap, valorant]);
  if (r.verification_status !== "unverified") throw new Error("status " + r.verification_status);
}));
await as(ids.cap, () => expectErr("player cannot self-verify", /managed by administrators/, () => db.query("update public.connected_game_accounts set verification_status='verified' where player_id=$1", [ids.cap])));
await as(ids.p3, async () => { const r = await db.query("select * from public.connected_game_accounts"); r.rows.length === 0 ? ok("other players cannot see accounts") : bad("account leak", r.rows.length); });
await as(ids.admin, () => expectOk("admin verifies", () => db.query("update public.connected_game_accounts set verification_status='verified' where player_id=$1", [ids.cap])));

console.log("teams");
const team = await as(ids.cap, () => expectOk("create team", async () => (await one("select public.create_team('valorant','Night Owls','night-owls') as id")).id));
await as(ids.p3, () => expectErr("duplicate slug", /already taken/, () => db.query("select public.create_team('valorant','Other','night-owls')")));
await as(ids.p3, () => expectErr("non-captain cannot invite", /captain/, () => db.query("select public.invite_to_team($1,'captain')", [team])));
const p3name = names.find((r) => r.id === ids.p3).username;
const inv = await as(ids.cap, () => expectOk("captain invites", async () => (await one("select public.invite_to_team($1,$2) as id", [team, p3name])).id));
await as(ids.cap, () => expectErr("duplicate pending invite", /pending/, () => db.query("select public.invite_to_team($1,$2)", [team, p3name])));
await as(ids.p3, () => expectOk("invitee accepts (was broken by RLS)", () => db.query("select public.respond_team_invitation($1,true)", [inv])));
const roster = await one("select count(*)::int c from public.team_members where team_id=$1", [team]);
roster.c === 2 ? ok("roster = 2") : bad("roster", roster.c);
await as(ids.p3, async () => { const n = await one("select count(*)::int c from public.notifications where player_id=$1", [ids.p3]); n.c >= 1 ? ok("invite notification delivered") : bad("notification", n.c); });
await as(ids.cap, () => expectErr("captain cannot leave with members", /Remove the other members/, () => db.query("select public.remove_team_member($1,$2)", [team, ids.cap])));
await as(ids.p3, () => expectOk("member leaves", () => db.query("select public.remove_team_member($1,$2)", [team, ids.p3])));
const inv2 = await as(ids.cap, () => expectOk("re-invite after leaving/rejection", async () => (await one("select public.invite_to_team($1,$2) as id", [team, p3name])).id));
await as(ids.p3, () => expectOk("accept again", () => db.query("select public.respond_team_invitation($1,true)", [inv2])));
await as(ids.cap, () => expectErr("direct team_members insert blocked", /permission denied/, () => db.query("insert into public.team_members(team_id,player_id) values ($1,$2)", [team, ids.p4])));

console.log("tournaments + registration");
const mk = async (slug, size, cap) => (await one(`insert into public.tournaments(game_id,slug,name,format,status,registration_opens_at,registration_closes_at,starts_at,capacity,team_size)
  values ($1,$2,$2,'single_elimination','registration_open',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',$3,$4) returning id`, [valorant, slug, cap, size])).id;
const solo = await mk("solo-cup", 1, 3);
const duo = await mk("duo-cup", 2, 8);
await as(ids.cap, () => expectErr("solo entry into team event blocked", /team event/, () => db.query("select public.register_tournament($1)", [duo])));
await as(ids.cap, () => expectOk("captain registers team", () => db.query("select public.register_team_for_tournament($1,$2)", [duo, team])));
const regs = {};
for (const who of [ids.cap, ids.p3, ids.p4]) regs[who] = await as(who, () => expectOk("solo register", async () => (await one("select public.register_tournament($1) as id", [solo])).id));
await as(ids.admin, () => expectErr("capacity enforced", /full/, () => db.query("select public.register_tournament($1)", [solo])));
await as(ids.p4, () => expectOk("withdraw", () => db.query("select public.withdraw_registration($1)", [regs[ids.p4]])));
await as(ids.admin, () => expectOk("withdrawn slot frees capacity", () => db.query("select public.register_tournament($1)", [solo])));
await as(ids.admin, () => expectOk("admin withdraws again", async () => { const r = await one("select id from public.tournament_registrations where tournament_id=$1 and player_id=$2", [solo, ids.admin]); await db.query("select public.withdraw_registration($1)", [r.id]); }));
await as(ids.p4, () => expectOk("withdrawn player can re-register", () => db.query("select public.register_tournament($1)", [solo])));
await as("anon", async () => { const r = await db.query("select * from public.tournament_entry_counts($1)", [[solo, duo]]); const m = Object.fromEntries(r.rows.map((x) => [x.tournament_id, Number(x.entries)])); m[solo] === 3 && m[duo] === 1 ? ok("public entry counts 3/1") : bad("counts", JSON.stringify(m)); });
await db.exec(`update public.tournament_registrations set status='approved' where tournament_id='${solo}' and status='pending'`);

console.log("bracket");
const a = regs[ids.cap], b = regs[ids.p3], c = regs[ids.p4];
const rounds = [[{ round: 1, match: 1, playerA: a, playerB: null, winner: a, bye: true }, { round: 1, match: 2, playerA: b, playerB: c, winner: null, bye: false }],
  [{ round: 2, match: 1, playerA: a, playerB: null, winner: null, bye: false }]];
await as(ids.cap, () => expectErr("non-admin cannot save bracket", /Not authorized/, () => db.query("select public.save_bracket($1,$2)", [solo, JSON.stringify(rounds)])));
await as(ids.admin, () => expectOk("save bracket", () => db.query("select public.save_bracket($1,$2)", [solo, JSON.stringify(rounds)])));
await as(ids.admin, () => expectOk("regenerate bracket (was unique-violation)", () => db.query("select public.save_bracket($1,$2)", [solo, JSON.stringify(rounds)])));
const m2 = await one("select id from public.matches where tournament_id=$1 and round_number=1 and match_number=2", [solo]);
const fin = await one("select id from public.matches where tournament_id=$1 and round_number=2", [solo]);
await as(ids.admin, () => expectErr("final waits for opponent", /Both participants/, () => db.query("select public.verify_tournament_match($1,$2,'{}'::jsonb)", [fin.id, a])));
await as(ids.p4, () => expectOk("participant submits result", () => db.query("insert into public.match_results(match_id,submitted_by,result_data) values ($1,$2,'{}')", [m2.id, ids.p4])));
await as(ids.admin, () => expectErr("non-participant result blocked", /row-level security/, () => db.query("insert into public.match_results(match_id,submitted_by,result_data) values ($1,$2,'{}')", [m2.id, ids.admin])));
await db.exec(`update public.tournaments set status='live' where id='${solo}'`);
await as(ids.admin, () => expectOk("verify semifinal", () => db.query("select public.verify_tournament_match($1,$2,'{\"score\":\"13-7\"}'::jsonb)", [m2.id, c])));
const f2 = await one("select participant_a, participant_b from public.matches where id=$1", [fin.id]);
f2.participant_a === a && f2.participant_b === c ? ok("winner advanced into slot B") : bad("advance", JSON.stringify(f2));
await as(ids.admin, () => expectErr("bracket locked after results", /locked/, () => db.query("select public.save_bracket($1,$2)", [solo, JSON.stringify(rounds)])));
await as(ids.admin, () => expectOk("verify final", () => db.query("select public.verify_tournament_match($1,$2,'{}'::jsonb)", [fin.id, c])));
(await one("select status from public.tournaments where id=$1", [solo])).status === "completed" ? ok("tournament auto-completed") : bad("complete", "");

console.log("points + leaderboards");
await as(ids.admin, () => expectOk("award points", () => db.query("select public.apply_point_transaction($1,'award',500,'award:test:1','Champion')", [ids.p4])));
await db.exec("insert into public.rewards(name, points_cost, inventory) values ('Skin', 200, 1)");
const reward = (await one("select id from public.rewards")).id;
await as(ids.p4, () => expectOk("redeem", () => db.query("select public.redeem_reward($1,'redemption:p4:k1')", [reward])));
await as(ids.p4, async () => { const r = await one("select public.redeem_reward($1,'redemption:p4:k1') as id", [reward]); r.id === null ? ok("redeem is idempotent") : bad("idempotent", r.id); });
await as(ids.p4, () => expectErr("out of stock", /stock/, () => db.query("select public.redeem_reward($1,'redemption:p4:k2')", [reward])));
(await one("select points_balance::int b from public.profiles where id=$1", [ids.p4])).b === 300 ? ok("balance 300") : bad("balance", "");
await as("anon", async () => {
  const r = (await db.query("select * from public.get_player_leaderboard(10)")).rows;
  r[0]?.player_id === ids.p4 && Number(r[0].match_wins) === 2 ? ok("player leaderboard: p4 first with 2 wins") : bad("leaderboard", JSON.stringify(r));
  const t = (await db.query("select * from public.get_team_leaderboard(10)")).rows;
  t[0]?.slug === "night-owls" ? ok("team leaderboard") : bad("team lb", JSON.stringify(t));
  const pub = (await db.query("select count(*)::int c from public.tournament_registrations")).rows[0].c;
  pub === 3 ? ok("anon sees only approved registrations (3)") : bad("public regs", pub);
});
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL SQL CHECKS PASSED");
process.exit(failures ? 1 : 0);
