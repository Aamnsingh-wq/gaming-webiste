import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Tournament registration requires Supabase configuration." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Sign in to register." }, { status: 401 });

  const { id } = await context.params;
  const { data, error } = await supabase.rpc("register_tournament", { target_tournament: id });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("not found")) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
    if (message.includes("full") || message.includes("closed") || message.includes("already registered")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration could not be completed." }, { status: 400 });
  }

  return NextResponse.json({ id: data, status: "pending" }, { status: 201 });
}