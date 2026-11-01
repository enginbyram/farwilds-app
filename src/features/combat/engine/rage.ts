/**
 * Rage — the Barbarian's pool, and the held damage that waits on it.
 * Gaining past the cap is an overflow (checked as a surge when your next turn opens); spending down to 0
 * makes held damage land. Skills can step in at both points (rageOverflow, rageEmpty).
 */
import { each, first } from "../mechanics/registry";
import { say, T } from "./log";
import type { Ctx } from "./types";

export function gainRage(c: Ctx, n: number, why: string) {
  const { s, f } = c;
  if (n <= 0 || f.rageMax <= 0) return;
  const before = s.rage;
  s.rage = Math.min(f.rageMax, s.rage + n);
  const over = before + n - f.rageMax;
  say(s, "you", `${T("rage", `+${n} Rage`)} ${why} → ${T("stat", `${s.rage} Rage`)}`);
  if (over > 0) {
    s.cycle.overflow += over;   // checked once, when your next turn opens
    each(c, "rageOverflow", h => h(c, over));
  }
  s.stats.peakRage = Math.max(s.stats.peakRage, s.rage);
}

export function spendRage(c: Ctx, n: number) {
  const { s } = c;
  const was = s.rage; s.rage = Math.max(0, s.rage - n);
  if (was > 0 && s.rage === 0) releaseHeld(c);
}

/** Rage hit 0: held damage lands — unless a skill (Unbroken) deals with it. */
function releaseHeld(c: Ctx) {
  const { s } = c;
  if (s.held <= 0) return;
  if (first(c, "rageEmpty", h => h(c))) return;
  const holder = first(c, "holdDamage", (_h, name) => name) || "Held damage";
  s.hp -= s.held; say(s, "you", `Rage hits 0: ${T("skill", holder)} ${T("dmg", `${s.held} dmg`)} lands at once → ${T("stat", `${s.hp} HP`)}`);
  s.held = 0;
}
