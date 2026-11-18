import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const responseSchema = z.object({ status: z.enum(["accepted", "rejected"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = responseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invitation response." }, { status: 400 });
  const { id } = await context.params;

  const { data: invitation } = await supabase.from("team_invitations").select("team_id, invited_player_id, status").eq("id", id).single();
  if (!invitation || invitation.invited_player_id !== user.id || invitation.status !== "pending") {
    return NextResponse.json({ error: "Invitation not found or already answered." }, { status: 404 });
  }

  const { error } = await supabase.from("team_invitations").update({ status: parsed.data.status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Invitation could not be updated." }, { status: 400 });
  if (parsed.data.status === "accepted") {
    const { error: memberError } = await supabase.from("team_members").insert({ team_id: invitation.team_id, player_id: user.id, role: "member" });
    if (memberError) return NextResponse.json({ error: "Team membership could not be added." }, { status: 400 });
  }
  return NextResponse.json({ status: parsed.data.status });
}
