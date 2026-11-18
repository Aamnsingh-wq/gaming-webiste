import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).default(""),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile details.", details: parsed.error.flatten() }, { status: 400 });

  const { error } = await supabase.from("profiles").update({
    username: parsed.data.username,
    display_name: parsed.data.displayName,
    bio: parsed.data.bio,
    avatar_url: parsed.data.avatarUrl ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Profile could not be updated." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
