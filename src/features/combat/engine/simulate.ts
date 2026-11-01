/** The simulator (Dev mode): many seeded fights played by the autopilot, summed up. */
import { seeded } from "@/core/dice";
import type { FoeDef } from "../data";
import { autoTurn, type Policy } from "./autopilot";
import { newFight } from "./state";
import { rollInitiative, step } from "./turns";
import type { Fighter, Owned } from "./types";

export interface SimResult {
  fights: number; winRate: number; lossRate: number; drawRate: number;
  avgRounds: number; dmgPerTurn: number; avgHpLeft: number; avgPeakRage: number; surgesPerFight: number; sanityPerFight: number; felPerFight: number;
}

export function simulate(f: Fighter, foes: FoeDef[], owned: Owned, policy: Policy, pastRedDoublesRageDice: boolean, fights = 1000, seed = 1): SimResult {
  const rng = seeded(seed), opt = { pastRedDoublesRageDice, biteSpend: policy.biteSpend };
  let w = 0, l = 0, d = 0, rounds = 0, turns = 0, dealt = 0, hpLeft = 0, peak = 0, surges = 0, sanity = 0, fel = 0;
  for (let i = 0; i < fights; i++) {
    let s = rollInitiative(newFight(f, foes), f, rng);
    while (s.phase !== "over") s = s.phase === "player" ? autoTurn(s, f, owned, policy, rng, opt) : step(s, f, owned, rng);
    if (s.result === "win") { w++; hpLeft += Math.max(0, s.hp); } else if (s.result === "loss") l++; else d++;
    rounds += s.round; turns += s.playerTurns; dealt += s.stats.dealt; peak += s.stats.peakRage; surges += s.stats.surges; sanity += s.sanityLost; fel += s.fel;
  }
  return {
    fights, winRate: w / fights, lossRate: l / fights, drawRate: d / fights, avgRounds: rounds / fights,
    dmgPerTurn: dealt / Math.max(1, turns), avgHpLeft: w ? hpLeft / w : 0, avgPeakRage: peak / fights,
    surgesPerFight: surges / fights, sanityPerFight: sanity / fights, felPerFight: fel / fights,
  };
}
