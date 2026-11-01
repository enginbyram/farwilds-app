/**
 * Dice and random numbers — no rules, no UI. Used by the combat engine and anything else that rolls.
 *
 *   parseDice("2d6+1") → { n: 2, d: 6, plus: 1 }
 *   const rng = seeded(7); die(rng, 20); rollN(rng, 2, 6)
 */

/** "2d6+1" → { n: 2, d: 6, plus: 1 }. A plain number is a flat amount; "" or "0" is nothing. */
export interface Dice { n: number; d: number; plus: number; }

export function parseDice(s: string | undefined): Dice {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(s ?? "");
  if (!m) { const flat = Number(s); return { n: 0, d: 0, plus: Number.isFinite(flat) ? flat : 0 }; }
  return { n: m[1] ? Number(m[1]) : 1, d: Number(m[2]), plus: m[3] ? Number(m[3].replace(/\s/g, "")) : 0 };
}

/** "2d6+1" written back out. */
export const diceText = (x: Dice) => `${x.n}d${x.d}${x.plus ? `+${x.plus}` : ""}`;

/** A source of random numbers in [0, 1). Math.random is one; seeded() makes a repeatable one. */
export type Rng = () => number;

/** Seeded random numbers (mulberry32), so a simulation can be repeated exactly. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One die: 1…d. */
export const die = (rng: Rng, d: number) => 1 + Math.floor(rng() * d);

/** n dice of size d, added up. */
export const rollN = (rng: Rng, n: number, d: number) => { let t = 0; for (let i = 0; i < n; i++) t += die(rng, d); return t; };

/** Rolls a Dice: its dice plus its flat part. `times` multiplies the number of dice (critical hits). */
export const roll = (rng: Rng, x: Dice, times = 1) => rollN(rng, x.n * times, x.d) + x.plus;
