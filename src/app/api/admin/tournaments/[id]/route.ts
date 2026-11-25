import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireAdmin, type RouteParams } from "@/lib/http";
import { tournamentUpdateSchema } from "@/lib/tournaments/schemas";

const COLUMN: Record<string, string> = {
  name: "name", description: "description", format: "format", registrationOpensAt: "registration_opens_at",
  registrationClosesAt: "registration_closes_at", startsAt: "starts_at", capacity: "capacity", teamSize: "team_size",
  prizeLabel: "prize_label", accent: "accent", bannerUrl: "banner_url", status: "status",
};

export const PATCH = handler(async (request: Request, context: RouteParams) => {
  const { supabase, user } = await requireAdmin();
  const input = await parseBody(request, tournamentUpdateSchema);
  const { id } = await context.params;
  const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined).map(([key, value]) => [COLUMN[key], value]));
  const { data, error } = await supabase.from("tournaments").update(changes).eq("id", id).select("id, slug, status").maybeSingle();
  if (error?.code === "23514") throw new HttpError(422, "Dates must be ordered: registration opens → closes → tournament starts.");
  if (error) throw dbError(error, "Tournament could not be updated.");
  if (!data) throw new HttpError(404, "Tournament not found.");
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "tournament.updated", entity_type: "tournament", entity_id: id, changes });
  revalidateTag(TAGS.tournaments);
  return json(data);
});
