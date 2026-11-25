"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import type { Feedback } from "@/components/use-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "forgot";

export function AuthForm({ mode: initialMode, next = "/dashboard" }: { mode: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const callback = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setFeedback({ tone: "error", text: "Authentication is not enabled yet. Add the Supabase URL and anon key to .env.local." });
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setFeedback(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/reset-password") });
        setFeedback(error ? { tone: "error", text: error.message } : { tone: "success", text: "If that email is registered, a reset link is on its way." });
        return;
      }
      if (mode === "register") {
        const username = String(form.get("username") ?? "").trim();
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, display_name: username }, emailRedirectTo: callback(next) } });
        if (error) return setFeedback({ tone: "error", text: error.message });
        if (!data.session) return setFeedback({ tone: "success", text: "Check your inbox to confirm your email and finish creating your account." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setFeedback({ tone: "error", text: error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message });
      }
      router.replace(next);
      router.refresh();
    } catch {
      setFeedback({ tone: "error", text: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)} noValidate={false}>
      {mode === "register" && (
        <label className="field"><span>Player name</span><input name="username" autoComplete="username" minLength={3} maxLength={24} required pattern="[A-Za-z0-9_]+" title="3-24 letters, numbers, or underscores" placeholder="ace_sniper" /></label>
      )}
      <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      {mode !== "forgot" && (
        <label className="field">
          <span className="spread"><span>Password</span>{mode === "login" && <button className="text-btn" type="button" onClick={() => { setMode("forgot"); setFeedback(null); }}>Forgot password?</button>}</span>
          <input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required />
          {mode === "register" && <small>At least 8 characters.</small>}
        </label>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        <SubmitLabel busy={busy} busyText="One moment…">{mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Enter the arena"}</SubmitLabel>
      </button>
      <FeedbackNotice feedback={feedback} />
      <p className="auth-foot">
        {mode === "forgot" ? <button className="text-btn" type="button" onClick={() => { setMode("login"); setFeedback(null); }}>← Back to log in</button>
          : mode === "register" ? <>Already have an account? <Link className="link" href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in</Link></>
          : <>New to ARENA? <Link className="link" href={`/register${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link></>}
      </p>
    </form>
  );
}
