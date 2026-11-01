/**
 * The character sheet (race, level, ascendancies, creator points…). Name, core class and unlocked
 * nodes belong to the tree character (useCharacter.ts) — every page shares them.
 * Saved in the browser so a reload keeps it.
 */
import { useEffect, useState } from "react";
import { ATTR_KEYS, type AttrPoints, type CharacterSheet, zeroPoints } from "@/rules/types";

const KEY = "farwilds.sheet";

export const DEFAULT_SHEET: CharacterSheet = {
  race: "Northmen",
  mark: "None",
  level: 1,
  asc1: "",
  asc2: "",
  dominant: "Fire",
  subdominant: "None",
  points: zeroPoints(),
  skillPoints: {},
};

/** Old (v1) sheets chose a rank per attribute; turn those into creator points so nothing is lost. */
const RANK_POINTS: Record<string, number> = { Main: 4, Side: 2, Misc: 1 };

/** Fills anything missing from an older or hand-edited sheet with the defaults. */
export function normaliseSheet(raw: unknown): CharacterSheet {
  const s = (raw ?? {}) as Partial<CharacterSheet> & { ranks?: Record<string, string> };
  const d = DEFAULT_SHEET;
  let points: AttrPoints = { ...zeroPoints(), ...s.points };
  if (!s.points && s.ranks) points = Object.fromEntries(ATTR_KEYS.map(k => [k, RANK_POINTS[s.ranks![k]] ?? 0])) as AttrPoints;
  const str = (v: unknown, dflt: string) => (typeof v === "string" ? v : dflt);
  return {
    race: str(s.race, d.race), mark: str(s.mark, d.mark),
    level: Number.isFinite(s.level) ? Number(s.level) : d.level,
    asc1: str(s.asc1, ""), asc2: str(s.asc2, ""),
    dominant: str(s.dominant, d.dominant), subdominant: str(s.subdominant, d.subdominant),
    points,
    skillPoints: { ...s.skillPoints },
  };
}

export function useSheet() {
  const [sheet, setSheet] = useState<CharacterSheet>(() => {
    try { const raw = localStorage.getItem(KEY); return normaliseSheet(raw ? JSON.parse(raw) : undefined); }
    catch { return normaliseSheet(undefined); }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(sheet)); } catch { /* storage blocked */ }
  }, [sheet]);
  const update = <K extends keyof CharacterSheet>(k: K, v: CharacterSheet[K]) => setSheet(s => ({ ...s, [k]: v }));
  return { sheet, setSheet, update };
}

export type SheetState = ReturnType<typeof useSheet>;
