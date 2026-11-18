import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const invitationSchema = z.object({ username: z.string().trim().regex(/^[A-Za-z0-9_]{3,24}$/) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid player username." }, { status: 400 });
  const { id } = await context.params;
  const { data: team } = await supabase.from("teams").select("id").eq("id", id).eq("captain_id", user.id).single();
  if (!team) return NextResponse.json({ error: "Only the team captain can invite players." }, { status: 403 });

  const { data: invited } = await supabase.from("profiles").select("id").eq("username", parsed.data.username).single();
  if (!invited) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const { data, error } = await supabase.from("team_invitations").insert({ team_id: id, invited_player_id: invited.id, invited_by: user.id }).select("id, status").single();
  if (error) return NextResponse.json({ error: "Invitation could not be created." }, { status: 400 });
  await supabase.from("notifications").insert({ player_id: invited.id, kind: "team_invitation", title: "Team invitation", body: "You have been invited to join a team." });
  return NextResponse.json(data, { status: 201 });
}
