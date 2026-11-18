import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("notifications").select("id, kind, title, body, read_at, created_at").eq("player_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

const readSchema = z.object({ notificationIds: z.array(z.string().uuid()).max(50).optional(), readAll: z.boolean().optional() });

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = readSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification update." }, { status: 400 });
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("player_id", user.id).is("read_at", null);
  if (parsed.data.notificationIds?.length) query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("player_id", user.id).in("id", parsed.data.notificationIds);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Notifications could not be updated." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
