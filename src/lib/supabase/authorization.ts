import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAdministrator(supabase: SupabaseClient) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, authorized: false };

  const { data, error } = await supabase.rpc("is_administrator");
  return { user, authorized: !error && data === true };
}