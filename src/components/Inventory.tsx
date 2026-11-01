/**
 * Character page panels for what a character wears and owns:
 *   GearPanel  — RPG paper doll: slots left and right of a figure, weapon slots underneath.
 *   EquipmentPanel — purse (gold, silver, copper), valuables and load gauge in one compact strip,
 *                    then the bag grid, with Add / Purchase (EquipmentDrawer.tsx).
 *   Encumbrance: capacity = Strength score × CarryPerSTR (rules param, 8 kg); load = catalog weight
 *   of everything worn and carried.
 *
 * Slots, coins and bag size come from src/data/gear.json. Items live on the sheet, so they are
 * saved with the character file.
 *
 * Click an item (bag or slot) for its menu (ItemMenu.tsx): Wear, Take off, Use, Drop. Selling goes through the Sell drawer.
 * Click an empty slot to wear something from the bag that fits it. Worn gear counts in the
 * calculation through rules/bonuses.ts. Dev mode adds "Edit by hand" to every menu.
 */
import gear from "@/data/gear.json";
import type { SheetState } from "@/hooks/useSheet";
import type { Computed } from "@/rules/compute";
import type { Item, Rules } from "@/rules/types";
import { useState } from "react";
import { carriedWeight, catalogItem, categoryLabel, itemIcon, itemWeight, slotsFor, unequip, wear } from "@/model/equipment";
import type { ShopMode } from "./EquipmentDrawer";
import { ItemMenu, menuAt, type MenuEntry, type MenuState } from "./ItemMenu";
import { Hint, Icon, RadialGauge, signed } from "./ui";

export interface GearSlot { id: string; label: string; side: "left" | "right" | "melee" | "ranged"; icon: string }
export const GEAR_SLOTS = gear.slots as GearSlot[];
export const COINS = gear.coins;

const itemLines = (title: string, it?: Item): (string | [string, string | number])[] =>
  it ? [[title, it.name], ...(it.qty && it.qty > 1 ? [["Quantity", it.qty] as [string, number]] : []), ...(it.note ? [it.note] : [])]
     : [[title, "Empty"]];

/** Dev-mode helper: ask for an item name; blank clears. Returns undefined when cancelled. */
function askItem(what: string, current?: Item): Item | null | undefined {
  const name = window.prompt(`${what} — item name (leave blank to clear)`, current?.name ?? "");
  if (name === null) return undefined;
  return name.trim() ? { ...current, name: name.trim() } : null;
}

const slotName = (id: string) => GEAR_SLOTS.find(x => x.id === id)?.label ?? id;

/** Menu entries for one bag item: Wear (per slot that fits), Use, Drop. */
export function bagEntries(sh: SheetState, i: number, say: (m: string) => void): MenuEntry[] {
  const { sheet: s, setSheet } = sh;
  const it = s.bag[i];
  if (!it) return [];
  const c = catalogItem(it.ref);
  const qty = it.qty ?? 1;
  const out: MenuEntry[] = [];
  const fits = slotsFor(it);
  for (const slot of fits) {
    const busy = s.equipped[slot];
    out.push({
      label: fits.length > 1 ? `Wear — ${slotName(slot)}` : "Wear", icon: "wear", note: busy ? `swap ${busy.name}` : slotName(slot),
      onClick: () => setSheet(x => { const r = wear(x, i, slot); if (r) say(`Wearing ${it.name}`); return r ? { ...x, ...r } : x; }),
    });
  }
  if (c?.category === "consumable") out.push({
    label: "Use", icon: "use",
    onClick: () => { setSheet(x => ({ ...x, bag: qty > 1 ? x.bag.map((b, j) => (j === i ? { ...b, qty: qty - 1 } : b)) : x.bag.filter((_, j) => j !== i) })); say(`Used ${it.name}${c.description ? `: ${c.description}` : ""}`); },
  });
  out.push({
    label: qty > 1 ? `Drop all ${qty}` : "Drop", icon: "drop", danger: true,
    onClick: () => { if (window.confirm(`Drop ${qty > 1 ? `${qty} × ` : ""}${it.name}? It is gone for good.`)) { setSheet(x => ({ ...x, bag: x.bag.filter((_, j) => j !== i) })); say(`Dropped ${it.name}`); } },
  });
  return out;
}

