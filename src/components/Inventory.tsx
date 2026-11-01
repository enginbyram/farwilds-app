/**
 * Character page panels for what a character wears and owns:
 *   GearPanel  — RPG paper doll: slots left and right of a figure, weapon slots underneath.
 *   WealthPanel — coins (gold, silver, copper) and valuables (gems, jewellery…).
 *   BagPanel   — carried items as a grid of bag cells.
 *
 * Slots, coins and bag size come from src/data/gear.json. Items live on the sheet, so they are
 * saved with the character file. Display only for now; in Dev mode slots, coins and lists can be
 * filled by hand to test the layout until the equipment chapter brings real items.
 */
import gear from "@/data/gear.json";
import type { SheetState } from "@/hooks/useSheet";
import type { Computed } from "@/rules/compute";
import type { Item } from "@/rules/types";
import { Hint, Icon, signed } from "./ui";

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

function Slot({ slot, item, dev, onEdit }: { slot: GearSlot; item?: Item; dev: boolean; onEdit: () => void }) {
  const body = (
    <span className={`slot${item ? " slot--full" : ""}`}>
      <Icon name={slot.icon} size={22} />
      {item && <span className="slot__name">{item.name}</span>}
    </span>
  );
  return (
    <Hint lines={itemLines(slot.label, item)}>
      {dev ? <button type="button" className="slot__btn" onClick={onEdit} aria-label={`${slot.label} slot`}>{body}</button> : body}
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

export function GearPanel({ sh, c, devMode }: { sh: SheetState; c: Computed; devMode: boolean }) {
  const { sheet: s, update } = sh;
  const edit = (slot: GearSlot) => {
    const next = askItem(slot.label, s.equipped[slot.id]);
    if (next === undefined) return;
    const equipped = { ...s.equipped };
    if (next) equipped[slot.id] = { ...next, kind: slot.id }; else delete equipped[slot.id];
    update("equipped", equipped);
  };
  const side = (k: GearSlot["side"]) => GEAR_SLOTS.filter(x => x.side === k)
    .map(x => <Slot key={x.id} slot={x} item={s.equipped[x.id]} dev={devMode} onEdit={() => edit(x)} />);
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
        <Hint lines={["Armour — reduces physical damage once an attack hits", ["From gear & passives", c.combat.armour]]}>
          <span className="paperdoll__ar"><Icon name="armour" size={46} /><b>{c.combat.armour}</b><small>AR</small></span>
        </Hint>
        <div className="paperdoll__wgroup">
          <small>Ranged</small>
          <div className="paperdoll__wslots">{side("ranged")}</div>
          <Hint lines={[["Attack Power, ranged", signed(c.combat.apRanged)], "Added to the d20 for physical attacks"]}><b>{signed(c.combat.apRanged)}</b></Hint>
        </div>
      </div>
      {devMode && <p className="note">Dev mode: click a slot to put an item in it.</p>}
    </section>
  );
}

export function WealthPanel({ sh, devMode }: { sh: SheetState; devMode: boolean }) {
  const { sheet: s, update } = sh;
  const setCoin = (id: string, v: number) => update("wealth", { ...s.wealth, [id]: Math.max(0, Math.floor(v) || 0) });
  const addValuable = () => {
    const it = askItem("Valuable");
    if (!it) return;
    const kind = window.prompt(`Kind (${gear.valuableKinds.join(", ")})`, "gem")?.trim().toLowerCase() || "other";
    const qty = Math.max(1, Number(window.prompt("Quantity", "1")) || 1);
    update("valuables", [...s.valuables, { ...it, kind, qty }]);
  };

  return (
    <section className="card" aria-label="Wealth">
      <h2>Wealth</h2>
      <div className="coins">
        {COINS.map(k => (
          <Hint key={k.id} lines={[[k.label, `${s.wealth[k.id] ?? 0} ${k.short}`], "Exchange rates not set yet"]}>
            <span className={`coin coin--${k.id}`}>
              <Icon name="coin" size={26} />
              {devMode
                ? <input type="number" min={0} className="in in--num coin__in" value={s.wealth[k.id] ?? 0} aria-label={k.label} onChange={e => setCoin(k.id, Number(e.target.value))} />
                : <b>{s.wealth[k.id] ?? 0}</b>}
              <small>{k.label}</small>
            </span>
          </Hint>
        ))}
      </div>
      <h3>Valuables</h3>
      {s.valuables.length ? (
        <ul className="valuables">
          {s.valuables.map((v, i) => (
            <li key={i}>
              <Icon name={gear.valuableKinds.includes(v.kind ?? "") ? v.kind! : "other"} />
              <Hint lines={itemLines(v.kind ? v.kind[0].toUpperCase() + v.kind.slice(1) : "Valuable", v)}><span>{v.name}</span></Hint>
              <b>{v.qty && v.qty > 1 ? `×${v.qty}` : ""}</b>
              {devMode && <button type="button" className="btn btn--ghost btn--small" aria-label={`Remove ${v.name}`}
                onClick={() => update("valuables", s.valuables.filter((_, j) => j !== i))}>×</button>}
            </li>
          ))}
        </ul>
      ) : <p className="empty">No gems or other valuables.</p>}
      {devMode && <button type="button" className="btn btn--ghost btn--small" onClick={addValuable}>+ Valuable</button>}
    </section>
  );
}

export function BagPanel({ sh, devMode }: { sh: SheetState; devMode: boolean }) {
  const { sheet: s, update } = sh;
  const cols = gear.bagColumns;
  const cells = Math.max(gear.bagMinCells, Math.ceil((s.bag.length + (devMode ? 1 : 0)) / cols) * cols);
  const edit = (i: number) => {
    const next = askItem(`Bag cell ${i + 1}`, s.bag[i]);
    if (next === undefined) return;
    const bag = [...s.bag];
    if (next) bag[i < bag.length ? i : bag.length] = next; else bag.splice(i, 1);
    update("bag", bag);
  };

  return (
    <section className="card" aria-label="Equipment">
      <h2>Equipment <span className="h3hint">{s.bag.length} carried</span></h2>
      <div className="bag" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }, (_, i) => {
          const it = s.bag[i];
          const cell = (
            <span className={`bag__cell${it ? " bag__cell--full" : ""}`}>
              {it && <><span className="bag__name">{it.name}</span>{it.qty && it.qty > 1 ? <b className="bag__qty">{it.qty}</b> : null}</>}
            </span>
          );
          const content = devMode && i <= s.bag.length
            ? <button type="button" className="slot__btn" onClick={() => edit(i)} aria-label={it ? it.name : "Empty bag cell"}>{cell}</button>
            : cell;
          return it ? <Hint key={i} lines={itemLines("Item", it)}>{content}</Hint> : <span key={i} className="bag__wrap">{content}</span>;
        })}
      </div>
      {devMode && <p className="note">Dev mode: click a cell to add or rename an item; blank removes it.</p>}
    </section>
  );
}
