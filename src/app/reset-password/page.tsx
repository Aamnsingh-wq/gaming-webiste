import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  if (!(await getViewer())) redirect("/login?error=link");
  return (
    <AuthShell eyebrow="Account security" title="Choose a new password" subtitle="Use at least 8 characters. You'll stay signed in afterwards.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
