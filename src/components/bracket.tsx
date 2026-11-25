import Link from "next/link";
import { Crown, GitBranch } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { bracketChampion, buildBracketView, type BracketSlot } from "@/lib/tournaments/bracket-view";
import type { Entrant, MatchRow } from "@/lib/platform-types";

function Slot({ slot, decided }: { slot: BracketSlot; decided: boolean }) {
  const state = slot.isWinner ? "winner" : slot.isBye ? "bye" : !slot.registrationId ? "tbd" : decided ? "loser" : "";
  const name = slot.href ? <Link href={slot.href} className="name">{slot.name}</Link> : <span className="name">{slot.name}</span>;
  return <div className={`bracket-slot ${state}`}>{name}{slot.isWinner && <Crown size={14} style={{ color: "var(--lime)", flex: "none" }} aria-label="Winner" />}</div>;
}

export function Bracket({ matches, entrants }: { matches: MatchRow[]; entrants: Entrant[] }) {
  const rounds = buildBracketView(matches, entrants);
  if (!rounds.length) {
    return <EmptyState icon={GitBranch} title="Bracket not drawn yet">Seeds are generated once registration closes and entrants are approved.</EmptyState>;
  }
  const championId = bracketChampion(matches);
  const champion = championId ? entrants.find((entrant) => entrant.registrationId === championId) : null;
  return (
    <>
      {champion && (
        <div className="champion"><Crown size={30} /><div><p className="eyebrow" style={{ margin: 0, color: "var(--amber)" }}>Champion</p><strong style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{champion.name}</strong></div></div>
      )}
      <div className="bracket-scroll" tabIndex={0} aria-label="Tournament bracket (scroll horizontally)">
        <div className="bracket">
          {rounds.map((round, roundIndex) => (
            <section className="bracket-round" key={round.round} aria-label={round.label}>
              <h3 className="bracket-round-title"><span>{round.label}</span><span>{round.matches.length} {round.matches.length === 1 ? "match" : "matches"}</span></h3>
              <div className="bracket-matches">
                {round.matches.map((match) => (
                  <div key={match.id} className={`bracket-match${roundIndex === rounds.length - 1 ? " final" : ""}`}>
                    <span className="bracket-match-no">M{match.number}</span>
                    <Slot slot={match.a} decided={match.decided} />
                    <Slot slot={match.b} decided={match.decided} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
