import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, requireUser, type RouteParams } from "@/lib/http";

export const POST = handler(async (_request: Request, context: RouteParams) => {
  const { supabase } = await requireUser();
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("register_tournament", { target_tournament: id });
  if (error) throw dbError(error, "Registration could not be completed.");
  revalidateTag(TAGS.tournaments);
  return json({ id: data, status: "pending" }, 201);
});
