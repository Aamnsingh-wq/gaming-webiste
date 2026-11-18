import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid registration status." }, { status: 400 });
  const { id } = await context.params;

  const { data: registration, error: readError } = await supabase.from("tournament_registrations").select("player_id, team_id").eq("id", id).single();
  if (readError || !registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  const { error } = await supabase.from("tournament_registrations").update({ status: parsed.data.status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Registration could not be reviewed." }, { status: 400 });

  const recipients = registration.player_id ? [registration.player_id] : [];
  if (registration.team_id) {
    const { data: members } = await supabase.from("team_members").select("player_id").eq("team_id", registration.team_id);
    recipients.push(...(members ?? []).map((member) => member.player_id));
  }
  await supabase.from("notifications").insert([...new Set(recipients)].map((playerId) => ({
    player_id: playerId,
    kind: "registration_review",
    title: `Registration ${parsed.data.status}`,
    body: `Your tournament registration was ${parsed.data.status}.`,
  })));
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "registration.reviewed", entity_type: "registration", entity_id: id, changes: { status: parsed.data.status } });
  return NextResponse.json({ status: parsed.data.status });
}
