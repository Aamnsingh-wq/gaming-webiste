import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, requireUser } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

/** Captain removes a member, a member leaves, or a solo captain disbands the team. */
export const DELETE = handler(async (_request: Request, context: { params: Promise<{ id: string; playerId: string }> }) => {
  const { supabase } = await requireUser();
  const { id, playerId } = await context.params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(playerId).success) throw new HttpError(400, "Invalid team or player.");
  const { data, error } = await supabase.rpc("remove_team_member", { target_team: id, target_player: playerId });
  if (error) throw dbError(error, "Roster could not be updated.");
  revalidateTag(TAGS.teams);
  revalidateTag(TAGS.leaderboard);
  return json({ status: data });
});
