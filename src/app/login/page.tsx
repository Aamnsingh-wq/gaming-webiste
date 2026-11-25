import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getViewer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getViewer()) redirect(next);
  return (
    <AuthShell eyebrow="Welcome back" title="Log in" subtitle="Your bracket, your team, your points — right where you left them.">
      {params.error && <p className="notice notice-error" style={{ marginBottom: 16 }}>That link is invalid or has expired. Please try again.</p>}
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
