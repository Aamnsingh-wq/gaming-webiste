import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireAdmin } from "@/lib/http";
import { tournamentInputSchema } from "@/lib/tournaments/schemas";

export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireAdmin();
  const input = await parseBody(request, tournamentInputSchema);
  const { data: game } = await supabase.from("games").select("id").eq("slug", input.gameSlug).maybeSingle();
  if (!game) throw new HttpError(404, "Game not found.");

  const { data, error } = await supabase.from("tournaments").insert({
    game_id: game.id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    format: input.format,
    registration_opens_at: input.registrationOpensAt,
    registration_closes_at: input.registrationClosesAt,
    starts_at: input.startsAt,
    capacity: input.capacity,
    team_size: input.teamSize,
    prize_label: input.prizeLabel,
    accent: input.accent,
    banner_url: input.bannerUrl ?? null,
    created_by: user.id,
    status: "draft",
  }).select("id, slug, name, status").single();
  if (error?.code === "23505") throw new HttpError(409, "A tournament with that URL already exists.");
  if (error) throw dbError(error, "Tournament could not be created.");

  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "tournament.created", entity_type: "tournament", entity_id: data.id });
  revalidateTag(TAGS.tournaments);
  return json(data, 201);
});
