import { NextResponse } from "next/server";
import { getAdministrator } from "@/lib/supabase/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tournamentInputSchema } from "@/lib/tournaments/schemas";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { user, authorized } = await getAdministrator(supabase);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!authorized) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const parsed = tournamentInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tournament details.", details: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const { data, error } = await supabase.from("tournaments").insert({
    game_id: input.gameId,
    slug: input.slug,
    name: input.name,
    description: input.description,
    format: input.format,
    registration_opens_at: input.registrationOpensAt,
    registration_closes_at: input.registrationClosesAt,
    starts_at: input.startsAt,
    capacity: input.capacity,
    team_size: input.teamSize,
    prize_label: input.prizeLabel,
    accent: input.accent,
    created_by: user.id,
    status: "draft",
  }).select("id, slug, name, status").single();

  if (error) return NextResponse.json({ error: "Tournament could not be created." }, { status: 400 });
  await supabase.from("audit_logs").insert({ actor_id: user.id, action: "tournament.created", entity_type: "tournament", entity_id: data.id });
  return NextResponse.json(data, { status: 201 });
}