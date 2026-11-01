/**
 * The item catalog: src/data/equipment.json, generated from the equipment workbook by
 * tools/equipment_xlsx_to_json.py. Look items up here; never read the JSON directly elsewhere.
 */
import catalog from "@/data/equipment.json";
import type { Item } from "@/features/rules/types";

export interface CatalogItem {
  id: string; name: string; category: string; slot?: string;
  price: { amount: number; coin: string };
  stackable?: boolean; weight_kg?: number; armour?: number; attack_power?: number;
  damage?: string; damage_type?: string; reach_m?: number; range_m?: number; range_long_m?: number;
  armor_type?: string; str_need?: number; stealth_disadvantage?: boolean;
  properties?: string[]; bonuses?: string[]; description?: string;
}
export interface Category { id: string; label: string }

export const CATEGORIES = catalog.categories as Category[];
export const CATALOG = catalog.items as CatalogItem[];
export const catalogItem = (id?: string) => (id ? CATALOG.find(x => x.id === id) : undefined);
export const categoryLabel = (id?: string) => CATEGORIES.find(c => c.id === id)?.label ?? id ?? "";

/** Icon per category (names from ui/icons.ts). */
const CATEGORY_ICON: Record<string, string> = {
  weapon: "melee", firearm: "ranged", ammunition: "ranged", armour: "chest", shield: "armour",
  clothing: "back", jewellery: "jewellery", tool: "tool", gear: "bag", consumable: "potion",
};
export const itemIcon = (it: { category?: string; kind?: string; slot?: string }) =>
  CATEGORY_ICON[it.category ?? it.kind ?? ""] ?? "other";

// ── Item properties ──
export const isTwoHanded = (c?: CatalogItem) => !!c?.properties?.some(p => p.toLowerCase() === "two-handed");
export const isWeaponItem = (c?: CatalogItem) => c?.category === "weapon" || c?.category === "firearm";
export const isConsumable = (c?: CatalogItem) => c?.category === "consumable";

// ── Weight ──
/** Weight of one bag/slot entry (its quantity included). Items not from the catalog weigh nothing yet. */
export const itemWeight = (it: Item) => (catalogItem(it.ref)?.weight_kg ?? 0) * (it.qty ?? 1);
export const carriedWeight = (s: { bag: Item[]; equipped: Record<string, Item> }) =>
  [...s.bag, ...Object.values(s.equipped)].reduce((t, it) => t + itemWeight(it), 0);
