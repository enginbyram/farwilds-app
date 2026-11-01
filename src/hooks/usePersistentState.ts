/**
 * useState that is also kept in the browser: it starts from the saved value and saves every change.
 *
 *   const [theme, setTheme] = usePersistentState("theme", "system");
 *
 * `codec` changes how the value is stored (default: JSON).
 */
import { useEffect, useState } from "react";
import { readStored, readStoredText, removeStored, writeStored, writeStoredText } from "@/core/storage";

export interface Codec<T> { read: (key: string, fallback: T) => T; write: (key: string, value: T) => void; }

export const jsonCodec = <T,>(): Codec<T> => ({ read: readStored, write: writeStored });

/** Stored as plain text ("tree", "dark"…): the value is the text itself. */
export const textCodec = <T extends string>(): Codec<T> => ({
  read: (key, fallback) => (readStoredText(key) as T) || fallback,
  write: (key, value) => writeStoredText(key, value),
});

/** Stored as "1" / "0". */
export const flagCodec: Codec<boolean> = {
  read: (key, fallback) => { const t = readStoredText(key); return t ? t === "1" : fallback; },
  write: (key, value) => writeStoredText(key, value ? "1" : "0"),
};

/** JSON, and `null` removes the saved value. */
export const optionalCodec = <T,>(): Codec<T | null> => ({
  read: (key, fallback) => readStored<T | null>(key, fallback),
  write: (key, value) => (value === null ? removeStored(key) : writeStored(key, value)),
});

export function usePersistentState<T>(key: string, initial: T | (() => T), codec: Codec<T> = jsonCodec<T>()) {
  const [value, setValue] = useState<T>(() =>
    codec.read(key, typeof initial === "function" ? (initial as () => T)() : initial));
  useEffect(() => { codec.write(key, value); }, [key, value]);   // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue] as const;
}
