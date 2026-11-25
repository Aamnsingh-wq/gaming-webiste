"use client";

import { useRef, useState } from "react";
import { Check, GitBranch, Plus, X } from "lucide-react";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import { useApi } from "@/components/use-api";
import { GAMES } from "@/lib/games";

const toIso = (local: FormDataEntryValue | null) => (local ? new Date(String(local)).toISOString() : undefined);

export function CreateTournamentForm() {
  const { run, busy, feedback } = useApi();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const result = await run("/api/admin/tournaments", "POST", {
      gameSlug: form.get("gameSlug"), name, slug, description: form.get("description"), format: form.get("format"),
      registrationOpensAt: toIso(form.get("opens")), registrationClosesAt: toIso(form.get("closes")), startsAt: toIso(form.get("starts")),
      capacity: Number(form.get("capacity")), teamSize: Number(form.get("teamSize")), prizeLabel: form.get("prize"), accent: form.get("accent"),
    }, "Draft created. Publish it from the list when ready.");
    if (result.ok) { element.reset(); setName(""); setSlug(""); }
  }
  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Name</span><input value={name} onChange={(event) => { setName(event.target.value); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)); }} required minLength={3} maxLength={100} /></label>
        <label className="field"><span>URL slug</span><input value={slug} onChange={(event) => setSlug(event.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
        <label className="field"><span>Game</span><select name="gameSlug">{GAMES.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label>
        <label className="field"><span>Format</span><select name="format"><option value="single_elimination">Single elimination</option><option value="points">Points race</option><option value="double_elimination">Double elimination</option><option value="round_robin">Round robin</option></select></label>
        <label className="field"><span>Registration opens</span><input name="opens" type="datetime-local" required /></label>
        <label className="field"><span>Registration closes</span><input name="closes" type="datetime-local" required /></label>
        <label className="field"><span>Starts</span><input name="starts" type="datetime-local" required /></label>
        <label className="field"><span>Capacity</span><input name="capacity" type="number" min={2} max={4096} defaultValue={16} required /></label>
        <label className="field"><span>Team size</span><input name="teamSize" type="number" min={1} max={100} defaultValue={1} required /></label>
        <label className="field"><span>Prize</span><input name="prize" defaultValue="Community points" maxLength={100} required /></label>
        <label className="field"><span>Accent colour</span><input name="accent" type="color" defaultValue="#00e5ff" style={{ padding: 4 }} /></label>
        <label className="field full"><span>Description & rules</span><textarea name="description" maxLength={5000} /></label>
      </div>
      <div><button className="btn btn-primary" type="submit" disabled={busy}><SubmitLabel busy={busy}><Plus size={16} />Create draft</SubmitLabel></button></div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  draft: [{ status: "registration_open", label: "Open registration" }, { status: "upcoming", label: "Publish as upcoming" }],
  registration_open: [{ status: "upcoming", label: "Close registration" }, { status: "cancelled", label: "Cancel" }],
  upcoming: [{ status: "live", label: "Go live" }, { status: "registration_open", label: "Reopen registration" }, { status: "cancelled", label: "Cancel" }],
  live: [{ status: "completed", label: "Mark completed" }],
  completed: [], cancelled: [{ status: "draft", label: "Back to draft" }],
};

export function TournamentActions({ id, status, format }: { id: string; status: string; format: string }) {
  const { run, busy, feedback } = useApi();
  const canBracket = format === "single_elimination" && ["registration_open", "upcoming", "live"].includes(status);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="admin-row-actions">
        {(NEXT_STATUS[status] ?? []).map((action) => (
          <button key={action.status} className={`btn btn-sm ${action.status === "cancelled" ? "btn-danger" : "btn-ghost"}`} type="button" disabled={busy}
            onClick={() => { if (action.status !== "cancelled" || confirm("Cancel this tournament?")) void run(`/api/admin/tournaments/${id}`, "PATCH", { status: action.status }, `Status → ${action.label}`); }}>{action.label}</button>
        ))}
        {canBracket && <button className="btn btn-neon btn-sm" type="button" disabled={busy} onClick={() => { if (confirm("Generate (or regenerate) the bracket from approved entrants?")) void run(`/api/admin/tournaments/${id}/bracket`, "POST", undefined, (data: { entrants?: number }) => `Bracket drawn for ${data.entrants} entrants.`); }}><GitBranch size={14} />Draw bracket</button>}
      </div>
      <FeedbackNotice feedback={feedback} />
    </div>
  );
}

export function ReviewButtons({ url, approve = "approved", reject = "rejected" }: { url: string; approve?: string; reject?: string }) {
  const { run, busy, feedback } = useApi();
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="admin-row-actions">
        <button className="btn btn-success btn-sm" type="button" disabled={busy} onClick={() => void run(url, "PATCH", { status: approve })}><Check size={14} />Approve</button>
        <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => void run(url, "PATCH", { status: reject })}><X size={14} />Reject</button>
      </div>
      <FeedbackNotice feedback={feedback} />
    </div>
  );
}

