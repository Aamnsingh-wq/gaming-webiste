import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireAdmin } from "@/lib/http";
import { usernameSchema } from "@/lib/validation";

const pointsSchema = z.object({
  username: usernameSchema,
  kind: z.enum(["award", "adjustment", "refund"]),
  amount: z.number().int().min(1).max(1_000_000),
  description: z.string().trim().min(3).max(200),
  tournamentId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9-]{8,64}$/),
});

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireAdmin();
  const input = await parseBody(request, pointsSchema);
  const { data: player } = await supabase.from("profiles").select("id").eq("username", input.username).maybeSingle();
  if (!player) throw new HttpError(404, "Player not found.");
  const { data, error } = await supabase.rpc("apply_point_transaction", {
    target_player: player.id,
    transaction_kind: input.kind,
    transaction_amount: input.amount,
    transaction_key: `admin:${user.id}:${input.idempotencyKey}`,
    transaction_description: input.description,
    related_tournament: input.tournamentId ?? null,
  });
  if (error) throw dbError(error, "Points could not be applied.");
  if (data !== null) {
    const credit = input.kind !== "adjustment";
    await supabase.from("notifications").insert({ player_id: player.id, kind: "points", title: credit ? `+${input.amount} points` : `${input.amount} points deducted`, body: input.description });
  }
  revalidateTag(TAGS.leaderboard);
  return json({ transactionId: data, duplicate: data === null }, data === null ? 200 : 201);
});
