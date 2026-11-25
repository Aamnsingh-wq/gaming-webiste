import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireAdmin } from "@/lib/http";

const rewardSchema =z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).default(""),
  pointsCost: z.number().int().min(1).max(10_000_000),
  inventory: z.number().int().min(0).max(1_000_000).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireAdmin();
  const input = await parseBody(request, rewardSchema);
  const { data, error } = await supabase.from("rewards").insert({ name: input.name, description: input.description, points_cost: input.pointsCost, inventory: input.inventory, is_active: input.isActive }).select("id").single();
  if (error) throw dbError(error, "Reward could not be created.");
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "reward.created", entity_type: "reward", entity_id: data.id });
  revalidateTag(TAGS.catalog);
  return json(data, 201);
});
