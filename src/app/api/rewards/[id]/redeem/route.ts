import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const redeemSchema = z.object({ idempotencyKey: z.string().trim().min(8).max(128).optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = redeemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid redemption request." }, { status: 400 });
  const { id } = await context.params;
  const key = parsed.data.idempotencyKey ?? `redemption:${authData.user.id}:${id}:${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("redeem_reward", { target_reward: id, transaction_key: key });
  if (error) {
    const status = /sign in/i.test(error.message) ? 401 : /not available|stock/i.test(error.message) ? 404 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (data === null) return NextResponse.json({ status: "already_redeemed", idempotent: true });
  return NextResponse.json({ transactionId: data, status: "redeemed" }, { status: 201 });
}
