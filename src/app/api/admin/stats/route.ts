import { getAdminOverview } from "@/lib/data/admin";
import { handler, json, requireAdmin } from "@/lib/http";

export const GET = handler(async () => {
  const { supabase } = await requireAdmin();
  return json(await getAdminOverview(supabase));
});
