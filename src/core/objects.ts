/** Plain-object helpers. */

/** Deep copy of plain JSON data. */
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Reads "points.STR" from an object. */
export const getPath = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], o);

/** Returns a copy of `o` with "points.STR" set to `value` (the original is untouched). */
export function setPath<T>(o: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const obj = o as Record<string, unknown>;
  return { ...obj, [head]: rest.length ? setPath(obj[head], rest.join("."), value) : value } as T;
}

/** Adds or removes one entry of a Set, returning a new Set. */
export function toggled<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item); else next.add(item);
  return next;
}

/** A small stable hash (djb2) of a string — a fingerprint that changes whenever the text does. */
export const fingerprint = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h >>> 0;
};
