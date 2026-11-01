/**
 * Equipment catalog (src/data/equipment.json, generated from the equipment workbook by
 * tools/equipment_xlsx_to_json.py) and the money rules the Purchase drawer uses.
 * Coin values come from src/data/gear.json; all sums are worked in copper.
 */
import gear from "@/data/gear.json";
import catalog from "@/data/equipment.json";
import type { Item } from "@/rules/types";

export interface CatalogItem {
  id: string; name: string; category: string; slot?: string;
  price: { amount: number; coin: string };
  stackable?: boolean; weight_kg?: number; armour?: number; attack_power?: number;
  damage?: string; damage_type?: string; reach_m?: number;
  properties?: string[]; bonuses?: string[]; description?: string;
}
export interface Category { id: string; label: string }

export const CATEGORIES = catalog.categories as Category[];
export const CATALOG = catalog.items as CatalogItem[];
export const catalogItem = (id?: string) => (id ? CATALOG.find(x => x.id === id) : undefined);
export const categoryLabel = (id?: string) => CATEGORIES.find(c => c.id === id)?.label ?? id ?? "";

/** Icon per category (names from ICONS in components/ui.tsx). */
const CATEGORY_ICON: Record<string, string> = {
  weapon: "melee", firearm: "ranged", ammunition: "ranged", armour: "chest", shield: "armour",
  clothing: "back", jewellery: "jewellery", tool: "tool", gear: "bag", consumable: "potion",
};
export const itemIcon = (it: { category?: string; kind?: string; slot?: string }) =>
  CATEGORY_ICON[it.category ?? it.kind ?? ""] ?? "other";

// ── Money ──
export const COINS_DESC = [...gear.coins].sort((a, b) => b.value - a.value);
const COIN_BY_SHORT = Object.fromEntries(gear.coins.map(c => [c.short, c]));

export const coinValue = (short: string) => COIN_BY_SHORT[short]?.value ?? 1;
export const toCopper = (p: { amount: number; coin: string }) => p.amount * coinValue(p.coin);
export const walletCopper = (w: Record<string, number>) => gear.coins.reduce((t, c) => t + (w[c.id] ?? 0) * c.value, 0);

/** 1234 → "12 gp 3 sp 4 cp" (0 → "0 cp"). */
export function formatMoney(cp: number): string {
  let left = Math.max(0, Math.round(cp));
  const parts: string[] = [];
  for (const c of COINS_DESC) {
    const n = Math.floor(left / c.value);
    if (n) { parts.push(`${n} ${c.short}`); left -= n * c.value; }
  }
  return parts.join(" ") || `0 ${COINS_DESC[COINS_DESC.length - 1].short}`;
}

/**
 * Pays `cost` copper out of a purse the way a person would: smallest coins first, then breaks the
 * smallest coin that covers the rest and takes the change back in smaller coins.
 * Returns the new purse, or null when there is not enough money.
 */
export function pay(purse: Record<string, number>, cost: number): Record<string, number> | null {
  if (walletCopper(purse) < cost) return null;
  const asc = [...COINS_DESC].reverse();
  const w = { ...purse };
  let rest = cost;
  for (const c of asc) {
    const use = Math.min(w[c.id] ?? 0, Math.floor(rest / c.value));
    w[c.id] = (w[c.id] ?? 0) - use; rest -= use * c.value;
  }
  if (rest > 0) {
    const breaker = asc.find(c => c.value >= rest && (w[c.id] ?? 0) > 0);
    if (!breaker) {  // fall back: pool everything and give change in the largest coins
      let left = walletCopper(purse) - cost;
      const out: Record<string, number> = {};
      for (const c of COINS_DESC) { out[c.id] = Math.floor(left / c.value); left -= out[c.id] * c.value; }
      return out;
    }
    w[breaker.id] -= 1;
    let change = breaker.value - rest;
    for (const c of COINS_DESC) {
      if (c.value >= breaker.value) continue;
      const n = Math.floor(change / c.value);
      w[c.id] = (w[c.id] ?? 0) + n; change -= n * c.value;
    }
  }
  return w;
}

/** Puts `qty` of a catalog item in the bag: one stack for stackable items, one cell each otherwise. */
export function addToBag(bag: Item[], it: CatalogItem, qty: number): Item[] {
  const next = [...bag];
  const base: Item = { name: it.name, kind: it.category, ref: it.id, ...(it.description ? { note: it.description } : {}) };
  if (it.stackable) {
    const i = next.findIndex(x => x.ref === it.id);
    if (i >= 0) next[i] = { ...next[i], qty: (next[i].qty ?? 1) + qty };
    else next.push({ ...base, qty });
  } else {
    for (let k = 0; k < qty; k++) next.push({ ...base });
  }
  return next;
}
