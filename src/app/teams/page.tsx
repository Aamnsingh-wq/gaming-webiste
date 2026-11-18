import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamCreator, InvitationControls } from "@/components/team-controls";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TeamsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: teams } = await supabase.from("team_members").select("role, teams(id, name, slug, logo_url)").eq("player_id", user.id);
  const { data: invitations } = await supabase.from("team_invitations").select("id, teams(name)").eq("invited_player_id", user.id).eq("status", "pending");

  return <main className="dashboard-page"><div className="dashboard-top"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ARENA<span className="brand-dot">.</span></span></Link><Link className="text-button" href="/dashboard">Player HQ</Link></div><section className="dashboard-content"><p className="eyebrow">SQUADS / ROSTERS</p><h1>Your teams.</h1><TeamCreator /><div className="dashboard-grid"><section><h2>Joined teams</h2>{teams?.length ? <ul className="registration-list">{teams.map((entry) => { const team = Array.isArray(entry.teams) ? entry.teams[0] : entry.teams; return <li key={team?.id}><span>{team?.name ?? "Team"}</span><span className="status-tag">{entry.role}</span></li>; })}</ul> : <p className="auth-copy">You do not have a team yet.</p>}</section><section><h2>Pending invitations</h2>{invitations?.length ? <ul className="registration-list">{invitations.map((entry) => { const team = Array.isArray(entry.teams) ? entry.teams[0] : entry.teams; return <li key={entry.id}><span>{team?.name ?? "Team"}</span><InvitationControls invitationId={entry.id} /></li>; })}</ul> : <p className="auth-copy">No invitations waiting.</p>}</section></div></section></main>;
}
