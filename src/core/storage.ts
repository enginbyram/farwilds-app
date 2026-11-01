/**
 * Browser storage (localStorage), safely: if storage is blocked or the saved text is broken,
 * reads fall back and writes are skipped. Nothing here throws.
 */

/** Reads and parses a saved value; `fallback` when missing, blocked or unreadable. */
export function readStored<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : (JSON.parse(raw) as T); }
  catch { return fallback; }
}

/** The saved text as-is ("" when missing or blocked). */
export function readStoredText(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

/** Saves a value as JSON. */
export function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: fine */ }
}

/** Saves text as-is. */
export function writeStoredText(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: fine */ }
}

export function removeStored(key: string) {
  try { localStorage.removeItem(key); } catch { /* storage blocked: fine */ }
}
