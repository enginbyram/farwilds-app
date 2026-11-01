/**
 * The fight on the Combat page: the engine state plus the timing around it.
 *   - while it is set up, it is rebuilt when foes, gear or skills change
 *   - foes act one at a time (FOE_STEP_MS apart), so the turn wheel can be followed
 *   - a living target is always picked
 *   - when the fight ends, wounds, lost Sanity and rest-limited cards go back to the sheet
 */
import { useEffect, useRef, useState } from "react";
import type { Condition } from "@/features/rules/types";
import {
  autoTurn, endTurn, newFight, playCard, rollInitiative, step, SKILLS, YOU,
  type CombatState, type FoeDef, type Fighter, type Owned, type PlayOptions, type Policy,
} from "./engine";

const FOE_STEP_MS = 650;

/** Cards whose uses carry over between fights until a rest (combat.json → skills → recharge). */
const restUses = (uses: Record<string, number>) => Object.fromEntries(Object.entries(uses).filter(([id, n]) => n > 0 && SKILLS[id]?.recharge));

export function useCombat({ fighter, foes, owned, condition, onFightEnd, rebuildOn }: {
  fighter: Fighter; foes: FoeDef[]; owned: Owned; condition: Condition; onFightEnd: (next: Condition) => void; rebuildOn: unknown[];
}) {
  const [fight, setFight] = useState<CombatState>(() => newFight(fighter, foes, condition.uses));
  const [targetKey, setTargetKey] = useState("foe0");
  const setup = fight.phase === "setup";

  // Rebuild the (unstarted) fight when foes, gear or skills change.
  useEffect(() => { if (setup) setFight(newFight(fighter, foes, condition.uses)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [...rebuildOn, setup]);
  // Foes act one by one.
  useEffect(() => {
    if (fight.phase !== "foes") return;
    const t = setTimeout(() => setFight(s => step(s, fighter, owned, Math.random)), fight.order[fight.cursor]?.key === YOU ? 120 : FOE_STEP_MS);
    return () => clearTimeout(t);
  });
  // Keep a living target.
  useEffect(() => {
    if (!fight.foes.some(x => x.key === targetKey && x.hpNow > 0)) {
      const next = fight.foes.find(x => x.hpNow > 0); if (next) setTargetKey(next.key);
    }
  }, [fight.foes, targetKey]);
  // When a fight ends, the wounds, lost Sanity and rest-limited cards go back to the sheet.
  const saved = useRef<CombatState | null>(null);
  useEffect(() => {
    if (fight.phase !== "over" || saved.current === fight) return;
    saved.current = fight;
    onFightEnd({ ...condition, hpLost: Math.max(0, fighter.hpMax - Math.max(0, fight.hp)), sanityLost: condition.sanityLost + fight.sanityLost, uses: restUses(fight.uses) });
  }, [fight]);   // eslint-disable-line react-hooks/exhaustive-deps

  return {
    fight, setup, targetKey, setTargetKey,
    myTurn: fight.phase === "player",
    start: () => setFight(rollInitiative(newFight(fighter, foes, condition.uses), fighter, Math.random)),
    reset: () => setFight(newFight(fighter, foes, condition.uses)),
    play: (id: string, opt: PlayOptions) => setFight(s => playCard(s, fighter, owned, id, targetKey, Math.random, opt)),
    endTurn: () => setFight(s => endTurn(s)),
    autopilot: (policy: Policy, opt: PlayOptions) => setFight(s => autoTurn(s, fighter, owned, policy, Math.random, opt)),
  };
}

export type Combat = ReturnType<typeof useCombat>;
