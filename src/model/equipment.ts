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
  damage?: string; damage_type?: string; reach_m?: number; range_m?: number; range_long_m?: number;
  armor_type?: string; str_need?: number; stealth_disadvantage?: boolean;
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

// ── Weight ──
/** Weight of one bag/slot entry (its quantity included). Items not from the catalog weigh nothing yet. */
export const itemWeight = (it: Item) => (catalogItem(it.ref)?.weight_kg ?? 0) * (it.qty ?? 1);
export const carriedWeight = (s: { bag: Item[]; equipped: Record<string, Item> }) =>
  [...s.bag, ...Object.values(s.equipped)].reduce((t, it) => t + itemWeight(it), 0);

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

// ── Wearing ──
/** Slots an item can go in: its catalog slot; rings either ring slot; one-handed weapons and shields in either hand. */
export function slotsFor(it: Item): string[] {
  const c = catalogItem(it.ref);
  if (!c?.slot) return [];
  if (c.slot === "ring1" || c.slot === "ring2") return ["ring1", "ring2"];
  if (c.category === "weapon" && c.slot === "mainhand" && !isTwoHanded(c)) return ["mainhand", "offhand"];
  return [c.slot];
}
export const isTwoHanded = (c?: CatalogItem) => !!c?.properties?.some(p => p.toLowerCase() === "two-handed");
export const isWeaponItem = (c?: CatalogItem) => c?.category === "weapon" || c?.category === "firearm";

/**
 * Wears bag[index] in `slot` (or its first free slot). Whatever was there goes back to the bag.
 * A two-handed weapon takes the main hand and empties the off hand; a stack is split, one is worn.
 */
export function wear(s: { bag: Item[]; equipped: Record<string, Item> }, index: number, slot?: string):
  { bag: Item[]; equipped: Record<string, Item> } | null {
  const it = s.bag[index];
  const options = it ? slotsFor(it) : [];
  if (!it || !options.length) return null;
  const target = slot && options.includes(slot) ? slot : options.find(o => !s.equipped[o]) ?? options[0];
  const bag = [...s.bag];
  const one: Item = { ...it, qty: undefined };
  if ((it.qty ?? 1) > 1) bag[index] = { ...it, qty: (it.qty ?? 1) - 1 }; else bag.splice(index, 1);
  const equipped = { ...s.equipped };
  const off = (k: string) => {
    const old = equipped[k];
    if (!old) return;
    for (const [kk, v] of Object.entries(equipped)) if (v === old) delete equipped[kk];
    bag.push(old);
  };
  off(target);
  const c = catalogItem(it.ref);
  if (isTwoHanded(c) && target === "mainhand") off("offhand");
  if (target === "offhand" && isTwoHanded(catalogItem(equipped.mainhand?.ref))) off("mainhand");
  delete one.qty;
  equipped[target] = { ...one, kind: target };
  return { bag, equipped };
}

/** Takes the item in `slot` off and puts it in the bag. */
export function unequip(s: { bag: Item[]; equipped: Record<string, Item> }, slot: string) {
  const it = s.equipped[slot];
  if (!it) return null;
  const equipped = { ...s.equipped };
  delete equipped[slot];
  const c = catalogItem(it.ref);
  return { equipped, bag: [...s.bag, { ...it, kind: c?.category ?? it.kind }] };
}

// ── Selling ──
/** What a merchant pays: the catalog price × SellRate (gear.json), in copper, rounded down. */
export const sellPrice = (it: Item) => {
  const c = catalogItem(it.ref);
  return c ? Math.floor(toCopper(c.price) * (gear.sellRate ?? 0.5)) : 0;
};
/** Puts copper into a purse in the largest coins. */
export function receive(purse: Record<string, number>, cp: number): Record<string, number> {
  const w = { ...purse };
  let left = Math.max(0, Math.floor(cp));
  for (const c of COINS_DESC) { const n = Math.floor(left / c.value); w[c.id] = (w[c.id] ?? 0) + n; left -= n * c.value; }
  return w;
}

// ── Weapons in a fight ──
export interface WeaponChoice { key: string; name: string; dice: string; damageType: string; kind: "melee" | "ranged"; ap: number; equipped: boolean }
/** The weapons a character can fight with: what it has equipped, then bare hands. */
export function equippedWeapons(equipped: Record<string, Item>): WeaponChoice[] {
  const out: WeaponChoice[] = [];
  for (const slot of ["mainhand", "offhand", "ranged"]) {
    const it = equipped[slot], c = catalogItem(it?.ref);
    if (!it || !isWeaponItem(c) || !c?.damage) continue;
    if (out.some(w => w.key === c.id)) continue;
    const ranged = slot === "ranged" || c.category === "firearm";
    out.push({ key: `${slot}:${c.id}`, name: c.name, dice: c.damage, damageType: c.damage_type ?? "", kind: ranged ? "ranged" : "melee", ap: c.attack_power ?? 0, equipped: true });
  }
  out.push({ key: "unarmed", name: "Unarmed", dice: "1d4", damageType: "bludgeoning", kind: "melee", ap: 0, equipped: false });
  return out;
}
