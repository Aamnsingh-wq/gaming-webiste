"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const registering = mode === "register";

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Authentication is not enabled yet. Add the Supabase URL and anon key to .env.local.");
      setBusy(false);
      return;
    }
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const result = registering
      ? await supabase.auth.signUp({ email, password, options: { data: { username: String(formData.get("username") ?? "").trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setMessage(result.error.message);
    } else if (registering && !result.data.session) {
      setMessage("Check your inbox to verify your email and finish creating your account.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form className="auth-form" action={(formData) => void submit(formData)}>
      {registering && <label>Player name<input name="username" autoComplete="username" minLength={3} maxLength={24} required pattern="[A-Za-z0-9_]+" /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={8} required /></label>
      <button className="button auth-submit" disabled={busy}>{busy ? "One moment..." : registering ? "Create player account" : "Enter the arena"}</button>
      {message && <p className="form-notice" role="status">{message}</p>}
      <p className="auth-switch">{registering ? "Already have an account?" : "New to the community?"} <Link href={registering ? "/login" : "/register"}>{registering ? "Log in" : "Create an account"}</Link></p>
      {!registering && <button className="text-button" formAction={async (formData) => { const client = createSupabaseBrowserClient(); if (!client) { setMessage("Configure Supabase first."); return; } const { error } = await client.auth.resetPasswordForEmail(String(formData.get("email") ?? "")); setMessage(error?.message ?? "Password reset link sent if that email is registered."); }}>Forgot password?</button>}
    </form>
  );
}