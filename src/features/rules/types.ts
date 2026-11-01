/**
 * Character rules — the same tables as the "Data" sheet of the Character Builder workbook.
 * Everything here is editable in Dev mode; the formulas that use it live in compute.ts.
 */

export type Status = "Settled" | "Proposed" | "Open";

/** Main where race or class gives an attribute 2, Side where it gives 1. */
export type Focus = "Main" | "Side" | "";

export const ATTR_KEYS = ["STR", "DEX", "CON", "ENC", "LOG", "WIS", "PRE", "RHE", "AUT"] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export type AttrPoints = Record<AttrKey, number>;

/** A single tunable number. */
export interface Param { key: string; value: number; unit: string; status: Status; note: string; }

export interface AttributeDef { name: string; short: AttrKey; aptitude: string; }
export interface AptitudeDef { name: string; short: string; opposite: string; gate: string; }
export interface SkillDef { name: string; attribute: AttrKey; }
export interface CoreClassDef { name: string; aptitude: string; hitDie: number; points: AttrPoints; identity: string; }
export interface AscendancyDef {
  name: string; coreClass: string; forbidden: boolean; hitDie: number;
  purequick: boolean; rage: boolean; fel: boolean; maxArmour: string; identity: string;
}
export interface CombinationDef { name: string; rootA: string; rootB: string; forbidden: boolean; description: string; }
/** speed: null = use BaseSpeed. */
export interface RaceDef { name: string; lineage: string; speed: number | null; points: AttrPoints; note: string; }
/** Marks (Noxos, Lumnos) and inborn powers (eye powers…). freePoints: extra creator points (the "None" choice). */
export interface MarkDef { name: string; kind: string; pole: string; points: AttrPoints; freePoints: number; note: string; }
/** playerStart: the tier every player character starts with (Deep). The others are for NPCs and lore. */
export interface WellTierDef { tier: string; frequency: string; base: number; growth: number; ceiling: number; playerStart: boolean; note: string; }
export interface ArmourDef { name: string; order: number; value: number; }
export interface ElementDef { name: string; subArts: string; }

export interface Rules {
  version: number;
  params: Param[];
  attributes: AttributeDef[];
  aptitudes: AptitudeDef[];
  skills: SkillDef[];
  coreClasses: CoreClassDef[];
  ascendancies: AscendancyDef[];
  combinations: CombinationDef[];
  races: RaceDef[];
  marks: MarkDef[];
  wellTiers: WellTierDef[];
  armour: ArmourDef[];
  elements: ElementDef[];
}

/**
 * What the player chooses. Name and core class are shared with the tree (features/character/state/useCharacter.ts).
 * Armour, AP, SP, Leech and attribute/skill bonuses are never typed: they will come from gear and
 * tree passives automatically (see `External` in compute.ts). Every player character has the starting well tier.
 */
export interface CharacterSheet {
  race: string;
  mark: string;
  level: number;
  asc1: string;
  asc2: string;
  dominant: string;
  subdominant: string;           // "None" until chosen (opens at Ascendancy III)
  points: AttrPoints;            // attribute points spent: creator + level ups
  skillPoints: Record<string, number>;  // spent from SkillPointsPerAscension × ascensions reached
  equipped: Record<string, Item>;        // gear slot id (src/data/gear.json) → the item worn there
  bag: Item[];                           // carried, not worn
  wealth: Record<string, number>;        // coin id (gold, silver, copper) → count
  valuables: Item[];                     // gems, jewellery and other trade goods
  condition: Condition;                  // what is used up since the last rest (rules/rest.ts)
}

/** Wear and tear between rests. Stored as amounts LOST, so a level up or new gear keeps the gap right. */
export interface Condition {
  hpLost: number;
  quickSpent: number;
  purequickSpent: number;
  sanityLost: number;
  uses: Record<string, number>;   // combat card id → times used since its recharge (Action Surge…)
}
export const FRESH: Condition = { hpLost: 0, quickSpent: 0, purequickSpent: 0, sanityLost: 0, uses: {} };

/** Anything a character can wear, carry or trade. Stats come later with the equipment chapter. */
export interface Item {
  name: string;
  kind?: string;   // gear slot id when worn; catalog category in the bag; "gem", "jewellery"… for valuables
  ref?: string;    // catalog id (src/data/equipment.json) when the item came from the catalog
  qty?: number;
  note?: string;
}

export const zeroPoints = (): AttrPoints =>
  Object.fromEntries(ATTR_KEYS.map(k => [k, 0])) as AttrPoints;
