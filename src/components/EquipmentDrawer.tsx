/**
 * Equipment drawer — opens in the left column (where Dev mode's sidebar sits) from the
 * Equipment card's Add and Purchase buttons. One catalog list, two modes:
 *
 *   add  — tick items, then "Add to bag". Free; for the DM or for starting gear.
 *   buy  — each item shows its default price with − / + (one unit of its coin, e.g. ±1 gp).
 *          Adjusted prices and the cart live only while the drawer is open; closing forgets them.
 *          Pay takes the total from the purse (with change) and puts the items in the bag.
 *
 * Catalog: src/data/equipment.json (from the equipment workbook, tools/equipment_xlsx_to_json.py).
 */
import { useMemo, useState } from "react";
import type { SheetState } from "@/hooks/useSheet";
import { addToBag, CATALOG, CATEGORIES, categoryLabel, type CatalogItem, coinValue, formatMoney, itemIcon, pay, toCopper, walletCopper } from "@/model/equipment";
import { GEAR_SLOTS } from "./Inventory";
import { Hint, Icon } from "./ui";

export type ShopMode = "add" | "buy";
interface CartLine { id: string; price: number; qty: number }  // price in copper, as agreed when added

const slotLabel = (id?: string) => GEAR_SLOTS.find(s => s.id === id)?.label;

function itemLines(it: CatalogItem, priceCp?: number): (string | [string, string | number])[] {
  return [
    [categoryLabel(it.category), it.name],
    ...(slotLabel(it.slot) ? [["Slot", slotLabel(it.slot)!] as [string, string]] : []),
    ...(priceCp !== undefined ? [["Default price", formatMoney(toCopper(it.price))] as [string, string]] : []),
    ...(it.damage ? [["Damage", `${it.damage}${it.damage_type ? ` ${it.damage_type}` : ""}`] as [string, string]] : []),
    ...(it.armour !== undefined ? [["Armour", it.armour] as [string, number]] : []),
    ...(it.attack_power !== undefined ? [["Attack Power", it.attack_power] as [string, number]] : []),
    ...(it.reach_m !== undefined ? [["Reach", `${it.reach_m} m`] as [string, string]] : []),
    ...(it.properties?.length ? [it.properties.join(", ")] : []),
    ...(it.bonuses?.length ? [it.bonuses.join(", ")] : []),
    ...(it.stackable ? ["Stacks in one bag cell"] : []),
    ...(it.description ? [it.description] : []),
  ];
}

