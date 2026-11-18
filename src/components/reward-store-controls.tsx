"use client";

import { useState } from "react";

export function RedeemButton({ rewardId, pointsCost }: { rewardId: string; pointsCost: number }) {
  const [message, setMessage] = useState("");
  async function redeem() {
    const response = await fetch(`/api/rewards/${rewardId}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const result = await response.json();
    setMessage(response.ok ? (result.status === "already_redeemed" ? "Already redeemed." : `Redeemed for ${pointsCost} points.`) : result.error);
  }
  return <><button className="button" type="button" onClick={() => void redeem()}>{pointsCost} points</button>{message && <p className="form-notice" role="status">{message}</p>}</>;
}
