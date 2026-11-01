/** Starting a fight, and the small state helpers every step uses. */
import { die } from "@/core/dice";
import { rule, type FoeDef } from "../data";
import { say, T } from "./log";
import type { CombatState, Fighter } from "./types";

/** `used` = rest-limited cards already used since their last recharge (the sheet's condition.uses). */
export function newFight(f: Fighter, foes: FoeDef[], used: Record<string, number> = {}): CombatState {
  return {
    phase: "setup", round: 0, order: [], cursor: 0, playerTurns: 0, used: { active: false, side: false }, extra: { active: 0, side: 0 }, uses: { ...used },
    hp: Math.min(f.hpMax, f.hpStart ?? f.hpMax), rage: 0, held: 0, heldQueue: [], bank: 0, guardDown: false, open: false, lostControl: false,
    fel: 0, sanityLost: 0,
    foes: foes.map((x, i) => {
      const same = foes.filter(y => y.name === x.name);   // "Bandit 1", "Bandit 2" when names repeat
      const name = same.length > 1 ? `${x.name} ${foes.slice(0, i + 1).filter(y => y.name === x.name).length}` : x.name;
      return { ...x, name, id: i, key: `foe${i}`, hpNow: x.hp, hasHitYou: false, eaten: false };
    }),
    cycle: freshCycle(),
    log: [], result: "", stats: { dealt: 0, taken: 0, peakRage: 0, surges: 0 },
  };
}

/** What happened since your last turn (read when your next turn opens). */
export const freshCycle = (): CombatState["cycle"] => ({ dealt: false, took: false, overflow: 0, banked: 0, charged: false, struck: false });

export const aliveFoes = (s: CombatState) => s.foes.filter(x => x.hpNow > 0);
export const livingFoe = (s: CombatState, key: string) => s.foes.find(x => x.key === key && x.hpNow > 0);

/** Heals you, never past your maximum. */
export const heal = (s: CombatState, f: Fighter, n: number) => { s.hp = Math.min(f.hpMax, s.hp + n); };

/**
 * At 0 HP you make death saving throws (Core Rulebook 9.6): a d20 each turn, DeathSaveDC or more is a recover
 * point, less is a loss point; DeathSavePoints of either kind ends it. Fighting alone, nobody can heal you,
 * so the saves are rolled straight away and the fight is lost either way: dead, or stable but downed.
 */
function deathSaves(s: CombatState, rng: () => number) {
  const dc = rule("DeathSaveDC") || 10, need = rule("DeathSavePoints") || 3;
  let up = 0, down = 0; const rolls: string[] = [];
  while (up < need && down < need) { const r = die(rng, 20); if (r >= dc) up++; else down++; rolls.push(T(r >= dc ? "check" : "fail", r)); }
  say(s, "you", `Death saving throws ${rolls.join(" ")} → ${up >= need ? T("check", `${up} recover: stable but downed`) : T("fail", `${down} loss: dead`)}`);
  return up >= need;
}

/** Ends the fight when you are down or every foe is. */
export function checkOver(s: CombatState, rng?: () => number) {
  if (s.result) return;
  if (s.hp <= 0) {
    const stable = rng ? deathSaves(s, rng) : false;
    s.result = "loss"; s.phase = "over";
    say(s, "sys", `${T("fail", "Defeat")} You fall in round ${s.round}${stable ? " and lie stable, downed until healed to 1 HP" : ""}.`);
  }
  else if (!aliveFoes(s).length) { s.result = "win"; s.phase = "over"; say(s, "sys", `${T("hit", "Victory")} in round ${s.round}.`); }
}