export function EquipmentDrawer({ mode, sh, onClose, onMessage, style }: {
  mode: ShopMode; sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties;
}) {
  const { sheet: s, update } = sh;
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, number>>({});   // copper, buy mode only
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG.filter(it => (!category || it.category === category) && (!q || it.name.toLowerCase().includes(q)));
  }, [category, search]);

  const priceOf = (it: CatalogItem) => prices[it.id] ?? toCopper(it.price);
  const step = (it: CatalogItem) => coinValue(it.price.coin);
  const nudge = (it: CatalogItem, dir: 1 | -1) => setPrices(p => ({ ...p, [it.id]: Math.max(0, priceOf(it) + dir * step(it)) }));

  const cartCount = cart.reduce((t, l) => t + l.qty, 0);
  const total = cart.reduce((t, l) => t + l.price * l.qty, 0);
  const purse = walletCopper(s.wealth);

  const addToCart = (it: CatalogItem) => setCart(c => {
    const p = priceOf(it), i = c.findIndex(l => l.id === it.id && l.price === p);
    return i >= 0 ? c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)) : [...c, { id: it.id, price: p, qty: 1 }];
  });
  const changeLine = (i: number, d: number) => setCart(c => c.map((l, j) => (j === i ? { ...l, qty: l.qty + d } : l)).filter(l => l.qty > 0));

  const addPicked = () => {
    let bag = s.bag;
    for (const id of picked) { const it = CATALOG.find(x => x.id === id); if (it) bag = addToBag(bag, it, 1); }
    update("bag", bag);
    onMessage(`Added ${picked.size} item${picked.size === 1 ? "" : "s"} to the bag`);
    setPicked(new Set());
  };
  const reset = () => { setCart([]); setPrices({}); setShowCart(false); };
  const checkout = () => {
    const purseAfter = pay(s.wealth, total);
    if (!purseAfter) return;
    let bag = s.bag;
    for (const l of cart) { const it = CATALOG.find(x => x.id === l.id); if (it) bag = addToBag(bag, it, l.qty); }
    update("bag", bag);
    update("wealth", purseAfter);
    onMessage(`Paid ${formatMoney(total)} for ${cartCount} item${cartCount === 1 ? "" : "s"}`);
    reset();
  };

  return (
    <aside className="shop" style={style} aria-label={mode === "add" ? "Add equipment" : "Purchase equipment"}>
      <div className="shop__head">
        <h2>{mode === "add" ? "Add equipment" : "Purchase"}</h2>
        <select className="in shop__cat" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" className="btn btn--ghost btn--small shop__close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {!showCart && <input className="in shop__search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search equipment" />}

      {showCart ? (
        <ul className="shop__list shop__list--cart">
          {cart.length === 0 && <li className="empty">The cart is empty.</li>}
          {cart.map((l, i) => {
            const it = CATALOG.find(x => x.id === l.id)!;
            return (
              <li key={`${l.id}-${l.price}`} className="shop__row">
                <Icon name={itemIcon(it)} size={20} />
                <span className="shop__name"><b>{it.name}</b><small>{formatMoney(l.price)} each</small></span>
                <span className="shop__qty">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => changeLine(i, -1)} aria-label="One less"><Icon name="minus" size={14} /></button>
                  <b>{l.qty}</b>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => changeLine(i, 1)} aria-label="One more"><Icon name="plus" size={14} /></button>
                </span>
                <span className="shop__price">{formatMoney(l.price * l.qty)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="shop__list">
          {list.length === 0 && <li className="empty">Nothing in this category.</li>}
          {list.map(it => {
            const p = priceOf(it), changed = p !== toCopper(it.price);
            const on = picked.has(it.id);
            const meta = [categoryLabel(it.category), slotLabel(it.slot), it.damage && `${it.damage}${it.damage_type ? ` ${it.damage_type}` : ""}`].filter(Boolean).join(" · ");
            const name = (
              <Hint lines={itemLines(it, mode === "buy" ? p : undefined)} className="shop__name">
                <b>{it.name}</b><small>{meta}</small>
              </Hint>
            );
            return mode === "add" ? (
              <li key={it.id} className={`shop__row shop__row--pick${on ? " on" : ""}`}
                onClick={() => setPicked(x => { const n = new Set(x); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })}>
                <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-label={`Select ${it.name}`} />
                <Icon name={itemIcon(it)} size={20} />
                {name}
              </li>
            ) : (
              <li key={it.id} className="shop__row">
                <Icon name={itemIcon(it)} size={20} />
                {name}
                <span className={`shop__adjust${changed ? " changed" : ""}`}>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => nudge(it, -1)} disabled={p === 0} aria-label={`Lower price by 1 ${it.price.coin}`}><Icon name="minus" size={14} /></button>
                  <Hint lines={[["Default", formatMoney(toCopper(it.price))], `Step: 1 ${it.price.coin}`, "Not saved when the drawer closes"]}><span className="shop__price">{formatMoney(p)}</span></Hint>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => nudge(it, 1)} aria-label={`Raise price by 1 ${it.price.coin}`}><Icon name="plus" size={14} /></button>
                </span>
                <button type="button" className="btn btn--small" onClick={() => addToCart(it)} title="Add to cart"><Icon name="cart" size={15} /></button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="shop__foot">
        {mode === "add" ? (
          <>
            <span>{picked.size} selected</span>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setPicked(new Set())} disabled={!picked.size}>Clear</button>
            <button type="button" className="btn btn--class" onClick={addPicked} disabled={!picked.size}>Add to bag</button>
          </>
        ) : (
          <>
            <div className="shop__totals">
              <span>Total <b>{formatMoney(total)}</b></span>
              <span className={total > purse ? "bad" : ""}>Purse <b>{formatMoney(purse)}</b></span>
              {total > purse && <span className="bad">Short by {formatMoney(total - purse)}</span>}
            </div>
            <div className="shop__actions">
              <button type="button" className={`btn btn--small${showCart ? " btn--on" : ""}`} onClick={() => setShowCart(v => !v)}>
                <Icon name="cart" size={15} /> {showCart ? "Back to list" : `See cart (${cartCount})`}
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={reset} disabled={!cart.length && !Object.keys(prices).length}>Reset</button>
              <button type="button" className="btn btn--class" onClick={checkout} disabled={!cart.length || total > purse}>Pay</button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
