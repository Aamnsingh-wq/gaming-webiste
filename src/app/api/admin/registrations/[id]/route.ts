import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireAdmin, type RouteParams } from "@/lib/http";

const reviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export const PATCH = handler(async (request: Request, context: RouteParams) => {
  const { supabase, user } = await requireAdmin();
  const { status } = await parseBody(request, reviewSchema);
  const { id } = await context.params;

  const { data: registration } = await supabase.from("tournament_registrations")
    .select("player_id, team_id, status, tournament:tournament_id(name, capacity)").eq("id", id).maybeSingle();
  if (!registration) throw new HttpError(404, "Registration not found.");
  if (registration.status === "withdrawn") throw new HttpError(409, "This entry was withdrawn by the player.");
  const tournament = (Array.isArray(registration.tournament) ? registration.tournament[0] : registration.tournament) as { name: string; capacity: number } | null;

  const { error } = await supabase.from("tournament_registrations").update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw dbError(error, "Registration could not be reviewed.");

  const recipients = new Set<string>(registration.player_id ? [registration.player_id] : []);
  if (registration.team_id) {
    const { data: members } = await supabase.from("team_members").select("player_id").eq("team_id", registration.team_id);
    for (const member of members ?? []) recipients.add(member.player_id);
  }
  if (recipients.size) {
    const { error: notifyError } = await supabase.from("notifications").insert([...recipients].map((playerId) => ({
      player_id: playerId,
      kind: "registration_review",
      title: status === "approved" ? "You're in!" : "Registration declined",
      body: `Your entry for ${tournament?.name ?? "the tournament"} was ${status}.`,
    })));
    if (notifyError) console.error("[admin] notify", notifyError.message);
  }
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "registration.reviewed", entity_type: "registration", entity_id: id, changes: { status } });
  revalidateTag(TAGS.tournaments);
  revalidateTag(TAGS.leaderboard);
  return json({ status });
});
