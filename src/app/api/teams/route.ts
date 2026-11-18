import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const teamSchema = z.object({
  gameSlug: z.enum(["bgmi", "brawl-stars", "minecraft", "free-fire", "valorant"]),
  name: z.string().trim().min(3).max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  logoUrl: z.string().url().max(2048).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = teamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid team details.", details: parsed.error.flatten() }, { status: 400 });

  const { data: game, error: gameError } = await supabase.from("games").select("id").eq("slug", parsed.data.gameSlug).single();
  if (gameError || !game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const { data: team, error } = await supabase.from("teams").insert({
    game_id: game.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    logo_url: parsed.data.logoUrl ?? null,
    captain_id: user.id,
  }).select("id, name, slug").single();
  if (error) return NextResponse.json({ error: "Team could not be created." }, { status: 400 });

  const { error: memberError } = await supabase.from("team_members").insert({ team_id: team.id, player_id: user.id, role: "captain" });
  if (memberError) {
    await supabase.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: "Team membership could not be initialized." }, { status: 400 });
  }
  return NextResponse.json(team, { status: 201 });
}
