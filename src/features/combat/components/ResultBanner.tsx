/** Shown when a fight ends: the result, a line of numbers, and New fight. */
import type { CombatState } from "../engine";

const WORD = { win: "Victory", loss: "Defeat", draw: "Draw" } as const;

export function ResultBanner({ fight, onNew }: { fight: CombatState; onNew: () => void }) {
  if (!fight.result) return null;
  return (
    <div className={`cb__result cb__result--${fight.result}`}>
      <b>{WORD[fight.result]}</b>
      <span>Round {fight.round} · {fight.stats.dealt} damage dealt · {fight.stats.taken} taken</span>
      <button className="btn btn--class" onClick={onNew}>New fight</button>
    </div>
  );
}
