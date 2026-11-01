/**
 * Autopilot (Dev mode): plays your turn by simple, readable rules, for testing and the simulator.
 * The policy is Barbarian tactics for now; generic parts (strike, cards that give more actions) work for any class.
 */
import type { Rng } from "@/core/dice";
import { SKILL_IDS, SKILLS } from "../data";
import { BBR } from "../mechanics/classes/barbarian";
import { canPlay, playCard } from "./cards";
import { endTurn } from "./turns";
import { ATTACK, type CombatState, type Fighter, type Owned, type PlayOptions } from "./types";

export interface Policy {
  headlong: boolean; unmakeAt: number; berserker: boolean;
  biteBelowPct: number; biteSpend: number; corpseBelowPct: number;
}
export const DEFAULT_POLICY: Policy = { headlong: true, unmakeAt: 10, berserker: true, biteBelowPct: 40, biteSpend: 4, corpseBelowPct: 60 };

/** Plays your whole turn by the policy (side card first when it heals), then ends it. */
export function autoTurn(prev: CombatState, f: Fighter, owned: Owned, p: Policy, rng: Rng, opt: PlayOptions): CombatState {
  let s = prev;
  if (s.phase !== "player") return s;
  const target = () => s.foes.find(x => x.hpNow > 0)?.key ?? "";
  const ok = (id: string) => canPlay(s, owned, id, target()).ok;
  const hpPct = () => (s.hp / f.hpMax) * 100;
  const play = (id: string) => { s = playCard(s, f, owned, id, target(), rng, { ...opt, biteSpend: p.biteSpend }); };
  if (p.biteBelowPct && hpPct() < p.biteBelowPct && ok(BBR.biteDown)) play(BBR.biteDown);
  if (p.headlong && ok(BBR.headlong)) play(BBR.headlong);
  else if (p.corpseBelowPct && hpPct() < p.corpseBelowPct && ok(BBR.corpseEater)) play(BBR.corpseEater);
  else if (p.unmakeAt && s.rage >= p.unmakeAt && ok(BBR.unmake)) play(BBR.unmake);
  else if (ok(ATTACK)) play(ATTACK);
  // Cards that give more actions (Action Surge): use them, then strike again with each new Main action.
  for (const id of SKILL_IDS) {
    if (!SKILLS[id].grantActive || !ok(id) || !target()) continue;
    play(id);
    while (s.phase === "player" && s.extra.active > 0 && ok(ATTACK)) play(ATTACK);
  }
  if (p.berserker && ok(BBR.berserker)) play(BBR.berserker);
  return s.phase === "player" ? endTurn(s) : s;
}
