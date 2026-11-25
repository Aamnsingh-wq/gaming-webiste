import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cookie-aware client. Memoised per request so header + page share one instance. */
export const createSupabaseServerClient = cache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot write cookies; middleware refreshes sessions.
        }
      },
    },
  });
});

export type Viewer = {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  isAdmin: boolean;
};

/**
 * The signed-in player for this request (or null). Uses getClaims(), which
 * verifies the JWT locally when the project uses asymmetric signing keys, so
 * rendering a page does not cost an extra Auth round-trip. Mutating API routes
 * still use getUser() for a server-confirmed identity.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, points_balance, role")
    .eq("id", userId)
    .maybeSingle();
  return {
    id: userId,
    email: (data.claims.email as string | undefined) ?? null,
    username: profile?.username ?? "player",
    displayName: profile?.display_name || profile?.username || "Player",
    avatarUrl: profile?.avatar_url ?? null,
    points: Number(profile?.points_balance ?? 0),
    isAdmin: profile?.role === "administrator",
  };
});
