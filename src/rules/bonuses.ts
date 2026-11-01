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
 *
 * Scaling bonuses: {"effect": "ar", "value": 2, "per": "armour", "step": 10} = ROUNDDOWN(2 × Armour ÷ 10).
 * `per` is a target (armour, attr:STR, skill:Endurance, hp…) and reads that target's total from gear and the
 * tree BEFORE any scaling bonus — so a scaling bonus never feeds itself.
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
  when?: string;           // conditional: listed, not added to the sheet
  cond?: string;           // a condition the combat engine knows: two-handed, thrown, ranged, offhand, melee, raging
  text?: string;           // a line that couldn't be read as a number
  /** Scaling: the bonus is rate × (total of `per` ÷ step), rounded down. `value` holds the result once summed. */
  scale?: { rate: number; per: string; step: number };
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

type EffectDef = { name?: string; target?: string; aliases?: string[] };
const norm = (s: string) => s.toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ").trim();

/** Every word or phrase that names an effect, longest first: key, name, aliases, skill names, attribute keys. */
function vocabulary(effects: Effects, skills: string[]): { phrase: string; target: string; label: string }[] {
  const out: { phrase: string; target: string; label: string }[] = [];
  for (const [key, def] of Object.entries(effects as Record<string, EffectDef>)) {
    if (key.startsWith("_") || !def?.target) continue;
    const label = def.name ?? key;
    for (const ph of [key, def.name, ...(def.aliases ?? [])]) if (ph) out.push({ phrase: norm(ph), target: def.target, label });
  }
  for (const s of skills) out.push({ phrase: norm(s), target: `skill:${s}`, label: s });
  for (const k of ATTR_KEYS) out.push({ phrase: k.toLowerCase(), target: `attr:${k}`, label: k });
  return out.sort((a, b) => b.phrase.length - a.phrase.length);
}

/** Conditions the combat engine understands, from the words of a bonus line. */
const CONDITIONS: [RegExp, string][] = [
  [/two[- ]handed/i, "two-handed"], [/thrown/i, "thrown"], [/ranged/i, "ranged"],
  [/off[- ]?hand/i, "offhand"], [/melee/i, "melee"], [/rag(e|ing)/i, "raging"],
];

/** "+2 STR", "+2 Armor Rating every 10 AR", "+2 bonus to attack rolls with thrown weapons", "+1 Main Action" →
 *  a line; anything that doesn't start with a number and name an effect → text only. */
export function parseBonusText(text: string, effects: Effects, skills: string[] = []): Omit<BonusLine, "source" | "from"> {
  const plain: Omit<BonusLine, "source" | "from"> = { target: "", label: text, value: 0, text };
  // Armour training: "Light and Medium Armor and Shields available to use", "Heavy Armor available to use".
  // The value is the heaviest tier named (Light 1, Medium 2, Heavy 3); the character's limit is the highest it has.
  if (/\barmou?r\b/i.test(text) && /\bavailable\b/i.test(text)) {
    const tier = (["heavy", "medium", "light"] as const).find(k => new RegExp(`\\b${k}\\b`, "i").test(text));
    if (tier) return { target: "armour_training", label: "Armour training", value: { light: 1, medium: 2, heavy: 3 }[tier], text };
  }
  const m = /^\s*'?\s*([+\-−]\s*\d+(?:\.\d+)?)\s+(.+?)\s*\.?\s*$/i.exec(text);
  if (!m) return plain;
  const value = Number(m[1].replace(/\s/g, "").replace("−", "-"));
  const rest = norm(m[2]);
  const words = vocabulary(effects, skills);
  const head = words.find(w => rest === w.phrase || rest.startsWith(`${w.phrase} `));
  if (!head) return plain;
  const tail = rest.slice(head.phrase.length).trim();

  // Scaling: "every 10 AR", "per 2 STR", "for every 5 Armour".
  const sc = /^(?:for )?(?:every|per|each)\s+(\d+(?:\.\d+)?)\s+(.+)$/.exec(tail);
  if (sc) {
    const per = words.find(w => norm(sc[2]) === w.phrase);
    if (per) return { target: head.target, label: head.label, value: 0, text, scale: { rate: value, per: per.target, step: Number(sc[1]) || 1 } };
  }
  if (!tail) return { target: head.target, label: head.label, value, text };
  // Anything after the effect is a condition: shown, not added; the combat engine reads the known ones.
  const cond = CONDITIONS.find(([re]) => re.test(tail))?.[1];
  return { target: head.target, label: head.label, value, text, when: tail, ...(cond ? { cond } : {}) };
}

/** world.json key, "skill:Endurance", an attribute short name, or any effect name or alias → { target, label }. */
function resolveAny(effect: string, effects: Effects): { target: string; label: string } | null {
  const r = resolve(effect, effects);
  if (r) return r;
  const w = vocabulary(effects, []).find(x => x.phrase === norm(effect));
  return w ? { target: w.target, label: w.label } : null;
}

function fromDef(b: BonusDef, effects: Effects, skills: string[]): Omit<BonusLine, "source" | "from"> {
  if (typeof b === "string") return parseBonusText(b, effects, skills);
  const r = resolveAny(String(b.effect ?? ""), effects);
  const value = Number(String(b.value ?? 0).replace("−", "-")) || 0;
  if (!r) return { target: "", label: String(b.effect), value, text: `${value >= 0 ? "+" : ""}${value} ${b.effect}${b.when ? ` ${b.when}` : ""}` };
  const scale = b.per ? { rate: value, per: resolveAny(b.per, effects)?.target ?? b.per, step: Number(b.step) || 1 } : undefined;
  return { ...r, value: scale ? 0 : value, ...(b.when ? { when: b.when } : {}), ...(scale ? { scale } : {}) };
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
  const add = (l: BonusLine) => {
    const [kind, arg] = l.target.split(/:(.*)/s);
    if (kind === "attr" && (ATTR_KEYS as readonly string[]).includes(arg)) ext.attributes[arg as AttrKey] += l.value;
    else if (kind === "skill") ext.skills[arg] = (ext.skills[arg] ?? 0) + l.value;
    else if (l.target === "armour") ext.armour += l.value;
    else if (l.target === "weapon_ap_melee") ext.meleeWeaponAP += l.value;
    else if (l.target === "weapon_ap_ranged") ext.rangedWeaponAP += l.value;
    else if (l.target === "armour_training") ext.flat.armour_training = Math.max(ext.flat.armour_training ?? 0, l.value);   // highest, not a sum
    else ext.flat[l.target] = (ext.flat[l.target] ?? 0) + l.value;
  };
  const total = (target: string) => {
    const [kind, arg] = target.split(/:(.*)/s);
    if (kind === "attr") return ext.attributes[arg as AttrKey] ?? 0;
    if (kind === "skill") return ext.skills[arg] ?? 0;
    if (target === "armour") return ext.armour;
    return ext.flat[target] ?? 0;
  };
  const live = ext.lines.filter(l => l.target && !l.when);
  live.filter(l => !l.scale).forEach(add);
  // Scaling bonuses read the totals above, then add on top.
  const scaled = live.filter(l => l.scale).map(l => ({ l, v: Math.floor((l.scale!.rate * total(l.scale!.per)) / l.scale!.step) }));
  for (const { l, v } of scaled) { l.value = v; add(l); }
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
