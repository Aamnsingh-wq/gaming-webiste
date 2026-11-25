import { z } from "zod";
import { dbError, handler, json, parseBody, requireUser, type RouteParams } from "@/lib/http";
import { usernameSchema } from "@/lib/validation";

const invitationSchema = z.object({ username: usernameSchema });

export const POST = handler(async (request: Request, context: RouteParams) => {
  const { supabase } = await requireUser();
  const input = await parseBody(request, invitationSchema);
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("invite_to_team", { target_team: id, target_username: input.username });
  if (error) throw dbError(error, "Invitation could not be sent.");
  return json({ id: data, status: "pending" }, 201);
});
