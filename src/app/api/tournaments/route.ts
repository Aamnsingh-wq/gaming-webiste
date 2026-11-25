import { getTournamentFeed } from "@/lib/data/public";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => {
  const feed = await getTournamentFeed();
  if (feed.error) return json({ error: feed.error }, 500);
  return json(feed);
});
