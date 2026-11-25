import { z } from "zod";
import { dbError, handler, HttpError, json, parseBody, requireAdmin, type RouteParams } from "@/lib/http";

const verifySchema = z.object({ status: z.enum(["verified", "rejected"]) });

export const PATCH = handler(async (request: Request, context: RouteParams) => {
  const { supabase, user } = await requireAdmin();
  const { status } = await parseBody(request, verifySchema);
  const { id } = await context.params;
  const { data, error } = await supabase.from("connected_game_accounts").update({ verification_status: status }).eq("id", id).select("player_id, game_username").maybeSingle();
  if (error) throw dbError(error, "Account could not be updated.");
  if (!data) throw new HttpError(404, "Game account not found.");
  await Promise.all([
    supabase.from("notifications").insert({ player_id: data.player_id, kind: "account_verification", title: status === "verified" ? "Game account verified" : "Game account rejected", body: `${data.game_username} was ${status} by an administrator.` }),
    supabase.from("audit_logs").insert({ actor_id: user.id, action: "game_account.reviewed", entity_type: "game_account", entity_id: id, changes: { status } }),
  ]);
  return json({ status });
});
