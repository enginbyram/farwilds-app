/**
 * What a character carries and wears — pure functions that take the bag and the worn slots and
 * return new ones (nothing is changed in place). Pages call these; they never edit the bag by hand.
 *
 *   addToBag, takeFromBag, removeFromBag  — the bag
 *   slotsFor, wear, unequip, dropWorn     — the paper doll
 */
import type { Item } from "@/features/rules/types";
import { catalogItem, isTwoHanded, type CatalogItem } from "./catalog";

/** The two parts of the sheet these functions work on. */
export interface Carried { bag: Item[]; equipped: Record<string, Item> }

// ── Bag ──
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

/** Takes `n` from bag[index] (the whole cell when that is all of it). */
export function takeFromBag(bag: Item[], index: number, n = 1): Item[] {
  const it = bag[index];
  if (!it) return bag;
  const qty = it.qty ?? 1;
  return n >= qty ? bag.filter((_, j) => j !== index) : bag.map((b, j) => (j === index ? { ...b, qty: qty - n } : b));
}

/** Removes bag[index] entirely, whatever its quantity. */
export const removeFromBag = (bag: Item[], index: number) => bag.filter((_, j) => j !== index);

/** Sells / removes counts per bag index ({ 2: 1, 5: 3 }) in one go. */
export function takeCounts(bag: Item[], counts: Record<number, number>): Item[] {
  const out: Item[] = [];
  bag.forEach((it, i) => {
    const n = counts[i] ?? 0, q = it.qty ?? 1;
    if (n >= q) return;
    out.push(n ? { ...it, qty: q - n } : it);
  });
  return out;
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

/**
 * Wears bag[index] in `slot` (or its first free slot). Whatever was there goes back to the bag.
 * A two-handed weapon takes the main hand and empties the off hand; a stack is split, one is worn.
 */
export function wear(s: Carried, index: number, slot?: string): Carried | null {
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
export function unequip(s: Carried, slot: string): Carried | null {
  const it = s.equipped[slot];
  if (!it) return null;
  const equipped = { ...s.equipped };
  delete equipped[slot];
  const c = catalogItem(it.ref);
  return { equipped, bag: [...s.bag, { ...it, kind: c?.category ?? it.kind }] };
}

/** Throws away what is worn in `slot` (from every slot it fills: a two-handed weapon fills two). */
export function dropWorn(equipped: Record<string, Item>, slot: string): Record<string, Item> {
  const gone = equipped[slot];
  const next = { ...equipped };
  for (const [k, v] of Object.entries(next)) if (v === gone) delete next[k];
  return next;
}
