import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, json, parseBody, requireUser } from "@/lib/http";
import { gameSlugSchema, httpUrl, slugSchema } from "@/lib/validation";

const teamSchema = z.object({
  gameSlug: gameSlugSchema,
  name: z.string().trim().min(3).max(60),
  slug: slugSchema,
  logoUrl: httpUrl.optional(),
});

export const POST = handler(async (request: Request) => {
  const { supabase } = await requireUser();
  const input = await parseBody(request, teamSchema);
  // Atomic: team + captain membership are created in one transaction.
  const { data, error } = await supabase.rpc("create_team", { target_game: input.gameSlug, team_name: input.name, team_slug: input.slug, team_logo: input.logoUrl ?? null });
  if (error) throw dbError(error, "Team could not be created.");
  revalidateTag(TAGS.teams);
  return json({ id: data, name: input.name, slug: input.slug }, 201);
});
