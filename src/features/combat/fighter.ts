/**
 * From the character sheet to a fighter: everything the engine needs, worked out from the computed
 * character, the weapon in hand and the sheet's condition. Pure — the Combat page calls it every render.
 */
import { parseDice } from "@/core/dice";
import { catalogItem, equippedWeapons, isWeaponItem, type WeaponChoice } from "@/features/equipment/model";
import { attackPower, type Computed } from "@/features/rules/compute";
import { param } from "@/features/rules/params";
import type { BonusLine } from "@/features/rules/bonuses";
import type { ArmourDef, Condition, Item, Rules } from "@/features/rules/types";
import { COMBAT } from "./data";
import type { Fighter, Owned } from "./engine/types";
import { usesRage } from "./mechanics/registry";

/** Weapons to pick from: what is equipped, then bare hands; Dev mode adds the test presets from combat.json. */
export function weaponChoices(equipped: Record<string, Item>, devMode: boolean): WeaponChoice[] {
  return [
    ...equippedWeapons(equipped),
    ...(devMode ? COMBAT.weapons.map(w => ({ key: `test:${w.name}`, name: `${w.name} (test)`, dice: w.dice, damageType: w.damageType ?? "", kind: "melee" as const, ap: w.ap, equipped: false, properties: [] })) : []),
  ];
}

/** Does a conditional bonus ("+2 to attack with thrown weapons") apply to this weapon? */
function fits(cond: string | undefined, weapon: WeaponChoice, offhandWeapon: boolean) {
  return cond === "two-handed" ? weapon.properties.includes("two-handed")
    : cond === "thrown" ? weapon.properties.includes("thrown")
    : cond === "ranged" ? weapon.kind === "ranged"
    : cond === "melee" ? weapon.kind === "melee"
    : cond === "offhand" ? offhandWeapon && weapon.key.startsWith("mainhand:")
    : false;
}

export interface FighterInput {
  rules: Rules; c: Computed; name: string; weapon: WeaponChoice; equipped: Record<string, Item>;
  condition: Condition; owned: Owned; testArmour?: ArmourDef;
}

/** The fighter, and the conditional to-hit bonuses that apply (for the hover on Attack). */
export function buildFighter({ rules, c, name, weapon, equipped, condition, owned, testArmour }: FighterInput): { fighter: Fighter; condLines: BonusLine[] } {
  const mods = Object.fromEntries(c.attributes.map(a => [a.key, a.mod])) as Record<string, number>;
  const skill = (n: string) => c.skills.find(s => s.name === n)?.total ?? 0;
  const flat = (k: string) => c.external.flat[k] ?? 0;
  const offhandWeapon = isWeaponItem(catalogItem(equipped.offhand?.ref));
  const condLines = c.external.lines.filter(l => l.target === "attack" && l.when && fits(l.cond, weapon, offhandWeapon));
  const condAttack = condLines.reduce((t, l) => t + l.value, 0);
  const weaponAP = attackPower(rules, mods, weapon.kind, weapon.ap) + flat("ap") + flat(weapon.kind === "melee" ? "ap_melee" : "ap_ranged");
  const hasRageSkills = [...owned].some(usesRage);
  const fighter: Fighter = {
    name,
    hpMax: Math.max(1, Math.round(c.combat.hp)),
    mainActions: c.combat.mainActions, sideActions: c.combat.sideActions,
    level: c.level,
    hpStart: Math.max(0, Math.round(c.combat.hp) - condition.hpLost),   // the fight starts from the sheet's current HP
    defence: c.combat.defence,                     // physical attacks roll against the DEX score (1 Nov)
    armour: (testArmour?.value ?? 0) + c.combat.armour,
    attackBonus: weaponAP + c.combat.attack + condAttack,   // attack = d20 + AP (1 Nov) + to-hit bonuses
    ap: weaponAP,
    initiative: c.combat.initiative,
    weapon: parseDice(weapon.dice),
    weaponName: weapon.name, damageType: weapon.damageType,
    extraDamage: c.combat.extraDamage,
    endurance: skill("Endurance"), intimidation: skill("Intimidation"), conMod: mods.CON ?? 0,
    sanity: Math.max(0, c.pools.sanity - condition.sanityLost),
    rageMax: c.pools.rage ?? (hasRageSkills ? param(rules, "RageMax", 0) : 0),
  };
  return { fighter, condLines };
}
