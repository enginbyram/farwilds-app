/**
 * Character files (.json): what "Save character" writes and "Load character" reads.
 *
 *   {
 *     "format": "farwilds-character", "version": 1, "savedAt": "...",
 *     "name": "...", "coreClass": "Fighter",
 *     "sheet":   { race, level, asc1, asc2, points, …,
 *                  equipped, bag, wealth, valuables },         ← what you typed / carry
 *     "tree":    { "workbook": "...", "unlocked": ["101", …] } ← unlocked node ids
 *     "summary": { buildName, hp, … }                          ← read-only snapshot, ignored on load
 *   }
 */
import type { CharacterSheet } from "@/features/rules/types";
import type { Computed } from "@/features/rules/compute";
import { normaliseSheet } from "./state/sheet";

export const CHARACTER_FORMAT = "farwilds-character";
export const CHARACTER_FILE_VERSION = 3;

export interface CharacterFile {
  format: typeof CHARACTER_FORMAT;
  version: number;
  savedAt: string;
  name: string;
  coreClass: string;
  sheet: CharacterSheet;
  tree: { workbook: string; unlocked: string[] };
  summary?: Record<string, unknown>;
}

export function makeCharacterFile(name: string, coreClass: string, sheet: CharacterSheet,
  workbook: string, unlocked: string[], c: Computed): CharacterFile {
  return {
    format: CHARACTER_FORMAT, version: CHARACTER_FILE_VERSION, savedAt: new Date().toISOString(),
    name, coreClass, sheet, tree: { workbook, unlocked },
    summary: {
      level: c.band.writtenAs, buildName: c.buildName, hitDie: `d${c.hitDie}`,
      attributes: Object.fromEntries(c.attributes.map(a => [a.key, { score: a.score, mod: a.mod }])),
      combat: c.combat, pools: c.pools, checksFailing: c.checks.filter(x => !x.ok).map(x => x.message),
    },
  };
}

export function parseCharacterFile(text: string): CharacterFile {
  const f = JSON.parse(text) as Partial<CharacterFile>;
  if (f.format !== CHARACTER_FORMAT) throw new Error("not a Farwilds character file");
  return {
    format: CHARACTER_FORMAT, version: f.version ?? 1, savedAt: f.savedAt ?? "",
    name: f.name ?? "", coreClass: f.coreClass ?? "",
    sheet: normaliseSheet(f.sheet),
    tree: { workbook: f.tree?.workbook ?? "", unlocked: Array.isArray(f.tree?.unlocked) ? f.tree!.unlocked.map(String) : [] },
  };
}
