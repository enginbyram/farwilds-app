/**
 * The character sheet (race, level, ascendancies, creator points, gear…). Name, core class and unlocked
 * nodes belong to the tree character (useCharacter.ts) — every page shares them.
 * Saved in the browser so a reload keeps it.
 */
import { useEffect, useState } from "react";
import { readStored, writeStored } from "@/core/storage";
import type { CharacterSheet } from "@/features/rules/types";
import { normaliseSheet } from "./sheet";

const KEY = "farwilds.sheet";

export function useSheet() {
  const [sheet, setSheet] = useState<CharacterSheet>(() => normaliseSheet(readStored<unknown>(KEY, undefined)));
  useEffect(() => { writeStored(KEY, sheet); }, [sheet]);
  const update = <K extends keyof CharacterSheet>(k: K, v: CharacterSheet[K]) => setSheet(s => ({ ...s, [k]: v }));
  return { sheet, setSheet, update };
}

export type SheetState = ReturnType<typeof useSheet>;
