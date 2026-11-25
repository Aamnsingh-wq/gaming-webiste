import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Head-only counts: Postgres counts rows, nothing is transferred. */
export async function getAdminOverview(supabase: SupabaseClient) {
  const count = (query: PromiseLike<{ count: number | null }>) => Promise.resolve(query).then((result) => result.count ?? 0);
  const [players, teams, active, completed, pendingRegistrations, pendingAccounts, openMatches] = await Promise.all([
    count(supabase.from("profiles").select("id", { count: "exact", head: true })),
    count(supabase.from("teams").select("id", { count: "exact", head: true })),
    count(supabase.from("tournaments").select("id", { count: "exact", head: true }).in("status", ["registration_open", "upcoming", "live"])),
    count(supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("status", "completed")),
    count(supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(supabase.from("connected_game_accounts").select("id", { count: "exact", head: true }).in("verification_status", ["unverified", "pending"])),
    count(supabase.from("matches").select("id", { count: "exact", head: true }).in("status", ["scheduled", "awaiting_result", "under_review", "disputed"]).not("participant_a", "is", null).not("participant_b", "is", null)),
  ]);
  return { players, teams, activeTournaments: active, completedTournaments: completed, pendingRegistrations, pendingVerifications: pendingAccounts, openMatches };
}
