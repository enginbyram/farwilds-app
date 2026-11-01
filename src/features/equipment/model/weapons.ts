/** The weapons a character can fight with, read from what it wears. */
import type { Item } from "@/features/rules/types";
import { catalogItem, isWeaponItem } from "./catalog";

/** One weapon choice in a fight. `properties` are lower-case: "two-handed", "thrown"… */
export interface WeaponChoice { key: string; name: string; dice: string; damageType: string; kind: "melee" | "ranged"; ap: number; equipped: boolean; properties: string[] }

export const UNARMED: WeaponChoice = { key: "unarmed", name: "Unarmed", dice: "1d4", damageType: "bludgeoning", kind: "melee", ap: 0, equipped: false, properties: [] };

/** What the character has equipped in its weapon slots, then bare hands. */
export function equippedWeapons(equipped: Record<string, Item>): WeaponChoice[] {
  const out: WeaponChoice[] = [];
  for (const slot of ["mainhand", "offhand", "ranged"]) {
    const it = equipped[slot], c = catalogItem(it?.ref);
    if (!it || !isWeaponItem(c) || !c?.damage) continue;
    if (out.some(w => w.key === c.id)) continue;
    const ranged = slot === "ranged" || c.category === "firearm";
    out.push({ key: `${slot}:${c.id}`, name: c.name, dice: c.damage, damageType: c.damage_type ?? "", kind: ranged ? "ranged" : "melee", ap: c.attack_power ?? 0, equipped: true, properties: (c.properties ?? []).map(x => x.toLowerCase()) });
  }
  out.push({ ...UNARMED });
  return out;
}
