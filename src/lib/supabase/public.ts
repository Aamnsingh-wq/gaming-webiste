import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Cookie-less anon client for public, cacheable reads (tournament feed,
 * leaderboards, team profiles). Because it carries no session it is safe to
 * use inside `unstable_cache` and only ever sees what RLS exposes to `anon`.
 */
export function getPublicSupabase() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
