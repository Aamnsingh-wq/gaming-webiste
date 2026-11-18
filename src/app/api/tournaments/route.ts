import { NextResponse } from "next/server";
import { previewTournaments } from "@/lib/preview-data";
import type { Tournament } from "@/lib/platform-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ tournaments: previewTournaments, source: "preview" });
  }

  const { data, error } = await supabase
    .from("tournaments")
    .select("id, slug, name, game:games(slug), format, starts_at, registration_closes_at, capacity, prize_label, status, accent")
    .in("status", ["registration_open", "upcoming", "live"])
    .order("starts_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Unable to load tournaments." }, { status: 500 });

  const tournamentIds = (data ?? []).map((item) => item.id);
  const counts = tournamentIds.length
    ? await supabase.from("tournament_registrations").select("tournament_id").in("tournament_id", tournamentIds)
    : { data: [], error: null };
  const countByTournament = new Map<string, number>();
  for (const registration of counts.data ?? []) {
    countByTournament.set(registration.tournament_id, (countByTournament.get(registration.tournament_id) ?? 0) + 1);
  }

  const tournaments: Tournament[] = (data ?? []).map((item) => {
    const game = Array.isArray(item.game) ? item.game[0] : item.game;
    return {
      id: item.id,
      slug: item.slug,
      name: item.name,
      game: game?.slug ?? "bgmi",
      format: item.format,
      startsAt: item.starts_at,
      registrationClosesAt: item.registration_closes_at,
      entryCount: countByTournament.get(item.id) ?? 0,
      capacity: item.capacity,
      prizeLabel: item.prize_label,
      status: item.status,
      accent: item.accent,
    };
  });

  return NextResponse.json({ tournaments, source: "supabase" });
}