"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Trophy } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { EmptyState } from "@/components/ui";
import { GAMES } from "@/lib/games";
import type { Tournament } from "@/lib/platform-types";

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "registration_open", label: "Open" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
];

export function TournamentBrowser({ tournaments }: { tournaments: Tournament[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const game = params.get("game") ?? "all";
  const status = params.get("status") ?? "active";

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key); else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tournaments
      .filter((item) => game === "all" || item.game === game)
      .filter((item) => (status === "active" ? item.status !== "completed" : item.status === status))
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => (status === "completed" ? b.startsAt.localeCompare(a.startsAt) : 0));
  }, [tournaments, game, status, query]);

  return (
    <>
      <div className="toolbar">
        <div className="chip-group" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button key={filter.value} className="chip" type="button" aria-pressed={status === filter.value} onClick={() => setParam("status", filter.value, "active")}>{filter.label}</button>
          ))}
        </div>
        <label className="search"><Search size={16} /><span className="sr-only">Search tournaments</span><input type="search" placeholder="Search tournaments" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="chip-group" role="group" aria-label="Filter by game" style={{ marginBottom: 28 }}>
        <button className="chip" type="button" aria-pressed={game === "all"} onClick={() => setParam("game", "all", "all")}>All games</button>
        {GAMES.map((item) => (
          <button key={item.slug} className="chip" type="button" aria-pressed={game === item.slug} onClick={() => setParam("game", item.slug, "all")}>{item.name}</button>
        ))}
      </div>
      {visible.length ? (
        <div className="tournament-grid">{visible.map((tournament, index) => <TournamentCard key={tournament.id} tournament={tournament} index={index} />)}</div>
      ) : (
        <EmptyState icon={Trophy} title="No tournaments match">Try another game or status filter — new events are published every week.</EmptyState>
      )}
    </>
  );
}
