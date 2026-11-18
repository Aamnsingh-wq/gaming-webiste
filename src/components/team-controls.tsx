"use client";

import { useState } from "react";

export function TeamCreator() {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameSlug: form.get("gameSlug"), name: form.get("name"), slug: form.get("slug"), logoUrl: form.get("logoUrl") || undefined }) });
    setMessage(response.ok ? "Team created." : (await response.json()).error);
  }
  return <form className="account-form" onSubmit={(event) => void submit(event)}><h2>Create a team</h2><div className="form-grid"><label>Game<select name="gameSlug"><option value="bgmi">BGMI</option><option value="brawl-stars">Brawl Stars</option><option value="minecraft">Minecraft</option><option value="free-fire">Free Fire</option><option value="valorant">VALORANT</option></select></label><label>Team name<input name="name" minLength={3} maxLength={60} required /></label><label>Team slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>Logo URL<input name="logoUrl" type="url" /></label></div><button className="button" type="submit">Create team</button>{message && <p className="form-notice" role="status">{message}</p>}</form>;
}

export function InvitationControls({ invitationId }: { invitationId: string }) {
  const [message, setMessage] = useState("");
  async function respond(status: "accepted" | "rejected") {
    const response = await fetch(`/api/teams/invitations/${invitationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setMessage(response.ok ? `Invitation ${status}.` : (await response.json()).error);
  }
  return <span className="invite-actions"><button type="button" onClick={() => void respond("accepted")}>Accept</button><button type="button" onClick={() => void respond("rejected")}>Reject</button>{message && <small>{message}</small>}</span>;
}
