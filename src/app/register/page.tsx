import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getViewer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getViewer()) redirect(next);
  return (
    <AuthShell eyebrow="One account, every arena" title="Create your player card" subtitle="Free forever. Register for tournaments, join a team, and start earning points.">
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
