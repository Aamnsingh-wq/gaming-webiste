import { NextResponse } from "next/server";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const [players, teams, tournaments, registrations, pendingAccounts, transactions] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id, status", { count: "exact" }),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }),
    supabase.from("connected_game_accounts").select("id", { count: "exact", head: true }).in("verification_status", ["unverified", "pending"]),
    supabase.from("point_transactions").select("amount").eq("kind", "award"),
  ]);

  const tournamentRows = tournaments.data ?? [];
  const totalPoints = (transactions.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  return NextResponse.json({
    players: players.count ?? 0,
    teams: teams.count ?? 0,
    activeTournaments: tournamentRows.filter((row) => ["registration_open", "upcoming", "live"].includes(row.status)).length,
    completedTournaments: tournamentRows.filter((row) => row.status === "completed").length,
    registrations: registrations.count ?? 0,
    pendingVerifications: pendingAccounts.count ?? 0,
    pointsDistributed: totalPoints,
  });
}
