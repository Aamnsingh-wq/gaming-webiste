"use client";

import { useState } from "react";

export function ProfileEditor({ username, displayName, bio, avatarUrl }: { username: string; displayName: string; bio: string; avatarUrl: string }) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), displayName: form.get("displayName"), bio: form.get("bio"), avatarUrl: form.get("avatarUrl") || null }) });
    setMessage(response.ok ? "Profile saved." : (await response.json()).error);
  }
  return <form className="account-form" onSubmit={(event) => void submit(event)}><h2>Player profile</h2><div className="form-grid"><label>Username<input name="username" defaultValue={username} pattern="[A-Za-z0-9_]{3,24}" required /></label><label>Display name<input name="displayName" defaultValue={displayName} maxLength={60} required /></label><label className="span-two">Avatar URL<input name="avatarUrl" type="url" defaultValue={avatarUrl} /></label><label className="span-two">Bio<textarea name="bio" defaultValue={bio} maxLength={500} /></label></div><button className="button" type="submit">Save profile</button>{message && <p className="form-notice" role="status">{message}</p>}</form>;
}

export function GameAccountLinker() {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { gameSlug: form.get("gameSlug"), gameUsername: form.get("gameUsername"), externalPlayerId: form.get("externalPlayerId"), evidenceUrl: form.get("evidenceUrl") || undefined };
    const response = await fetch("/api/game-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMessage(response.ok ? "Gaming account submitted." : (await response.json()).error);
  }
  return <form className="account-form" onSubmit={(event) => void submit(event)}><h2>Connected game accounts</h2><div className="form-grid"><label>Game<select name="gameSlug"><option value="bgmi">BGMI</option><option value="brawl-stars">Brawl Stars</option><option value="minecraft">Minecraft</option><option value="free-fire">Free Fire</option><option value="valorant">VALORANT</option></select></label><label>Game username<input name="gameUsername" minLength={2} maxLength={80} required /></label><label className="span-two">Player ID / tag<input name="externalPlayerId" minLength={2} maxLength={120} required /></label><label className="span-two">Verification evidence URL<input name="evidenceUrl" type="url" placeholder="Optional screenshot URL" /></label></div><button className="button" type="submit">Connect account</button>{message && <p className="form-notice" role="status">{message}</p>}</form>;
}
