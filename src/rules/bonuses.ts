/**
 * The bonus pipeline — every number a character gets from outside its own points passes through here.
 *
 *   sources  → lines            → External (compute.ts)       → Character page and Combat
 *   gear       one line per        attributes, skills, armour,
 *   tree nodes bonus, with its     AP, HP, pools, extra damage…
 *              source and target
 *
 * Sources:
 *   - Equipped items (src/data/equipment.json): armour, attack_power, and their `bonuses` text.
 *     Item bonus text is read when it looks like "+1 STR", "+2 Armour", "+1 cold damage while raging";
 *     anything else stays text on the item card.
 *   - Unlocked tree nodes (src/data/tree/gems/*.json → bonuses): {"effect": "str", "value": 2}.
 *
 * Where a bonus goes is set by its effect's `target` in world.json → effects (attr:STR, skill:Endurance,
 * armour, hp, ap, damage:cold…). A bonus with a `when` condition is listed but NOT added: it is
 * situational, and the combat engine will read it when that situation is modelled.
 * All bonuses are flat and stack (Rulebook 7.3).
 */
import { catalogItem } from "@/model/equipment";
import type { BonusDef, TreeNode, WorldDef } from "@/data/types";
import { ATTR_KEYS, type AttrKey, type CharacterSheet, type Item, zeroPoints } from "./types";

type Effects = WorldDef["effects"];

/** One bonus, as the hover cards show it. */
export interface BonusLine {
  source: string;          // "Iron helm", "Ability Score Improvement"
  from: "gear" | "tree";
  target: string;          // "attr:STR", "armour", "damage:cold"… ("" = text only)
  label: string;           // "Strength", "Armour"
  value: number;
  when?: string;           // conditional: listed, not added
  text?: string;           // a line that couldn't be read as a number
}

/** What the sheet receives from gear and the tree. compute.ts adds these on top of the character's own numbers. */
export interface External {
  attributes: Record<AttrKey, number>;
  skills: Record<string, number>;
  armour: number;
  meleeWeaponAP: number;    // AP of the equipped melee weapon (works inside the AP formula)
  rangedWeaponAP: number;   // AP of the equipped ranged weapon
  flat: Record<string, number>;   // every other target: hp, ap, ap_melee, sp, initiative, speed, quick, damage:cold…
  armourTypes: string[];    // types of the armour worn ("Medium Armor"…), for the proficiency check
  lines: BonusLine[];
}

export const NO_EXTERNAL: External = {
  attributes: zeroPoints(), skills: {}, armour: 0, meleeWeaponAP: 0, rangedWeaponAP: 0, flat: {}, armourTypes: [], lines: [],
};

/** world.json key, "skill:Endurance", or an attribute short name → { target, label }. */
function resolve(effect: string, effects: Effects): { target: string; label: string } | null {
  const key = effect.trim();
  if (/^skill:/i.test(key)) return { target: `skill:${key.slice(6).trim()}`, label: key.slice(6).trim() };
  const def = (effects as Record<string, { name?: string; target?: string }>)[key] ?? (effects as Record<string, { name?: string; target?: string }>)[key.toLowerCase()];
  if (def?.target) return { target: def.target, label: def.name ?? key };
  const up = key.toUpperCase();
  if ((ATTR_KEYS as readonly string[]).includes(up)) return { target: `attr:${up}`, label: up };
  return null;
}

/** Looks an effect up by its name too ("Armour", "Strength", "cold damage"). */
function resolveByName(name: string, effects: Effects): { target: string; label: string } | null {
  const n = name.trim().toLowerCase();
  for (const [key, def] of Object.entries(effects as Record<string, { name?: string; target?: string }>)) {
    if (key.startsWith("_") || !def?.target) continue;
    if (key.toLowerCase() === n || def.name?.toLowerCase() === n) return { target: def.target, label: def.name ?? key };
  }
  return resolve(name, effects);
}

