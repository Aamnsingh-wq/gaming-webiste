"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [
    ["Days", Math.floor(total / 86400)],
    ["Hrs", Math.floor((total % 86400) / 3600)],
    ["Min", Math.floor((total % 3600) / 60)],
    ["Sec", total % 60],
  ] as const;
}

export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = now === null ? null : new Date(target).getTime() - now;
  if (remaining !== null && remaining <= 0) return null;
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 10 }}>{label}</p>
      <div className="countdown" role="timer" aria-live="off">
        {parts(remaining ?? 0).map(([unit, value]) => (
          <div key={unit}><strong>{remaining === null ? "--" : String(value).padStart(2, "0")}</strong><span>{unit}</span></div>
        ))}
      </div>
    </div>
  );
}
