import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireUser, type RouteParams } from "@/lib/http";

const redeemSchema = z.object({ idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9-]{8,64}$/).optional() });

export const POST = handler(async (request: Request, context: RouteParams) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, redeemSchema);
  const { id } = await context.params;
  // Namespace the client key by player + reward so it can never collide with
  // another player's or an admin's ledger keys.
  const key = `redemption:${user.id}:${id}:${input.idempotencyKey ?? crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("redeem_reward", { target_reward: id, transaction_key: key });
  if (error) throw dbError(error, "Reward could not be redeemed.");
  revalidateTag(TAGS.catalog);
  if (data === null) return json({ status: "already_redeemed", idempotent: true });
  return json({ transactionId: data, status: "redeemed" }, 201);
});
