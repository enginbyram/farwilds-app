/**
 * Character page panels for what a character wears and owns:
 *   GearPanel  — RPG paper doll: slots left and right of a figure, weapon slots underneath.
 *   EquipmentPanel — purse (gold, silver, copper), valuables and load gauge in one compact strip,
 *                    then the bag grid, with Add / Purchase (EquipmentDrawer.tsx).
 *   Encumbrance: capacity = Strength score × CarryPerSTR (rules param, 8 kg); load = catalog weight
 *   of everything worn and carried.
 *
 * Slots, coins and bag size come from src/data/gear.json. Items live on the sheet, so they are
 * saved with the character file. Display only for now; in Dev mode slots, coins and lists can be
 * filled by hand to test the layout until the equipment chapter brings real items.
 */
import gear from "@/data/gear.json";
import type { SheetState } from "@/hooks/useSheet";
import type { Computed } from "@/rules/compute";
import type { Item, Rules } from "@/rules/types";
import { carriedWeight, categoryLabel, itemIcon, itemWeight } from "@/model/equipment";
import type { ShopMode } from "./EquipmentDrawer";
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

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;

/** Equipment card: purse and valuables in a compact strip, the load gauge, then the bag grid. */
export function EquipmentPanel({ sh, c, rules, devMode, onShop }: {
  sh: SheetState; c: Computed; rules: Rules; devMode: boolean; onShop: (m: ShopMode) => void;
}) {
  const { sheet: s, update } = sh;
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
          const content = devMode && i <= s.bag.length
            ? <button type="button" className="slot__btn" onClick={() => edit(i)} aria-label={it ? it.name : "Empty bag cell"}>{cell}</button>
            : cell;
          return it ? <Hint key={i} lines={bagLines(it)}>{content}</Hint> : <span key={i} className="bag__wrap">{content}</span>;
        })}
      </div>
      {devMode && <p className="note">Dev mode: click a cell to add or rename an item; blank removes it. Edit coins in place.</p>}
    </section>
  );
}
