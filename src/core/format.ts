/** Small text helpers shared by every page. No React, no rules. */

/** +2, 0, −1 style: positive numbers get a plus sign. */
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** 3 → "III" (1–10); anything else stays a number. */
export const roman = (n: number): string => ROMAN[n] ?? String(n);

/** plural(1, "point") → "1 point", plural(3, "point") → "3 points". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
/** Just the ending: "s" unless n is 1. */
export const s = (n: number) => (n === 1 ? "" : "s");

/** 12.345 → "12.3 kg". */
export const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;
/** 0.256 → "26%". */
export const pct = (x: number) => `${Math.round(x * 100)}%`;
/** 3.14159 → "3.1". */
export const oneDecimal = (x: number) => (Math.round(x * 10) / 10).toString();

/** Cuts a long name: "Hobgoblin veteran" → "Hobgoblin…" (keeps `max` characters). */
export const shorten = (text: string, max = 11) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Two letters for a symbol: "Held Wounds" → "HW", "Blooded" → "Bl" ("II", "the", "of", "it" are skipped). */
export function initials(name: string) {
  const w = name.replace(/\bII\b/, "").trim().split(/\s+/).filter(x => !/^(the|of|it)$/i.test(x));
  return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : w[0].slice(0, 2);
}

/** "gem" → "Gem". */
export const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);
