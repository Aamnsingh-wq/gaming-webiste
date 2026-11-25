"use client";

import { useRef } from "react";
import { Coins } from "lucide-react";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import { useApi } from "@/components/use-api";

type Props = { rewardId: string; rewardName: string; pointsCost: number; balance: number; outOfStock: boolean };

export function RedeemButton({ rewardId, rewardName, pointsCost, balance, outOfStock }: Props) {
  const { run, busy, feedback } = useApi();
  // One key per redemption attempt: retries and double clicks replay the same
  // request instead of charging twice. A fresh key is minted after success.
  const key = useRef<string | null>(null);
  const short = balance < pointsCost;

  async function redeem() {
    if (!confirm(`Redeem "${rewardName}" for ${pointsCost.toLocaleString("en-IN")} points?`)) return;
    key.current ??= crypto.randomUUID();
    const result = await run<{ status: string }>(`/api/rewards/${rewardId}/redeem`, "POST", { idempotencyKey: key.current },
      (data) => (data.status === "already_redeemed" ? "That redemption was already processed." : "Redeemed! An admin will fulfil your reward shortly."));
    if (result.ok) key.current = null;
  }

  return (
    <div className="actions">
      <button className="btn btn-primary btn-block" type="button" disabled={busy || short || outOfStock} onClick={() => void redeem()}>
        <SubmitLabel busy={busy} busyText="Redeeming…"><Coins size={16} />{outOfStock ? "Out of stock" : short ? `Need ${(pointsCost - balance).toLocaleString("en-IN")} more` : "Redeem"}</SubmitLabel>
      </button>
      <FeedbackNotice feedback={feedback} />
    </div>
  );
}
