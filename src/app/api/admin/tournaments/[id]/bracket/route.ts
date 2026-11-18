import { NextResponse } from "next/server";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSingleEliminationBracket } from "@/lib/tournaments/bracket";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const { id } = await context.params;
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments").select("id, format, status").eq("id", id).single();
  if (tournamentError || !tournament) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  if (tournament.status === "draft" || tournament.status === "completed" || tournament.status === "cancelled") {
    return NextResponse.json({ error: "Publish the tournament before generating a bracket." }, { status: 409 });
  }
  if (tournament.format !== "single_elimination") {
    return NextResponse.json({ error: "Bracket generation currently supports single elimination." }, { status: 422 });
  }

  const { data: registrations, error: registrationsError } = await supabase
    .from("tournament_registrations").select("id").eq("tournament_id", id).eq("status", "approved").order("created_at");
  if (registrationsError) return NextResponse.json({ error: "Approved registrations could not be loaded." }, { status: 500 });
  let rounds;
  try {
    rounds = createSingleEliminationBracket((registrations ?? []).map((registration) => registration.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bracket could not be generated." }, { status: 400 });
  }

  const { data: previousBrackets } = await supabase.from("tournament_brackets").select("version").eq("tournament_id", id).order("version", { ascending: false }).limit(1);
  const version = (previousBrackets?.[0]?.version ?? 0) + 1;
  const { data: bracket, error: bracketError } = await supabase.from("tournament_brackets")
    .insert({ tournament_id: id, version, bracket_data: rounds, generated_by: user.id })
    .select("id").single();
  if (bracketError || !bracket) return NextResponse.json({ error: "Bracket could not be saved." }, { status: 500 });

  const insertedRounds: { id: string; round_number: number; match_number: number }[][] = [];
  for (const [roundIndex, matches] of rounds.entries()) {
    const rows = matches.map((match) => ({
      tournament_id: id,
      bracket_id: bracket.id,
      round_number: match.round,
      match_number: match.match,
      participant_a: match.playerA,
      participant_b: match.playerB,
      winner_id: match.winner,
      status: match.bye ? "verified" as const : "scheduled" as const,
    }));
    const { data, error } = await supabase.from("matches").insert(rows).select("id, round_number, match_number");
    if (error || !data) return NextResponse.json({ error: "Bracket matches could not be saved; contact an administrator before retrying." }, { status: 500 });
    insertedRounds[roundIndex] = data;
  }

  for (let roundIndex = 0; roundIndex < insertedRounds.length - 1; roundIndex += 1) {
    for (const match of insertedRounds[roundIndex]) {
      const next = insertedRounds[roundIndex + 1][Math.floor((match.match_number - 1) / 2)];
      await supabase.from("matches").update({ next_match_id: next.id }).eq("id", match.id);
    }
  }
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "bracket.generated", entity_type: "tournament", entity_id: id, changes: { version, entrantCount: registrations?.length ?? 0 } });
  return NextResponse.json({ bracketId: bracket.id, version, rounds: rounds.length, entrants: registrations?.length ?? 0 }, { status: 201 });
}