import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireUser, type RouteParams } from "@/lib/http";

const teamRegistrationSchema = z.object({ teamId: z.string().uuid() });

export const POST = handler(async (request: Request, context: RouteParams) => {
  const { supabase } = await requireUser();
  const input = await parseBody(request, teamRegistrationSchema);
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("register_team_for_tournament", { target_tournament: id, target_team: input.teamId });
  if (error) throw dbError(error, "Team registration could not be completed.");
  revalidateTag(TAGS.tournaments);
  return json({ id: data, status: "pending" }, 201);
});
