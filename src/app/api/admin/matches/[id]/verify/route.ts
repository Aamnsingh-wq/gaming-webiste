import { NextResponse } from "next/server";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { matchResultInputSchema } from "@/lib/tournaments/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const parsed = matchResultInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid match result.", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  const { data, error } = await supabase.rpc("verify_tournament_match", {
    target_match: id,
    target_winner: parsed.data.winnerRegistrationId,
    target_result: parsed.data.result,
    target_evidence_url: parsed.data.evidenceUrl ?? null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    const status = message.includes("not authorized") ? 403 : message.includes("not found") ? 404 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ resultId: data, status: "verified" });
}