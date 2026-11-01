/**
 * Character maths — pure functions, no UI. Change a NUMBER in Dev mode; change a FORMULA here.
 *
 * Score = ScoreMin (8) + race + mark + class + spent points (creator + level ups) + external.
 * "Main" / "Side" are not chosen: an attribute is Main where race or class gives it 2, Side where it gives 1.
 *
 * `external` (rules/bonuses.ts) is everything gear and unlocked tree nodes give: nothing is typed by hand.
 */
import { ATTR_KEYS, type AttrKey, type CharacterSheet, type Rules } from "./types";
import { type External, NO_EXTERNAL } from "./bonuses";
export { type External, NO_EXTERNAL } from "./bonuses";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export type Focus = "Main" | "Side" | "";
export interface AttributeRow {
  key: AttrKey; name: string; aptitude: string; focus: Focus;
  base: number; race: number; mark: number; cls: number; points: number; external: number; score: number; mod: number;
}
export interface Check { label: string; ok: boolean; message: string; }

/** Looks a parameter up by key; a missing key reads as 0. */
export const paramGetter = (rules: Rules) => {
  const m = new Map(rules.params.map(p => [p.key, p.value]));
  return (key: string) => m.get(key) ?? 0;
};

/** The well tier every player character starts with. */
export const startingWell = (rules: Rules) => rules.wellTiers.find(w => w.playerStart) ?? rules.wellTiers[0];

/** Free attribute points at creation: CreationPoints + the mark's free points (2 for "None"). */
export const creationBudget = (rules: Rules, mark: string) =>
  paramGetter(rules)("CreationPoints") + (rules.marks.find(m => m.name === mark)?.freePoints ?? 0);

/** The levels at which things open, all following from BandSize. */
export function derivedLevels(rules: Rules) {
  const band = paramGetter(rules)("BandSize") || 1;
  return { ascILevel: band + 1, ascIILevel: 2 * band + 1, expertiseStart: 2 * band + 1 };
}

export function bandLabel(level: number, bandSize: number) {
  const band = Math.floor((level - 1) / bandSize);
  const name = band === 0 ? "Core" : `Ascendancy ${ROMAN[band] ?? band}`;
  const inBand = ((level - 1) % bandSize) + 1;
  return { band, name, inBand, writtenAs: `${name} – Level ${inBand}` };
}

/** Main where race or class gives 2 (or more), Side where it gives 1. */
export function attributeFocus(rules: Rules, race: string, coreClass: string): Record<AttrKey, Focus> {
  const r = rules.races.find(x => x.name === race)?.points;
  const c = rules.coreClasses.find(x => x.name === coreClass)?.points;
  return Object.fromEntries(ATTR_KEYS.map(k => {
    const top = Math.max(r?.[k] ?? 0, c?.[k] ?? 0);
    return [k, top >= 2 ? "Main" : top >= 1 ? "Side" : ""];
  })) as Record<AttrKey, Focus>;
}

/** Attack Power from attributes and the weapon's own AP (the weapon AP works inside the formula, as before). */
export function attackPower(rules: Rules, M: Record<string, number>, kind: "melee" | "ranged", weaponAP = 0) {
  const p = paramGetter(rules);
  return kind === "melee"
    ? Math.floor((M.STR ?? 0) * (p("APMeleeSTR") + weaponAP) + (M.DEX ?? 0) * (p("APMeleeDEX") + weaponAP))
    : Math.floor((M.DEX ?? 0) * (p("APRangedDEX") + weaponAP));
}

