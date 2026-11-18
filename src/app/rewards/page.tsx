import Link from "next/link";
import { redirect } from "next/navigation";
import { RedeemButton } from "@/components/reward-store-controls";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RewardsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("points_balance").eq("id", user.id).single();
  const { data: rewards } = await supabase.from("rewards").select("id, name, description, points_cost, inventory").eq("is_active", true).order("points_cost");
  const { data: ledger } = await supabase.from("point_transactions").select("kind, amount, description, created_at").eq("player_id", user.id).order("created_at", { ascending: false }).limit(12);

  return <main className="dashboard-page"><div className="dashboard-top"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ARENA<span className="brand-dot">.</span></span></Link><Link className="text-button" href="/dashboard">Player HQ</Link></div><section className="dashboard-content"><p className="eyebrow">REWARD VAULT</p><h1>{profile?.points_balance ?? 0} points.</h1><div className="store-grid">{rewards?.length ? rewards.map((reward) => <article className="store-card" key={reward.id}><p className="eyebrow">ARENA REWARD</p><h2>{reward.name}</h2><p>{reward.description}</p><span>{reward.inventory === null ? "Unlimited" : `${reward.inventory} remaining`}</span><RedeemButton rewardId={reward.id} pointsCost={reward.points_cost} /></article>) : <p className="auth-copy">No rewards are currently published.</p>}</div><h2>Transaction history</h2>{ledger?.length ? <ul className="registration-list">{ledger.map((entry, index) => <li key={`${entry.created_at}-${index}`}><span>{entry.description}</span><span className="status-tag">{entry.kind} · {entry.amount}</span></li>)}</ul> : <p className="auth-copy">No transactions yet.</p>}</section></main>;
}
