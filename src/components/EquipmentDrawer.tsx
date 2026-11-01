/**
 * Equipment drawer — opens in the left column (where Dev mode's sidebar sits) from the
 * Equipment card's Add and Purchase buttons. One catalog list, two modes:
 *
 *   add  — tick items, then "Add to bag". Free; for the DM or for starting gear.
 *   buy  — each item shows its default price with − / + (one unit of its coin, e.g. ±1 gp);
 *          a lowered price shows red, a raised one yellow.
 *          Adjusted prices and the cart live only while the drawer is open; closing forgets them.
 *          Pay takes the total from the purse (with change) and puts the items in the bag.
 *   sell — the bag, each item at its selling price (catalog price × sellRate in gear.json) with − / +
 *          to haggle and a count to sell; Sell takes them out of the bag and puts the coins in the purse.
 *
 * Catalog: src/data/equipment.json (from the equipment workbook, tools/equipment_xlsx_to_json.py).
 */
import { useMemo, useState } from "react";
import gear from "@/data/gear.json";
import type { SheetState } from "@/hooks/useSheet";
import { addToBag, CATALOG, CATEGORIES, catalogItem, categoryLabel, type CatalogItem, coinValue, formatMoney, itemIcon, pay, receive, sellPrice, toCopper, walletCopper } from "@/model/equipment";
import { GEAR_SLOTS } from "./Inventory";
import { Hint, Icon } from "./ui";

export type ShopMode = "add" | "buy" | "sell";
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

export function EquipmentDrawer({ mode, sh, onClose, onMessage, style }: {
  mode: ShopMode; sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties;
}) {
  if (mode === "sell") return <SellDrawer sh={sh} onClose={onClose} onMessage={onMessage} style={style} />;
  return <ShopDrawer mode={mode} sh={sh} onClose={onClose} onMessage={onMessage} style={style} />;
}

/** Sell: the bag, priced at what a merchant pays. Counts and haggled prices live only while the drawer is open. */
function SellDrawer({ sh, onClose, onMessage, style }: { sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties }) {
  const { sheet: s, setSheet } = sh;
  const [count, setCount] = useState<Record<number, number>>({});   // bag index → how many to sell
  const [prices, setPrices] = useState<Record<number, number>>({});  // bag index → haggled price each, copper

  const rows = s.bag.map((it, i) => ({ it, i, c: catalogItem(it.ref), base: sellPrice(it), qty: it.qty ?? 1 }));
  const priceOf = (i: number) => prices[i] ?? rows[i].base;
  const step = (i: number) => Math.max(1, coinValue(rows[i].c?.price.coin ?? "cp"));
  const setN = (i: number, n: number) => setCount(x => ({ ...x, [i]: Math.max(0, Math.min(rows[i].qty, n)) }));
  const total = rows.reduce((t, r) => t + (count[r.i] ?? 0) * priceOf(r.i), 0);
  const pieces = Object.values(count).reduce((t, n) => t + n, 0);

  const sell = () => {
    setSheet(x => {
      const bag: typeof x.bag = [];
      x.bag.forEach((it, i) => {
        const n = count[i] ?? 0, q = it.qty ?? 1;
        if (n >= q) return;
        bag.push(n ? { ...it, qty: q - n } : it);
      });
      return { ...x, bag, wealth: receive(x.wealth, total) };
    });
    onMessage(`Sold ${pieces} item${pieces === 1 ? "" : "s"} for ${formatMoney(total)}`);
    setCount({}); setPrices({});
  };

  return (
    <aside className="shop" style={style} aria-label="Sell equipment">
      <div className="shop__head">
        <h2>Sell</h2>
        <span className="shop__cat note">Merchants pay {Math.round((gear.sellRate ?? 0.5) * 100)}% of the list price</span>
        <button type="button" className="btn btn--ghost btn--small shop__close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      <ul className="shop__list">
        {rows.length === 0 && <li className="empty">The bag is empty. Worn gear must be taken off before it can be sold.</li>}
        {rows.map(({ it, i, c, base, qty }) => {
          const p = priceOf(i), n = count[i] ?? 0;
          const trend = p < base ? " down" : p > base ? " up" : "";
          return (
            <li key={i} className={`shop__row${n ? " on" : ""}`}>
              <Icon name={itemIcon(it)} size={20} />
              <Hint lines={c ? itemLines(c, p) : [[categoryLabel(it.kind) || "Item", it.name], "Not from the catalog: no price"]} className="shop__name">
                <b>{it.name}</b><small>{qty > 1 ? `${qty} in the bag · ` : ""}{base ? `${formatMoney(base)} each` : "no price"}</small>
              </Hint>
              <span className={`shop__adjust${trend}`}>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setPrices(x => ({ ...x, [i]: Math.max(0, p - step(i)) }))} disabled={!base || p === 0} aria-label="Lower price"><Icon name="minus" size={14} /></button>
                <Hint lines={[["Merchant's offer", formatMoney(base)], "Not saved when the drawer closes"]}><span className="shop__price">{formatMoney(p)}</span></Hint>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setPrices(x => ({ ...x, [i]: p + step(i) }))} disabled={!base} aria-label="Raise price"><Icon name="plus" size={14} /></button>
              </span>
              <span className="shop__qty">
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setN(i, n - 1)} disabled={!n} aria-label="Sell one less"><Icon name="minus" size={14} /></button>
                <b>{n}</b>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setN(i, n + 1)} disabled={!base || n >= qty} aria-label="Sell one more"><Icon name="plus" size={14} /></button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="shop__foot">
        <div className="shop__totals">
          <span>You get <b>{formatMoney(total)}</b></span>
          <span>Purse <b>{formatMoney(walletCopper(s.wealth))}</b></span>
        </div>
        <div className="shop__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => { setCount({}); setPrices({}); }} disabled={!pieces && !Object.keys(prices).length}>Reset</button>
          <button type="button" className="btn btn--class" onClick={sell} disabled={!pieces}>Sell {pieces || ""}</button>
        </div>
      </div>
    </aside>
  );
}

function ShopDrawer({ mode, sh, onClose, onMessage, style }: {
  mode: "add" | "buy"; sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties;
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
            const p = priceOf(it), base = toCopper(it.price);
            const trend = p < base ? " down" : p > base ? " up" : "";
            const on = picked.has(it.id);
            const meta = [categoryLabel(it.category), slotLabel(it.slot), it.damage && `${it.damage}${it.damage_type ? ` ${it.damage_type}` : ""}`,
              it.range_m !== undefined && `${it.range_m}/${it.range_long_m ?? it.range_m} m`].filter(Boolean).join(" · ");
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
                <span className={`shop__adjust${trend}`}>
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