function Slot({ slot, item, onOpen }: { slot: GearSlot; item?: Item; onOpen: (e: React.MouseEvent<HTMLElement>) => void }) {
  const body = (
    <span className={`slot${item ? " slot--full" : ""}`}>
      <Icon name={slot.icon} size={22} />
      {item && <span className="slot__name">{item.name}</span>}
    </span>
  );
  return (
    <Hint lines={itemLines(slot.label, item)}>
      <button type="button" className="slot__btn" onClick={onOpen} aria-haspopup="menu" aria-label={`${slot.label} slot${item ? `: ${item.name}` : ""}`}>{body}</button>
    </Hint>
  );
}

/** Placeholder figure until there is character art. */
function Figure() {
  return (
    <svg className="paperdoll__figure" viewBox="0 0 100 220" aria-hidden="true">
      <circle cx="50" cy="22" r="13" />
      <path d="M43 36h14l1 6 15 5c4 1 6 4 6 8l3 38-3 34h-6l-1-32-4-20-2 26 4 46-3 64h-11l-3-58-3 58H35l-3-64 4-46-2-26-4 20-1 32h-6l-3-34 3-38c0-4 2-7 6-8l15-5z" />
    </svg>
  );
}

export function GearPanel({ sh, c, devMode, onMessage = () => {} }: { sh: SheetState; c: Computed; devMode: boolean; onMessage?: (m: string) => void }) {
  const { sheet: s, update, setSheet } = sh;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const edit = (slot: GearSlot) => {
    const next = askItem(slot.label, s.equipped[slot.id]);
    if (next === undefined) return;
    const equipped = { ...s.equipped };
    if (next) equipped[slot.id] = { ...next, kind: slot.id }; else delete equipped[slot.id];
    update("equipped", equipped);
  };
  const open = (e: React.MouseEvent<HTMLElement>, slot: GearSlot) => {
    const it = s.equipped[slot.id];
    const entries: MenuEntry[] = [];
    if (it) {
      entries.push({ label: "Take off", icon: "unequip", note: "to the bag",
        onClick: () => setSheet(x => { const r = unequip(x, slot.id); if (r) onMessage(`Took off ${it.name}`); return r ? { ...x, ...r } : x; }) });
      entries.push({ label: "Drop", icon: "drop", danger: true,
        onClick: () => { if (window.confirm(`Drop ${it.name}? It is gone for good.`)) { setSheet(x => { const eq = { ...x.equipped }; for (const [k, v] of Object.entries(eq)) if (v === x.equipped[slot.id]) delete eq[k]; return { ...x, equipped: eq }; }); onMessage(`Dropped ${it.name}`); } } });
    } else {
      // Empty slot: everything in the bag that fits it.
      s.bag.forEach((b, i) => {
        if (!slotsFor(b).includes(slot.id)) return;
        entries.push({ label: `Wear ${b.name}`, icon: "wear", onClick: () => setSheet(x => { const r = wear(x, i, slot.id); if (r) onMessage(`Wearing ${b.name}`); return r ? { ...x, ...r } : x; }) });
      });
      if (!entries.length) entries.push({ label: "Nothing in the bag fits here", icon: "none", disabled: true });
    }
    if (devMode) entries.push({ label: "Edit by hand (dev)", icon: "edit", onClick: () => edit(slot) });
    setMenu(menuAt(e, it ? it.name : slot.label, entries));
  };
  const side = (k: GearSlot["side"]) => GEAR_SLOTS.filter(x => x.side === k)
    .map(x => <Slot key={x.id} slot={x} item={s.equipped[x.id]} onOpen={e => open(e, x)} />);
  const worn = Object.keys(s.equipped).length;

  return (
    <section className="card gearcard" aria-label="Gear">
      <h2>Gear <span className="h3hint">{worn} of {GEAR_SLOTS.length} slots</span></h2>
      <div className="paperdoll">
        <div className="paperdoll__col">{side("left")}</div>
        <Figure />
        <div className="paperdoll__col">{side("right")}</div>
      </div>
      <div className="paperdoll__weapons">
        <div className="paperdoll__wgroup">
          <small>Melee</small>
          <div className="paperdoll__wslots">{side("melee")}</div>
          <Hint lines={[["Attack Power, melee", signed(c.combat.apMelee)], "Added to the d20 for physical attacks"]}><b>{signed(c.combat.apMelee)}</b></Hint>
        </div>
        <div className="paperdoll__wgroup">
          <small>Ranged</small>
          <div className="paperdoll__wslots">{side("ranged")}</div>
          <Hint lines={[["Attack Power, ranged", signed(c.combat.apRanged)], "Added to the d20 for physical attacks"]}><b>{signed(c.combat.apRanged)}</b></Hint>
        </div>
      </div>
      <ItemMenu menu={menu} onClose={() => setMenu(null)} />
    </section>
  );
}

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

