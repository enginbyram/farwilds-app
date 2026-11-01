/**
 * The character sheet (race, level, ascendancies, creator points…). Name, core class and unlocked
 * nodes belong to the tree character (useCharacter.ts) — every page shares them.
 * Saved in the browser so a reload keeps it.
 */
import { useEffect, useState } from "react";
import { ATTR_KEYS, type AttrPoints, type CharacterSheet, type Condition, FRESH, type Item, zeroPoints } from "@/rules/types";

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
  equipped: {},
  bag: [],
  wealth: { gold: 0, silver: 0, copper: 0 },
  valuables: [],
  condition: FRESH,
};

/** Keeps only well-formed items from a saved or hand-edited file. */
const asItem = (v: unknown): Item | null => {
  const o = v as Partial<Item> | null;
  if (!o || typeof o.name !== "string" || !o.name.trim()) return null;
  return {
    name: o.name, ...(typeof o.kind === "string" ? { kind: o.kind } : {}), ...(typeof o.ref === "string" ? { ref: o.ref } : {}),
    ...(Number.isFinite(o.qty) ? { qty: Number(o.qty) } : {}), ...(typeof o.note === "string" ? { note: o.note } : {}),
  };
};
const asItems = (v: unknown): Item[] => (Array.isArray(v) ? v.map(asItem).filter((x): x is Item => !!x) : []);

const n0 = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);
const asCondition = (v: unknown): Condition => {
  const o = (v ?? {}) as Partial<Condition>;
  return {
    hpLost: n0(o.hpLost), quickSpent: n0(o.quickSpent), purequickSpent: n0(o.purequickSpent), sanityLost: n0(o.sanityLost),
    uses: Object.fromEntries(Object.entries(o.uses ?? {}).map(([k, x]) => [k, n0(x)]).filter(([, x]) => x)),
  };
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
    equipped: Object.fromEntries(Object.entries(s.equipped ?? {}).map(([k, v]) => [k, asItem(v)]).filter(([, v]) => v)) as Record<string, Item>,
    bag: asItems(s.bag),
    wealth: Object.fromEntries(Object.entries({ ...d.wealth, ...s.wealth }).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))])),
    valuables: asItems(s.valuables),
    condition: asCondition(s.condition),
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
