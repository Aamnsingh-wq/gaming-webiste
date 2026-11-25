import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, requireAdmin, type RouteParams } from "@/lib/http";
import { createSingleEliminationBracket } from "@/lib/tournaments/bracket";

export const POST = handler(async (_request: Request, context: RouteParams) => {
  const { supabase } = await requireAdmin();
  const { id } = await context.params;
  const { data: tournament } = await supabase.from("tournaments").select("id, format").eq("id", id).maybeSingle();
  if (!tournament) throw new HttpError(404, "Tournament not found.");
  if (tournament.format !== "single_elimination") throw new HttpError(422, "Bracket generation currently supports single elimination.");

  const { data: registrations, error: registrationsError } = await supabase
    .from("tournament_registrations").select("id").eq("tournament_id", id).eq("status", "approved").order("created_at");
  if (registrationsError) throw dbError(registrationsError, "Approved registrations could not be loaded.");

  let rounds;
  try {
    rounds = createSingleEliminationBracket((registrations ?? []).map((registration) => registration.id));
  } catch (error) {
    throw new HttpError(422, error instanceof Error ? error.message : "Bracket could not be generated.");
  }

  // One transaction: replaces an unplayed bracket, inserts matches, links advancement, audits.
  const { data: bracketId, error } = await supabase.rpc("save_bracket", { target_tournament: id, rounds });
  if (error) throw dbError(error, "Bracket could not be saved.");
  revalidateTag(TAGS.tournaments);
  return json({ bracketId, rounds: rounds.length, entrants: registrations?.length ?? 0 }, 201);
});