export function VerifyMatch({ matchId, a, b }: { matchId: string; a: { id: string; name: string }; b: { id: string; name: string } }) {
  const { run, busy, feedback } = useApi();
  const [winner, setWinner] = useState(a.id);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const winnerName = winner === a.id ? a.name : b.name;
    if (!confirm(`Confirm ${winnerName} as the winner? This cannot be undone.`)) return;
    await run(`/api/admin/matches/${matchId}/verify`, "POST", { winnerRegistrationId: winner, result: { score: String(form.get("score") || "") }, evidenceUrl: form.get("evidence") || undefined }, `${winnerName} advances.`);
  }
  return (
    <form className="stack" style={{ gap: 8 }} onSubmit={(event) => void submit(event)}>
      <div className="inline-form">
        <label className="field" style={{ flex: "1 1 160px" }}><span>Winner</span><select value={winner} onChange={(event) => setWinner(event.target.value)}><option value={a.id}>{a.name}</option><option value={b.id}>{b.name}</option></select></label>
        <label className="field" style={{ flex: "0 1 110px" }}><span>Score</span><input name="score" placeholder="13-9" maxLength={40} /></label>
        <label className="field" style={{ flex: "1 1 180px" }}><span>Evidence URL</span><input name="evidence" type="url" pattern="https?://.*" placeholder="https://…" /></label>
        <button className="btn btn-success btn-sm" type="submit" disabled={busy} style={{ minHeight: 46 }}><SubmitLabel busy={busy}><Check size={14} />Verify</SubmitLabel></button>
      </div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function AwardPointsForm() {
  const { run, busy, feedback } = useApi();
  const key = useRef<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    key.current ??= crypto.randomUUID();
    const result = await run<{ duplicate: boolean }>("/api/admin/points", "POST", { username: String(form.get("username")).replace(/^@/, ""), kind: form.get("kind"), amount: Number(form.get("amount")), description: form.get("description"), idempotencyKey: key.current },
      (data) => (data.duplicate ? "Already applied (duplicate request ignored)." : "Points applied."));
    if (result.ok) { key.current = null; element.reset(); }
  }
  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Player username</span><input name="username" required minLength={3} maxLength={25} placeholder="@player" /></label>
        <label className="field"><span>Type</span><select name="kind"><option value="award">Award (+)</option><option value="refund">Refund (+)</option><option value="adjustment">Adjustment (−)</option></select></label>
        <label className="field"><span>Amount</span><input name="amount" type="number" min={1} max={1000000} required /></label>
        <label className="field"><span>Reason (shown to player)</span><input name="description" required minLength={3} maxLength={200} placeholder="1st place — Weekly Rumble #08" /></label>
      </div>
      <div><button className="btn btn-primary" type="submit" disabled={busy}><SubmitLabel busy={busy}>Apply points</SubmitLabel></button></div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function CreateRewardForm() {
  const { run, busy, feedback } = useApi();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const inventory = String(form.get("inventory") ?? "").trim();
    const result = await run("/api/admin/rewards", "POST", { name: form.get("name"), description: form.get("description"), pointsCost: Number(form.get("cost")), inventory: inventory === "" ? null : Number(inventory) }, "Reward published.");
    if (result.ok) element.reset();
  }
  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Name</span><input name="name" required minLength={2} maxLength={100} /></label>
        <label className="field"><span>Points cost</span><input name="cost" type="number" min={1} required /></label>
        <label className="field"><span>Stock <span className="faint">(blank = unlimited)</span></span><input name="inventory" type="number" min={0} /></label>
        <label className="field full"><span>Description</span><textarea name="description" maxLength={1000} /></label>
      </div>
      <div><button className="btn btn-primary" type="submit" disabled={busy}><SubmitLabel busy={busy}><Plus size={16} />Publish reward</SubmitLabel></button></div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function RewardToggle({ id, active }: { id: string; active: boolean }) {
  const { run, busy } = useApi();
  return <button className={`btn btn-sm ${active ? "btn-ghost" : "btn-success"}`} type="button" disabled={busy} onClick={() => void run(`/api/admin/rewards/${id}`, "PATCH", { isActive: !active })}>{active ? "Hide" : "Publish"}</button>;
}
