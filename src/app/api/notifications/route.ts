import { z } from "zod";
import { dbError, handler, json, parseBody, requireUser } from "@/lib/http";

export const GET = handler(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("notifications").select("id, kind, title, body, read_at, created_at").eq("player_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw dbError(error, "Notifications could not be loaded.");
  return json({ notifications: data ?? [] });
});

const readSchema = z.object({ notificationIds: z.array(z.string().uuid()).max(50).optional(), readAll: z.boolean().optional() })
  .refine((value) => value.readAll || value.notificationIds?.length, { message: "Pass notificationIds or readAll." });

export const PATCH = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, readSchema);
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("player_id", user.id).is("read_at", null);
  if (!input.readAll && input.notificationIds?.length) query = query.in("id", input.notificationIds);
  const { error } = await query;
  if (error) throw dbError(error, "Notifications could not be updated.");
  return json({ updated: true });
});
