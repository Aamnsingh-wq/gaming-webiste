"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Send, UserMinus, X } from "lucide-react";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import { useApi } from "@/components/use-api";
import { GAMES } from "@/lib/games";

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

export function TeamCreator() {
  const router = useRouter();
  const { run, busy, feedback } = useApi();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run<{ slug: string }>("/api/teams", "POST", { gameSlug: form.get("gameSlug"), name, slug, logoUrl: form.get("logoUrl") || undefined }, "Team created!");
    if (result.ok) router.push(`/teams/${result.data.slug}`);
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label className="field"><span>Game</span><select name="gameSlug" required>{GAMES.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></label>
        <label className="field"><span>Team name</span><input value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)); }} minLength={3} maxLength={60} required placeholder="Night Owls" /></label>
        <label className="field"><span>Team URL</span><input value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value.toLowerCase()); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={48} required /><small>arena/teams/{slug || "your-team"}</small></label>
        <label className="field"><span>Logo URL <span className="faint">(optional)</span></span><input name="logoUrl" type="url" pattern="https?://.*" placeholder="https://…" /></label>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy}><SubmitLabel busy={busy}>Create team</SubmitLabel></button>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function InvitationControls({ invitationId }: { invitationId: string }) {
  const { run, busy, feedback } = useApi();
  return (
    <div className="stack" style={{ gap: 8, justifyItems: "end" }}>
      <div className="row">
        <button className="btn btn-success btn-sm" type="button" disabled={busy} onClick={() => void run(`/api/teams/invitations/${invitationId}`, "PATCH", { status: "accepted" }, "Welcome to the team!")}><Check size={15} />Accept</button>
        <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void run(`/api/teams/invitations/${invitationId}`, "PATCH", { status: "rejected" }, "Invitation declined.")}><X size={15} />Decline</button>
      </div>
      <FeedbackNotice feedback={feedback} />
    </div>
  );
}

export function InviteForm({ teamId }: { teamId: string }) {
  const { run, busy, feedback } = useApi();
  const [username, setUsername] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await run(`/api/teams/${teamId}/invitations`, "POST", { username: username.replace(/^@/, "") }, `Invitation sent to @${username.replace(/^@/, "")}.`);
    if (result.ok) setUsername("");
  }
  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <div className="inline-form">
        <label className="field"><span>Invite by username</span><input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={25} placeholder="@player_name" autoComplete="off" /></label>
        <button className="btn btn-neon" type="submit" disabled={busy}><SubmitLabel busy={busy}><Send size={15} />Invite</SubmitLabel></button>
      </div>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}

export function RosterAction({ teamId, playerId, mode, label }: { teamId: string; playerId: string; mode: "remove" | "leave" | "disband"; label: string }) {
  const router = useRouter();
  const { run, busy, feedback } = useApi();
  const prompts = { remove: `Remove ${label} from the team?`, leave: "Leave this team?", disband: "Disband this team permanently?" };
  async function act() {
    if (!confirm(prompts[mode])) return;
    const result = await run(`/api/teams/${teamId}/members/${playerId}`, "DELETE", undefined, mode === "remove" ? `${label} was removed.` : "Done.");
    if (result.ok && mode !== "remove") router.push("/teams");
  }
  const Icon = mode === "remove" ? UserMinus : LogOut;
  return (
    <span className="stack" style={{ gap: 6 }}>
      <button className={`btn btn-sm ${mode === "remove" ? "btn-ghost" : "btn-danger"}`} type="button" disabled={busy} onClick={() => void act()} aria-label={mode === "remove" ? `Remove ${label}` : undefined}>
        <SubmitLabel busy={busy}><Icon size={14} />{mode === "remove" ? "Remove" : mode === "leave" ? "Leave team" : "Disband team"}</SubmitLabel>
      </button>
      <FeedbackNotice feedback={feedback} />
    </span>
  );
}