/** Equipment card: purse and valuables in a compact strip, the load gauge, then the bag grid. */
export function EquipmentPanel({ sh, c, rules, devMode, onShop, onMessage = () => {} }: {
  sh: SheetState; c: Computed; rules: Rules; devMode: boolean; onShop: (m: ShopMode) => void; onMessage?: (m: string) => void;
}) {
  const { sheet: s, update } = sh;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const cols = gear.bagColumns;
  const cells = Math.max(gear.bagMinCells, Math.ceil((s.bag.length + (devMode ? 1 : 0)) / cols) * cols);

  // Encumbrance: capacity = STR score × CarryPerSTR; load = everything worn and carried.
  const str = c.attributes.find(a => a.key === "STR")?.score ?? 0;
  const perStr = rules.params.find(p => p.key === "CarryPerSTR")?.value ?? 8;
  const capacity = str * perStr;
  const load = carriedWeight(s);
  const over = load > capacity;

  const setCoin = (id: string, v: number) => update("wealth", { ...s.wealth, [id]: Math.max(0, Math.floor(v) || 0) });
  const addValuable = () => {
    const it = askItem("Valuable");
    if (!it) return;
    const kind = window.prompt(`Kind (${gear.valuableKinds.join(", ")})`, "gem")?.trim().toLowerCase() || "other";
    const qty = Math.max(1, Number(window.prompt("Quantity", "1")) || 1);
    update("valuables", [...s.valuables, { ...it, kind, qty }]);
  };
  const edit = (i: number) => {
    const next = askItem(`Bag cell ${i + 1}`, s.bag[i]);
    if (next === undefined) return;
    const bag = [...s.bag];
    if (next) bag[i < bag.length ? i : bag.length] = next; else bag.splice(i, 1);
    update("bag", bag);
  };
  const bagLines = (it: Item) => {
    const w = itemWeight(it);
    return [...itemLines(categoryLabel(it.kind) || "Item", it), ...(w ? [["Weight", kg(w)] as [string, string]] : [])];
  };

  return (
    <section className="card" aria-label="Equipment">
      <div className="card__head">
        <h2>Equipment <span className="h3hint">{s.bag.length} carried</span></h2>
        <div className="card__tools">
          <button type="button" className="btn btn--small" onClick={() => onShop("add")}><Icon name="plus" size={14} /> Add</button>
          <button type="button" className="btn btn--small" onClick={() => onShop("buy")}><Icon name="cart" size={14} /> Purchase</button>
          <button type="button" className="btn btn--small" onClick={() => onShop("sell")} disabled={!s.bag.length}><Icon name="sell" size={14} /> Sell</button>
        </div>
      </div>

      <div className="purse">
        <div className="purse__money">
          <div className="purse__coins" aria-label="Wealth">
            {COINS.map(k => (
              <Hint key={k.id} lines={[[k.label, `${s.wealth[k.id] ?? 0} ${k.short}`], `1 ${k.short} = ${k.value} cp`]}>
                <span className={`coin coin--${k.id}`}>
                  <Icon name="coin" size={16} />
                  {devMode
                    ? <input type="number" min={0} className="in in--num coin__in" value={s.wealth[k.id] ?? 0} aria-label={k.label} onChange={e => setCoin(k.id, Number(e.target.value))} />
                    : <b>{s.wealth[k.id] ?? 0}</b>}
                  <small>{k.short}</small>
                </span>
              </Hint>
            ))}
          </div>
          <div className="purse__valuables" aria-label="Valuables">
            {s.valuables.map((v, i) => (
              <Hint key={i} lines={itemLines(v.kind ? v.kind[0].toUpperCase() + v.kind.slice(1) : "Valuable", v)}>
                <span className="vchip">
                  <Icon name={gear.valuableKinds.includes(v.kind ?? "") ? v.kind! : "other"} size={13} />
                  {v.name}{v.qty && v.qty > 1 ? <b>×{v.qty}</b> : null}
                  {devMode && <button type="button" className="vchip__x" aria-label={`Remove ${v.name}`}
                    onClick={() => update("valuables", s.valuables.filter((_, j) => j !== i))}>×</button>}
                </span>
              </Hint>
            ))}
            {!s.valuables.length && !devMode && <span className="empty">No valuables</span>}
            {devMode && <button type="button" className="vchip vchip--add" onClick={addValuable}>+ Valuable</button>}
          </div>
        </div>
        <Hint lines={[["Carried", kg(load)], ["Capacity", kg(capacity)], `Strength ${str} × ${perStr} kg`, ...(over ? [`Over by ${kg(load - capacity)}`] : [])]}>
          <RadialGauge now={Math.round(load)} max={Math.max(1, capacity)} kind={over ? "load-over" : "load"} size={50} label="kg" showMax
            title={`Load ${kg(load)} of ${kg(capacity)}`} />
        </Hint>
      </div>

      <div className="bag" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }, (_, i) => {
          const it = s.bag[i];
          const cell = (
            <span className={`bag__cell${it ? " bag__cell--full" : ""}`}>
              {it && <>{it.kind || it.ref ? <Icon name={itemIcon(it)} size={18} /> : <span className="bag__abbr">{it.name.slice(0, 2)}</span>}
                {it.qty && it.qty > 1 ? <b className="bag__qty">{it.qty}</b> : null}</>}
            </span>
          );
          const openMenu = (e: React.MouseEvent<HTMLElement>) => setMenu(menuAt(e, it!.name, [
            ...bagEntries(sh, i, onMessage),
            ...(devMode ? [{ label: "Edit by hand (dev)", icon: "edit", onClick: () => edit(i) }] : []),
          ]));
          const content = it
            ? <button type="button" className="slot__btn" onClick={openMenu} aria-haspopup="menu" aria-label={it.name}>{cell}</button>
            : devMode && i === s.bag.length
              ? <button type="button" className="slot__btn" onClick={() => edit(i)} aria-label="Add an item by hand">{cell}</button>
              : cell;
          return it ? <Hint key={i} lines={bagLines(it)}>{content}</Hint> : <span key={i} className="bag__wrap">{content}</span>;
        })}
      </div>
      <p className="note">Click an item for Wear, Use or Drop.{devMode ? " Dev mode: the first empty cell adds an item by hand; coins edit in place." : ""}</p>
      <ItemMenu menu={menu} onClose={() => setMenu(null)} />
    </section>
  );
}
