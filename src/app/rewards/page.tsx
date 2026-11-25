import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Gift, LogIn } from "lucide-react";
import { RedeemButton } from "@/components/reward-store-controls";
import { EmptyState, PageHeader } from "@/components/ui";
import { getRewardCatalog } from "@/lib/data/public";
import { formatNumber, formatRelative } from "@/lib/format";
import { createSupabaseServerClient, getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rewards", description: "Spend the points you earn competing on in-game items and community perks." };

export default async function RewardsPage() {
  const [rewards, viewer] = await Promise.all([getRewardCatalog(), getViewer()]);
  const supabase = viewer ? await createSupabaseServerClient() : null;
  const ledger = supabase && viewer
    ? (await supabase.from("point_transactions").select("id, kind, amount, description, created_at").eq("player_id", viewer.id).order("created_at", { ascending: false }).limit(10)).data ?? []
    : [];

  return (
    <main className="page container">
      <PageHeader eyebrow="Reward vault" title={<>Turn wins into <span className="gradient-text">rewards</span></>} lead="Earn points for placements and participation, then redeem them here.">
        {viewer ? (
          <div className="stat" style={{ "--stat-accent": "var(--lime)", minWidth: 220 } as React.CSSProperties}><div className="stat-label"><Coins size={14} />Your balance</div><div className="stat-value" style={{ color: "var(--lime)" }}>{formatNumber(viewer.points)}</div></div>
        ) : <Link className="btn btn-primary" href="/login?next=/rewards"><LogIn size={16} />Log in to redeem</Link>}
      </PageHeader>

      {rewards.length ? (
        <div className="grid-3" style={{ marginBottom: 48 }}>
          {rewards.map((reward, index) => {
            const outOfStock = reward.inventory !== null && reward.inventory <= 0;
            return (
              <article key={reward.id} className="card card-hover reward-card reveal" style={{ animationDelay: `${index * 60}ms` }}>
                <div className="spread"><span className="icon"><Gift size={24} /></span><span className={`badge ${outOfStock ? "badge-rejected" : ""}`}>{reward.inventory === null ? "Unlimited" : outOfStock ? "Sold out" : `${reward.inventory} left`}</span></div>
                <h2 style={{ fontSize: 21 }}>{reward.name}</h2>
                {reward.description && <p className="muted" style={{ fontSize: 14 }}>{reward.description}</p>}
                <div className="cost">{formatNumber(reward.points_cost)} <span className="faint" style={{ fontSize: 14 }}>pts</span></div>
                {viewer ? <RedeemButton rewardId={reward.id} rewardName={reward.name} pointsCost={reward.points_cost} balance={viewer.points} outOfStock={outOfStock} /> : <div className="actions"><Link className="btn btn-ghost btn-block" href="/login?next=/rewards">Log in to redeem</Link></div>}
              </article>
            );
          })}
        </div>
      ) : <div style={{ marginBottom: 48 }}><EmptyState icon={Gift} title="The vault is being stocked">New rewards are published by admins — check back soon.</EmptyState></div>}

      {viewer && (
        <section className="card">
          <h2 className="card-title">Transaction history</h2>
          {ledger.length ? (
            <ul className="list">{ledger.map((entry) => {
              const credit = entry.kind === "award" || entry.kind === "refund";
              return <li key={entry.id} className="list-item"><span><span className="title">{entry.description}</span><span className="sub" style={{ display: "block" }}>{formatRelative(entry.created_at)}</span></span><span className={credit ? "amount-plus" : "amount-minus"}>{credit ? "+" : "−"}{formatNumber(entry.amount)}</span></li>;
            })}</ul>
          ) : <p className="faint">No transactions yet.</p>}
        </section>
      )}
    </main>
  );
}
