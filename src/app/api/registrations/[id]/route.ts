import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, requireUser, type RouteParams } from "@/lib/http";

/** Withdraw your own (or, as captain, your team's) registration before brackets are drawn. */
export const DELETE = handler(async (_request: Request, context: RouteParams) => {
  const { supabase } = await requireUser();
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("withdraw_registration", { target_registration: id });
  if (error) throw dbError(error, "Registration could not be withdrawn.");
  revalidateTag(TAGS.tournaments);
  return json({ status: data });
});
