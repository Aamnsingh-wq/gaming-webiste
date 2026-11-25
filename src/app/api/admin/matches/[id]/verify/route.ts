import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireAdmin, type RouteParams } from "@/lib/http";
import { matchResultInputSchema } from "@/lib/tournaments/schemas";

export const POST = handler(async (request: Request, context: RouteParams) => {
  const { supabase } = await requireAdmin();
  const input = await parseBody(request, matchResultInputSchema);
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("verify_tournament_match", {
    target_match: id,
    target_winner: input.winnerRegistrationId,
    target_result: input.result,
    target_evidence_url: input.evidenceUrl ?? null,
  });
  if (error) throw dbError(error, "Match result could not be verified.");
  revalidateTag(TAGS.tournaments);
  revalidateTag(TAGS.leaderboard);
  return json({ resultId: data, status: "verified" });
});
