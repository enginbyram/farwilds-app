/**
 * Character files (.json): what "Save character" writes and "Load character" reads.
 *
 *   {
 *     "format": "farwilds-character", "version": 1, "savedAt": "...",
 *     "name": "...", "coreClass": "Fighter",
 *     "sheet":   { race, level, asc1, asc2, ranks, … },       ← what you typed
 *     "tree":    { "workbook": "...", "unlocked": ["101", …] } ← unlocked node ids
 *     "summary": { buildName, hp, … }                          ← read-only snapshot, ignored on load
 *   }
 */
import type { CharacterSheet, Rules } from "@/rules/types";
import type { Computed } from "@/rules/compute";
import { normaliseSheet } from "@/hooks/useSheet";

export const CHARACTER_FORMAT = "farwilds-character";
export const CHARACTER_FILE_VERSION = 2;

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

/** Rules file written by Dev mode → Export rules. */
export const rulesFile = (rules: Rules) =>
  ({ format: "farwilds-rules", savedAt: new Date().toISOString(), rules });

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
