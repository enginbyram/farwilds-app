/**
 * The click menus for items (ui/Menu.tsx): what you can do with a bag cell or a gear slot.
 * Each entry calls a pure inventory function (model/inventory.ts) and reports what happened.
 */
import type { SheetState } from "@/features/character/state/useSheet";
import type { Item } from "@/features/rules/types";
import type { MenuEntry } from "@/ui";
import { catalogItem, dropWorn, isConsumable, removeFromBag, slotLabel, slotsFor, takeFromBag, unequip, wear, type GearSlot } from "../model";

type Say = (m: string) => void;

/** Dev mode: ask for an item name; blank clears. undefined when cancelled. */
export function askItem(what: string, current?: Item): Item | null | undefined {
  const name = window.prompt(`${what} — item name (leave blank to clear)`, current?.name ?? "");
  if (name === null) return undefined;
  return name.trim() ? { ...current, name: name.trim() } : null;
}

const wearAction = (sh: SheetState, i: number, slot: string, name: string, say: Say) => () =>
  sh.setSheet(x => { const r = wear(x, i, slot); if (r) say(`Wearing ${name}`); return r ? { ...x, ...r } : x; });

/** Bag cell: Wear (per slot that fits), Use (consumables), Drop. */
export function bagEntries(sh: SheetState, i: number, say: Say): MenuEntry[] {
  const { sheet: s, setSheet } = sh;
  const it = s.bag[i];
  if (!it) return [];
  const c = catalogItem(it.ref);
  const qty = it.qty ?? 1;
  const out: MenuEntry[] = [];
  const fits = slotsFor(it);
  for (const slot of fits) {
    const busy = s.equipped[slot];
    out.push({ label: fits.length > 1 ? `Wear — ${slotLabel(slot)}` : "Wear", icon: "wear", note: busy ? `swap ${busy.name}` : slotLabel(slot), onClick: wearAction(sh, i, slot, it.name, say) });
  }
  if (isConsumable(c)) out.push({
    label: "Use", icon: "use",
    onClick: () => { setSheet(x => ({ ...x, bag: takeFromBag(x.bag, i, 1) })); say(`Used ${it.name}${c?.description ? `: ${c.description}` : ""}`); },
  });
  out.push({
    label: qty > 1 ? `Drop all ${qty}` : "Drop", icon: "drop", danger: true,
    onClick: () => { if (window.confirm(`Drop ${qty > 1 ? `${qty} × ` : ""}${it.name}? It is gone for good.`)) { setSheet(x => ({ ...x, bag: removeFromBag(x.bag, i) })); say(`Dropped ${it.name}`); } },
  });
  return out;
}

/** Gear slot: Take off / Drop when full; when empty, everything in the bag that fits it. */
export function slotEntries(sh: SheetState, slot: GearSlot, say: Say): MenuEntry[] {
  const { sheet: s, setSheet } = sh;
  const it = s.equipped[slot.id];
  if (it) return [
    { label: "Take off", icon: "unequip", note: "to the bag",
      onClick: () => setSheet(x => { const r = unequip(x, slot.id); if (r) say(`Took off ${it.name}`); return r ? { ...x, ...r } : x; }) },
    { label: "Drop", icon: "drop", danger: true,
      onClick: () => { if (window.confirm(`Drop ${it.name}? It is gone for good.`)) { setSheet(x => ({ ...x, equipped: dropWorn(x.equipped, slot.id) })); say(`Dropped ${it.name}`); } } },
  ];
  const entries: MenuEntry[] = [];
  s.bag.forEach((b, i) => { if (slotsFor(b).includes(slot.id)) entries.push({ label: `Wear ${b.name}`, icon: "wear", onClick: wearAction(sh, i, slot.id, b.name, say) }); });
  return entries.length ? entries : [{ label: "Nothing in the bag fits here", icon: "none", disabled: true }];
}
