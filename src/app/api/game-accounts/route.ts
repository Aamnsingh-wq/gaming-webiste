import { z } from "zod";
import { dbError, handler, HttpError, json, parseBody, requireUser } from "@/lib/http";
import { gameSlugSchema, httpUrl } from "@/lib/validation";

const accountSchema = z.object({
  gameSlug: gameSlugSchema,
  gameUsername: z.string().trim().min(2).max(80),
  externalPlayerId: z.string().trim().min(2).max(120),
  evidenceUrl: httpUrl.optional(),
});

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, accountSchema);
  const { data: game } = await supabase.from("games").select("id").eq("slug", input.gameSlug).maybeSingle();
  if (!game) throw new HttpError(404, "Game not found.");
  // Status is always (re)set to pending; only admins can verify (enforced by a DB trigger).
  const { data, error } = await supabase.from("connected_game_accounts").upsert({
    player_id: user.id,
    game_id: game.id,
    game_username: input.gameUsername,
    external_player_id: input.externalPlayerId,
    verification_status: "pending",
    verification_evidence: input.evidenceUrl ?? null,
  }, { onConflict: "player_id,game_id,external_player_id" }).select("id, verification_status").single();
  if (error) throw dbError(error, "Gaming account could not be linked.");
  return json(data, 201);
});
