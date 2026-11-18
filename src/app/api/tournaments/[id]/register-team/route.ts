import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const teamRegistrationSchema = z.object({ teamId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Sign in to register." }, { status: 401 });
  const parsed = teamRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid team selection.", details: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  const { data, error } = await supabase.rpc("register_team_for_tournament", { target_tournament: id, target_team: parsed.data.teamId });
  if (error) {
    const status = /not found/i.test(error.message) ? 404 : /captain|match|size/i.test(error.message) ? 422 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ id: data, status: "pending" }, { status: 201 });
}
