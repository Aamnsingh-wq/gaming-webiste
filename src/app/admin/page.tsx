import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) redirect("/login");
  if (!authorized) redirect("/dashboard");

  const [players, teams, tournaments, registrations, pendingAccounts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id, status", { count: "exact" }),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }),
    supabase.from("connected_game_accounts").select("id", { count: "exact", head: true }).in("verification_status", ["unverified", "pending"]),
  ]);
  const tournamentRows = tournaments.data ?? [];
  const active = tournamentRows.filter((row) => ["registration_open", "upcoming", "live"].includes(row.status)).length;

  return <main className="dashboard-page"><div className="dashboard-top"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ARENA<span className="brand-dot">.</span></span></Link><Link className="text-button" href="/dashboard">Player HQ</Link></div><section className="dashboard-content"><p className="eyebrow">ADMIN CONTROL</p><h1>Operations overview.</h1><div className="dashboard-stats"><div><span>PLAYERS</span><strong>{players.count ?? 0}</strong></div><div><span>TEAMS</span><strong>{teams.count ?? 0}</strong></div><div><span>REGISTRATIONS</span><strong>{registrations.count ?? 0}</strong></div><div><span>ACTIVE EVENTS</span><strong>{active}</strong></div><div><span>PENDING VERIFICATIONS</span><strong>{pendingAccounts.count ?? 0}</strong></div></div><div className="dashboard-grid"><section className="account-form"><h2>Tournament management</h2><p>Use authenticated admin API routes to create tournaments, generate brackets, review registrations, and verify results.</p><code>/api/admin/tournaments</code></section><section className="account-form"><h2>Operational controls</h2><p>Manage provider verifications, rewards, products, orders, players, and audit logs in Supabase or through follow-on admin UI modules.</p></section></div></section></main>;
}