/** "+1 STR", "-2 Speed", "+1 cold damage while raging" → a line; anything else → text only. */
export function parseBonusText(text: string, effects: Effects, skills: string[] = []): Omit<BonusLine, "source" | "from"> {
  const m = /^\s*([+\-−]\s*\d+(?:\.\d+)?)\s+(.+?)(?:\s+(while|when|if|against|vs\.?)\s+(.+))?\s*$/i.exec(text);
  if (m) {
    const value = Number(m[1].replace(/[−\s]/g, c => (c === "−" ? "-" : "")));
    const what = m[2];
    const r = resolveByName(what, effects)
      ?? (skills.find(s => s.toLowerCase() === what.trim().toLowerCase()) ? { target: `skill:${skills.find(s => s.toLowerCase() === what.trim().toLowerCase())}`, label: what.trim() } : null);
    if (r) return { ...r, value, ...(m[3] ? { when: `${m[3]} ${m[4]}` } : {}) };
  }
  return { target: "", label: text, value: 0, text };
}

function fromDef(b: BonusDef, effects: Effects, skills: string[]): Omit<BonusLine, "source" | "from"> {
  if (typeof b === "string") return parseBonusText(b, effects, skills);
  const r = resolve(String(b.effect ?? ""), effects);
  const value = Number(String(b.value ?? 0).replace("−", "-")) || 0;
  if (!r) return { target: "", label: String(b.effect), value, text: `${value >= 0 ? "+" : ""}${value} ${b.effect}${b.when ? ` ${b.when}` : ""}` };
  return { ...r, value, ...(b.when ? { when: b.when } : {}) };
}

const isWeapon = (cat?: string) => cat === "weapon" || cat === "firearm";

/** Every bonus line from what the character wears and the nodes it owns. */
export function bonusLines(sheet: Pick<CharacterSheet, "equipped">, owned: Iterable<TreeNode>, effects: Effects, skills: string[] = []): BonusLine[] {
  const lines: BonusLine[] = [];
  const seen = new Set<Item>();   // a two-handed weapon sits in two slots but counts once
  for (const [slot, it] of Object.entries(sheet.equipped)) {
    if (seen.has(it)) continue;
    seen.add(it);
    const c = catalogItem(it.ref);
    if (!c) continue;
    if (c.armour) lines.push({ source: c.name, from: "gear", target: "armour", label: "Armour", value: c.armour });
    if (c.attack_power && isWeapon(c.category))
      lines.push({ source: c.name, from: "gear", target: slot === "ranged" ? "weapon_ap_ranged" : "weapon_ap_melee", label: "Weapon AP", value: c.attack_power });
    for (const b of c.bonuses ?? []) lines.push({ source: c.name, from: "gear", ...parseBonusText(b, effects, skills) });
  }
  for (const n of owned) for (const b of n.bonusDefs ?? []) lines.push({ source: n.name, from: "tree", ...fromDef(b, effects, skills) });
  return lines;
}

/** Sums the always-on lines into the shape compute.ts reads. */
export function collectBonuses(sheet: Pick<CharacterSheet, "equipped">, owned: Iterable<TreeNode>, effects: Effects, skills: string[] = []): External {
  const ext: External = { attributes: zeroPoints(), skills: {}, armour: 0, meleeWeaponAP: 0, rangedWeaponAP: 0, flat: {}, armourTypes: [], lines: [] };
  ext.lines = bonusLines(sheet, owned, effects, skills);
  for (const l of ext.lines) {
    if (!l.target || l.when) continue;
    const [kind, arg] = l.target.split(/:(.*)/s);
    if (kind === "attr" && (ATTR_KEYS as readonly string[]).includes(arg)) ext.attributes[arg as AttrKey] += l.value;
    else if (kind === "skill") ext.skills[arg] = (ext.skills[arg] ?? 0) + l.value;
    else if (l.target === "armour") ext.armour += l.value;
    else if (l.target === "weapon_ap_melee") ext.meleeWeaponAP += l.value;
    else if (l.target === "weapon_ap_ranged") ext.rangedWeaponAP += l.value;
    else ext.flat[l.target] = (ext.flat[l.target] ?? 0) + l.value;
  }
  for (const it of new Set(Object.values(sheet.equipped))) {
    const t = catalogItem(it.ref)?.armor_type;
    if (t && catalogItem(it.ref)?.category === "armour") ext.armourTypes.push(t);
  }
  return ext;
}

/** The lines behind one target, for a hover card: [["Iron helm", "+2"], …]. */
export function linesFor(ext: External, ...targets: string[]): [string, string][] {
  return ext.lines.filter(l => targets.includes(l.target) && !l.when)
    .map(l => [l.source, `${l.value >= 0 ? "+" : ""}${l.value}`] as [string, string]);
}
