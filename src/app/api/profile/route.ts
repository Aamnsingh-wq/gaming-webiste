import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/data/public";
import { dbError, handler, HttpError, json, parseBody, requireUser } from "@/lib/http";
import { optionalHttpUrl, usernameSchema } from "@/lib/validation";

const profileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).default(""),
  avatarUrl: optionalHttpUrl,
});

export const PATCH = handler(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parseBody(request, profileSchema);
  const { error } = await supabase.from("profiles").update({
    username: input.username,
    display_name: input.displayName,
    bio: input.bio,
    avatar_url: input.avatarUrl,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error?.code === "23505") throw new HttpError(409, "That username is already taken.");
  if (error) throw dbError(error, "Profile could not be updated.");
  revalidateTag(TAGS.leaderboard);
  revalidateTag(TAGS.teams);
  return json({ updated: true });
});
