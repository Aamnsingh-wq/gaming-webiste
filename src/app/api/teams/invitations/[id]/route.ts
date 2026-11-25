import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireUser, type RouteParams } from "@/lib/http";

const responseSchema = z.object({ status: z.enum(["accepted", "rejected"]) });

export const PATCH = handler(async (request: Request, context: RouteParams) => {
  const { supabase } = await requireUser();
  const input = await parseBody(request, responseSchema);
  const { id } = await context.params;
  // Atomic: membership insert + invitation status change happen in one transaction.
  const { data, error } = await supabase.rpc("respond_team_invitation", { target_invitation: id, accept: input.status === "accepted" });
  if (error) throw dbError(error, "Invitation could not be updated.");
  if (data === "accepted") revalidateTag(TAGS.teams);
  return json({ status: data });
});
