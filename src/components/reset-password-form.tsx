"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackNotice, SubmitLabel } from "@/components/feedback";
import type { Feedback } from "@/components/use-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setFeedback({ tone: "error", text: "Passwords do not match." });
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setFeedback({ tone: "error", text: error.message });
    setFeedback({ tone: "success", text: "Password updated. Redirecting…" });
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={(event) => void submit(event)}>
      <label className="field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="field"><span>Confirm password</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}><SubmitLabel busy={busy}>Update password</SubmitLabel></button>
      <FeedbackNotice feedback={feedback} />
    </form>
  );
}
