import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  gameSlug: z.enum(["bgmi", "brawl-stars", "minecraft", "free-fire", "valorant"]),
  gameUsername: z.string().trim().min(2).max(80),
  externalPlayerId: z.string().trim().min(2).max(120),
  evidenceUrl: z.string().url().max(2048).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = accountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid gaming account details.", details: parsed.error.flatten() }, { status: 400 });

  const { data: game, error: gameError } = await supabase.from("games").select("id").eq("slug", parsed.data.gameSlug).single();
  if (gameError || !game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const verificationStatus = parsed.data.gameSlug === "brawl-stars" && process.env.BRAWL_STARS_API_TOKEN ? "pending" : "unverified";
  const { data, error } = await supabase.from("connected_game_accounts").upsert({
    player_id: user.id,
    game_id: game.id,
    game_username: parsed.data.gameUsername,
    external_player_id: parsed.data.externalPlayerId,
    verification_status: verificationStatus,
    verification_evidence: parsed.data.evidenceUrl ?? null,
  }, { onConflict: "player_id,game_id,external_player_id" }).select("id, verification_status").single();
  if (error) return NextResponse.json({ error: "Gaming account could not be connected." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
