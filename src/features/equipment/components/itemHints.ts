/** Hover lines for items: one carried / worn, or one from the catalog (with its stats). */
import type { Item } from "@/features/rules/types";
import { kg } from "@/core/format";
import type { HintLine } from "@/ui";
import { categoryLabel, formatMoney, GEAR_SLOTS, itemWeight, toCopper, type CatalogItem } from "../model";

/** "Head ……… Iron helm", the quantity and its note — or "Head ……… Empty". */
export const itemLines = (title: string, it?: Item): HintLine[] =>
  it ? [[title, it.name], ...(it.qty && it.qty > 1 ? [["Quantity", it.qty] as [string, number]] : []), ...(it.note ? [it.note] : [])]
     : [[title, "Empty"]];

/** A bag cell: its category, quantity, note and weight. */
export const bagItemLines = (it: Item): HintLine[] => {
  const w = itemWeight(it);
  return [...itemLines(categoryLabel(it.kind) || "Item", it), ...(w ? [["Weight", kg(w)] as [string, string]] : [])];
};

const slotLabelOf = (id?: string) => GEAR_SLOTS.find(s => s.id === id)?.label;

/** Everything the catalog says about an item; `priceCp` adds its default price (Purchase / Sell). */
export function catalogLines(it: CatalogItem, priceCp?: number): HintLine[] {
  return [
    [categoryLabel(it.category), it.name],
    ...(slotLabelOf(it.slot) ? [["Slot", slotLabelOf(it.slot)!] as [string, string]] : []),
    ...(priceCp !== undefined ? [["Default price", formatMoney(toCopper(it.price))] as [string, string]] : []),
    ...(it.damage ? [["Damage", `${it.damage}${it.damage_type ? ` ${it.damage_type}` : ""}`] as [string, string]] : []),
    ...(it.armour !== undefined ? [["Armour", it.armour] as [string, number]] : []),
    ...(it.attack_power !== undefined ? [["Attack Power", it.attack_power] as [string, number]] : []),
    ...(it.reach_m !== undefined ? [["Reach", `${it.reach_m} m`] as [string, string]] : []),
    ...(it.range_m !== undefined ? [["Range", `${it.range_m} m`] as [string, string]] : []),
    ...(it.range_long_m !== undefined ? [["Long range", `${it.range_long_m} m (disadvantage)`] as [string, string]] : []),
    ...(it.armor_type ? [["Type", it.armor_type] as [string, string]] : []),
    ...(it.str_need !== undefined ? [["Strength needed", it.str_need] as [string, number]] : []),
    ...(it.stealth_disadvantage ? ["Disadvantage on Stealth while worn"] : []),
    ...(it.weight_kg !== undefined ? [["Weight", `${it.weight_kg} kg`] as [string, string]] : []),
    ...(it.properties?.length ? [it.properties.join(", ")] : []),
    ...(it.bonuses?.length ? [it.bonuses.join(", ")] : []),
    ...(it.stackable ? ["Stacks in one bag cell"] : []),
    ...(it.description ? [it.description] : []),
  ];
}

/** A short line under an item's name in a list: category · slot · damage · range. */
export function catalogMeta(it: CatalogItem): string {
  return [categoryLabel(it.category), slotLabelOf(it.slot), it.damage && `${it.damage}${it.damage_type ? ` ${it.damage_type}` : ""}`,
    it.range_m !== undefined && `${it.range_m}/${it.range_long_m ?? it.range_m} m`].filter(Boolean).join(" · ");
}
