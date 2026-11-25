import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireAdmin, type RouteParams } from "@/lib/http";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  inventory: z.number().int().min(0).max(1_000_000).nullable().optional(),
  pointsCost: z.number().int().min(1).max(10_000_000).optional(),
});

export const PATCH = handler(async (request: Request, context: RouteParams) => {
  const { supabase, user } = await requireAdmin();
  const input = await parseBody(request, updateSchema);
  const { id } = await context.params;
  const changes: Record<string, unknown> = {};
  if (input.isActive !== undefined) changes.is_active = input.isActive;
  if (input.inventory !== undefined) changes.inventory = input.inventory;
  if (input.pointsCost !== undefined) changes.points_cost = input.pointsCost;
  if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to update.");
  const { data, error } = await supabase.from("rewards").update(changes).eq("id", id).select("id").maybeSingle();
  if (error) throw dbError(error, "Reward could not be updated.");
  if (!data) throw new HttpError(404, "Reward not found.");
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "reward.updated", entity_type: "reward", entity_id: id, changes });
  revalidateTag(TAGS.catalog);
  return json({ updated: true });
});
