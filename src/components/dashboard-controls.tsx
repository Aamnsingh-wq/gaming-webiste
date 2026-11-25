"use client";

import { CheckCheck } from "lucide-react";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import { useApi } from "@/components/use-api";
import { GAMES } from "@/lib/games";

export function ProfileEditor({ username, displayName, bio, avatarUrl }: { username: string; displayName: string; bio: string; avatarUrl: string }) {
  const { run, busy, feedback } = useApi();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run("/api/profile", "PATCH", { username: form.get("username"), displayName: form.get("displayName"), bio: form.get("bio"), avatarUrl: form.get("avatarUrl") || null }, "Profile saved.");
  }
  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Username</span><input name="username" defaultValue={username} pattern="[A-Za-z0-9_]{3,24}" required title="3-24 letters, numbers, or underscores" /></label>
        <label className="field"><span>Display name</span><input name="displayName" defaultValue={displayName} maxLength={60} required /></label>
        <label className="field full"><span>Avatar URL</span><input name="avatarUrl" type="url" pattern="https?://.*" defaultValue={avatarUrl} placeholder="https://…" /></label>
        <label className="field full"><span>Bio</span><textarea name="bio" defaultValue={bio} maxLength={500} placeholder="Main role, favourite maps, achievements…" /></label>
      </div>
      <div><button className="btn btn-primary" type="submit" disabled={busy}><SubmitLabel busy={busy} busyText="Saving…">Save profile</SubmitLabel></button></div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function GameAccountLinker() {
  const { run, busy, feedback } = useApi();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await run("/api/game-accounts", "POST", { gameSlug: form.get("gameSlug"), gameUsername: form.get("gameUsername"), externalPlayerId: form.get("externalPlayerId"), evidenceUrl: form.get("evidenceUrl") || undefined }, "Account submitted for verification.");
    if (result.ok) formElement.reset();
  }
  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Game</span><select name="gameSlug">{GAMES.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label>
        <label className="field"><span>In-game name</span><input name="gameUsername" minLength={2} maxLength={80} required /></label>
        <label className="field full"><span>Player ID / tag</span><input name="externalPlayerId" minLength={2} maxLength={120} required placeholder="e.g. 5123456789 or Name#TAG" /></label>
        <label className="field full"><span>Verification screenshot URL <span className="faint">(optional, only admins can see it)</span></span><input name="evidenceUrl" type="url" pattern="https?://.*" placeholder="https://…" /></label>
      </div>
      <div><button className="btn btn-neon" type="submit" disabled={busy}><SubmitLabel busy={busy}>Link account</SubmitLabel></button></div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function MarkAllRead() {
  const { run, busy } = useApi();
  return <button className="text-btn" type="button" disabled={busy} onClick={() => void run("/api/notifications", "PATCH", { readAll: true })}><CheckCheck size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />Mark all read</button>;
}
