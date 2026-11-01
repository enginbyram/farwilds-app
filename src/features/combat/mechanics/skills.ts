/** Reading a skill's numbers inside a mechanic. */
import { SKILLS, SKILL_IDS, type SkillDef } from "../data";
import type { Owned } from "../engine/types";

/**
 * The value of a skill field the fighter actually has: the base skill's number, replaced by an owned
 * upgrade's ("Headlong II" → impactDice 1d6). undefined when the skill isn't owned.
 */
export function eff<K extends keyof SkillDef>(owned: Owned, id: string, key: K): SkillDef[K] | undefined {
  if (!owned.has(id)) return undefined;
  let v = SKILLS[id]?.[key];
  for (const uid of SKILL_IDS) { const s = SKILLS[uid]; if (s.upgrades === id && owned.has(uid) && s[key] !== undefined) v = s[key]; }
  return v;
}

/** Is any owned skill an upgrade of `id`? (Shows "II" on its card.) */
export const isUpgraded = (owned: Owned, id: string) => SKILL_IDS.some(u => SKILLS[u].upgrades === id && owned.has(u));

/** A skill's number from combat.json, whether owned or not, with a fallback. */
export const num = (id: string, key: keyof SkillDef, fallback: number) => (SKILLS[id]?.[key] as number | undefined) ?? fallback;
