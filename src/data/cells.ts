/** Small helpers for reading spreadsheet cells safely. */

/** Any cell → trimmed string ("" for empty). */
export const text = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();

/** Any cell → number, or the fallback when empty / not a number. */
export const number = (v: unknown, fallback: number): number => {
  const s = text(v);
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isNaN(n) ? fallback : n;
};

/** Normalise an angle to 0–360. */
export const normAngle = (a: number): number => ((a % 360) + 360) % 360;

/** Shortest distance between two angles, 0–180. */
export const angleGap = (a: number, b: number): number =>
  Math.abs(((a - b) % 360 + 540) % 360 - 180);

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
