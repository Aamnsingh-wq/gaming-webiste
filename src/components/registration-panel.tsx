"use client";

import Link from "next/link";
import { LogIn, UserPlus, Users } from "lucide-react";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import { Badge } from "@/components/ui";
import { useApi } from "@/components/use-api";

export type RegistrationState = {
  tournamentId: string;
  slug: string;
  status: string;
  teamSize: number;
  full: boolean;
  closesAt: string;
  preview: boolean;
  signedIn: boolean;
  registration: { id: string; status: string; viaTeam: string | null; canWithdraw: boolean } | null;
  captainTeam: { id: string; name: string; members: number } | null;
};

export function RegistrationPanel({ state }: { state: RegistrationState }) {
  const { run, busy, feedback } = useApi();
  const open = state.status === "registration_open" && new Date(state.closesAt).getTime() > Date.now();
  const teamEvent = state.teamSize > 1;

  if (state.preview) return <p className="notice notice-info">Preview event — registration is disabled until Supabase is connected.</p>;
  if (state.registration && state.registration.status !== "withdrawn") {
    return (
      <div className="stack">
        <div className="spread"><span className="muted">Your entry{state.registration.viaTeam ? ` (${state.registration.viaTeam})` : ""}</span><Badge status={state.registration.status} /></div>
        {state.registration.status === "pending" && <p className="faint" style={{ fontSize: 13 }}>An admin will review your entry before the bracket is drawn.</p>}
        {state.registration.canWithdraw && (
          <button className="btn btn-danger btn-block" type="button" disabled={busy} onClick={() => { if (confirm("Withdraw from this tournament?")) void run(`/api/registrations/${state.registration!.id}`, "DELETE", undefined, "You have withdrawn."); }}>
            <SubmitLabel busy={busy}>Withdraw entry</SubmitLabel>
          </button>
        )}
        <FeedbackNotice feedback={feedback} />
      </div>
    );
  }
  if (!open) return <p className="notice notice-info">{state.status === "upcoming" ? "Registration has closed — the bracket is being prepared." : state.status === "live" ? "This tournament is live." : state.status === "completed" ? "This tournament has finished." : "Registration is not open."}</p>;
  if (state.full) return <p className="notice notice-error">All slots are filled. Keep an eye out for the next event.</p>;
  if (!state.signedIn) {
    return <Link className="btn btn-primary btn-block" href={`/login?next=/tournaments/${state.slug}`}><LogIn size={17} /> Log in to register</Link>;
  }
  if (teamEvent) {
    if (!state.captainTeam) {
      return <div className="stack"><p className="notice notice-info">This is a {state.teamSize}-player team event. Your team captain registers the whole roster.</p><Link className="btn btn-neon btn-block" href="/teams"><Users size={17} /> Create or join a team</Link></div>;
    }
    const short = state.captainTeam.members !== state.teamSize;
    return (
      <div className="stack">
        <button className="btn btn-primary btn-block" type="button" disabled={busy || short} onClick={() => void run(`/api/tournaments/${state.tournamentId}/register-team`, "POST", { teamId: state.captainTeam!.id }, "Team registered! Your entry is pending review.")}>
          <SubmitLabel busy={busy}><Users size={17} /> Register {state.captainTeam.name}</SubmitLabel>
        </button>
        {short && <p className="faint" style={{ fontSize: 13 }}>Your roster has {state.captainTeam.members}/{state.teamSize} players. Team events need an exact roster.</p>}
        <FeedbackNotice feedback={feedback} />
      </div>
    );
  }
  return (
    <div className="stack">
      <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={() => void run(`/api/tournaments/${state.tournamentId}/register`, "POST", undefined, "You're in! Your entry is pending review.")}>
        <SubmitLabel busy={busy}><UserPlus size={17} /> Register now</SubmitLabel>
      </button>
      <FeedbackNotice feedback={feedback} />
    </div>
  );
}