export function computeCharacter(rules: Rules, s: CharacterSheet, coreClass: string, ext: External = NO_EXTERNAL) {
  const p = paramGetter(rules);
  const lv = derivedLevels(rules);
  const L = Math.max(1, Math.round(s.level) || 1);
  const F = (k: string) => ext.flat[k] ?? 0;   // flat bonuses from gear and the tree (rules/bonuses.ts)
  const mod = (score: number) => Math.floor((score - p("ModBase")) / (p("ModDiv") || 1));

  const core = rules.coreClasses.find(c => c.name === coreClass);
  const asc = (n: string) => rules.ascendancies.find(a => a.name === n);
  const race = rules.races.find(r => r.name === s.race);
  const mark = rules.marks.find(m => m.name === s.mark);
  const aptOf = (cls?: string) => rules.coreClasses.find(c => c.name === cls)?.aptitude ?? "";

  // ── Progression ──
  const band = bandLabel(L, p("BandSize") || 1);
  const asc1Eff = L >= lv.ascILevel && s.asc1 ? s.asc1 : coreClass;
  const asc2Eff = L >= lv.ascIILevel && s.asc2 ? s.asc2 : "";
  const combo = asc2Eff
    ? rules.combinations.find(c => (c.rootA === asc1Eff && c.rootB === asc2Eff) || (c.rootA === asc2Eff && c.rootB === asc1Eff))
    : undefined;
  const buildName = !asc2Eff ? asc1Eff : combo ? combo.name : `${asc1Eff} / ${asc2Eff}`;
  const aptitude = core?.aptitude ?? "";
  const asc2Aptitude = asc2Eff ? aptOf(asc(asc2Eff)?.coreClass) : "";
  const opposite = rules.aptitudes.find(a => a.name === aptitude)?.opposite;
  const cross = !asc2Eff ? "" : asc2Aptitude === aptitude ? "no" : asc2Aptitude === opposite ? "opposite" : "neighbour";
  const gates: string[] = [];
  if (asc(asc1Eff)?.forbidden) gates.push("forbidden zone");
  if (asc2Eff) {
    if (asc(asc2Eff)?.forbidden) gates.push("forbidden zone");
    else if (cross === "neighbour" || cross === "opposite") gates.push(rules.aptitudes.find(a => a.name === asc2Aptitude)?.gate ?? "?");
  }
  const hdCore = core?.hitDie ?? 0;
  const hdAsc = asc(asc1Eff)?.hitDie ?? hdCore;
  const ascensions = Math.min(band.band, 8);   // ascendancy rings reached on the straight route

  // ── Attributes ──
  const focus = attributeFocus(rules, s.race, coreClass);
  const attributes: AttributeRow[] = ATTR_KEYS.map(k => {
    const def = rules.attributes.find(a => a.short === k);
    const base = p("ScoreMin");
    const raceP = race?.points[k] ?? 0, markP = mark?.points[k] ?? 0;
    const cls = core?.points[k] ?? 0;
    const points = s.points[k] ?? 0, external = ext.attributes[k] ?? 0;
    const score = base + raceP + markP + cls + points + external;
    return { key: k, name: def?.name ?? k, aptitude: def?.aptitude ?? "", focus: focus[k], base, race: raceP, mark: markP, cls, points, external, score, mod: mod(score) };
  });
  const M = Object.fromEntries(attributes.map(a => [a.key, a.mod])) as Record<AttrKey, number>;
  const creationPoints = creationBudget(rules, s.mark);
  const attributePointsAvailable = creationPoints + p("AttributePointsPerLevel") * (L - 1) + F("attr_points");   // + Ability Score Improvement nodes
  const pointsUsed = ATTR_KEYS.reduce((t, k) => t + (s.points[k] ?? 0), 0);
  const aptitudeMods = rules.aptitudes.map(ap => {
    const mods = attributes.filter(a => a.aptitude === ap.name).map(a => a.mod);
    return { name: ap.name, mod: mods.length ? Math.floor(mods.reduce((t, m) => t + m, 0) / mods.length) : 0 };
  });
  const aptMod = (n: string) => aptitudeMods.find(a => a.name === n)?.mod ?? 0;

  // ── Skills ──
  const skillPointsAvailable = ascensions * p("SkillPointsPerAscension");
  const skills = rules.skills.map(sk => {
    const m = M[sk.attribute] ?? 0, points = s.skillPoints[sk.name] ?? 0, bonus = ext.skills[sk.name] ?? 0;
    return { name: sk.name, attribute: sk.attribute, mod: m, points, bonus, total: m + points + bonus };
  });
  const skillPointsUsed = skills.reduce((t, k) => t + k.points, 0);
  const endurance = skills.find(x => x.name === "Endurance")?.total ?? 0;

  // ── Combat stats ──
  const minLv = p("HPMinPerLevel");
  const hp = hdCore + M.CON
    + Math.min(L - 1, lv.ascILevel - 2) * Math.max(minLv, hdCore / 2 + 1 + M.CON)
    + Math.max(0, L - lv.ascILevel + 1) * Math.max(minLv, hdAsc / 2 + 1 + M.CON);
  const combat = {
    hp: hp + F("hp"),
    initiative: M.DEX + F("initiative"),
    defence: attributes.find(a => a.key === "DEX")?.score ?? 0,   // physical attacks roll against the DEX score (1 Nov)
    speed: (race?.speed ?? p("BaseSpeed")) + F("speed"),
    apMelee: attackPower(rules, M, "melee", ext.meleeWeaponAP) + F("ap") + F("ap_melee"),
    apRanged: attackPower(rules, M, "ranged", ext.rangedWeaponAP) + F("ap") + F("ap_ranged"),
    spWeave: aptMod("Intellect") + F("sp"),
    spWell: M.CON + F("sp"),
    spDivine: M.WIS + F("sp"),
    armour: ext.armour,
    leech: F("leech"),
    /** Extra damage by type from gear and the tree ("cold" → 1). Lands after Armour. */
    extraDamage: Object.fromEntries(Object.entries(ext.flat).filter(([k, v]) => k.startsWith("damage:") && v).map(([k, v]) => [k.slice(7), v])),
    rageGain: F("rage_gain"),
    attack: F("attack"),                 // to hit only, every attack
    mainActions: 1 + F("main_actions"),  // per turn
    sideActions: 1 + F("side_actions"),
  };

  // ── Resource pools ──
  const has = (flag: "purequick" | "rage" | "fel") => !!asc(asc1Eff)?.[flag] || !!(asc2Eff && asc(asc2Eff)?.[flag]);
  const tier = startingWell(rules);
  // Pools (1 Nov): Hit Die maximum + modifier, +PoolPerStep every PoolStepLevels levels after the first.
  // The well still caps the Quick pool; a Trace well (NPCs) holds none.
  const poolGrowth = p("PoolPerStep") * Math.floor((L - 1) / (p("PoolStepLevels") || 1));
  const quick = !tier || tier.ceiling === 0 ? 0 : Math.max(0, Math.min(tier.ceiling + F("well"), hdAsc + M.CON + poolGrowth + F("quick")));
  const pools = {
    quick, poolGrowth,
    purequick: has("purequick") ? Math.max(0, hdAsc + M.WIS + poolGrowth + F("purequick")) : null,
    rage: has("rage") ? p("RageMax") + F("rage_max") : null,
    fel: has("fel"),
    felLimit: has("fel") ? quick : null,
    sanity: p("SanityBase") + endurance + p("SanityPerLevel") * (L - 1) + F("sanity"),
  };

  // ── Affinity ──
  const subArts = rules.elements.find(e => e.name === s.dominant)?.subArts ?? "";
  const subdominantOpen = ascensions >= p("SubdominantAscension");
  const hasSub = !!s.subdominant && s.subdominant !== "None";
  const compound = hasSub && subdominantOpen ? `${s.dominant} + ${s.subdominant}` : "";

  // ── Checks ──
  const C = (label: string, ok: boolean, message: string): Check => ({ label, ok, message: ok ? "OK" : message });
  const maxPer = p("CreationMaxPerAttribute");
  // Armour training: the heavier limit of the two ascendancies (or the core class). "Medium Armor" → Medium.
  const order = (name?: string) => rules.armour.find(a => a.name === name)?.order ?? 0;
  const maxArmour = [asc1Eff, asc2Eff].filter(Boolean).map(a => asc(a)?.maxArmour ?? "")
    .reduce((best, n) => (order(n) > order(best) ? n : best), "");
  const tooHeavy = ext.armourTypes.filter(t => order(t.split(" ")[0]) > order(maxArmour));
  const overCap = attributes.filter(a => a.points > maxPer).map(a => a.key);
  const checks: Check[] = [
    C("Level", L >= 1 && L <= p("MaxLevel"), `Level must be 1–${p("MaxLevel")}`),
    C("Attribute points", pointsUsed <= attributePointsAvailable, `${pointsUsed} spent, ${attributePointsAvailable} available`),
    C(`Max ${maxPer} creator points per attribute`, L > 1 || overCap.length === 0, `Too many in ${overCap.join(", ")}`),
    C("No negative points", ATTR_KEYS.every(k => (s.points[k] ?? 0) >= 0) && skills.every(k => k.points >= 0), "A point value is below 0"),
    C("Scores within ScoreMax", attributes.every(a => a.score - a.external <= p("ScoreMax")), `A score passes ${p("ScoreMax")} before gear`),
    C("Skill points", skillPointsUsed <= skillPointsAvailable, `${skillPointsUsed} spent, ${skillPointsAvailable} available`),
    C("First ascendancy fits the core class", !s.asc1 || asc(s.asc1)?.coreClass === coreClass, `${s.asc1} is not an option for ${coreClass}`),
    C("First ascendancy unlocked", !s.asc1 || L >= lv.ascILevel, `Locked until level ${lv.ascILevel} (ring 1)`),
    C("Second ascendancy unlocked", !s.asc2 || L >= lv.ascIILevel, `Locked until level ${lv.ascIILevel} (ring 2)`),
    C("Second ascendancy valid", !s.asc2 || (!!s.asc1 && s.asc2 !== s.asc1),
      !s.asc1 ? "Choose the first ascendancy first" : "Cannot repeat the first ascendancy"),
    C("Affinities distinct", s.subdominant !== s.dominant, "Subdominant equals dominant"),
    C("Subdominant unlocked", !hasSub || subdominantOpen, `Subdominant opens at Ascendancy ${ROMAN[p("SubdominantAscension")] ?? p("SubdominantAscension")}`),
    C("Gate requirement", gates.length === 0, `Must reach: ${gates.join(", ")}`),
    C("Armour within training", tooHeavy.length === 0, `${tooHeavy.join(", ")} is heavier than ${maxArmour || "None"} (the build's limit)`),
  ];

  return {
    level: L, band, ascensions, keystonePoints: L, expertisePoints: Math.max(0, L - lv.expertiseStart + 1),
    lineage: race?.lineage ?? "", aptitude, asc1Eff, asc2Eff, buildName,
    combination: combo ?? null, cross, asc2Aptitude, gates, hitDie: hdAsc,
    attributes, pointsUsed, creationPoints, attributePointsAvailable, aptitudeMods, well: tier, skills, skillPointsUsed, skillPointsAvailable, combat, pools,
    subArts, compound, subdominantOpen, checks, levels: lv, external: ext, maxArmour, proficiencyPoints: F("proficiency"),
  };
}

export type Computed = ReturnType<typeof computeCharacter>;
