/**
 * Add and Purchase: one catalog list, two modes.
 *   add  — tick items, then "Add to bag". Free; for the DM or for starting gear.
 *   buy  — each item shows its price (PriceEditor, haggle by typing); add to the cart; Pay takes the total from
 *          the purse (with change) and puts the items in the bag. The cart and haggled prices are forgotten on close.
 */
import { useMemo, useState } from "react";
import { s as plural } from "@/core/format";
import { toggled } from "@/core/objects";
import type { SheetState } from "@/features/character/state/useSheet";
import { Hint, Icon, Stepper } from "@/ui";
import { addToBag, CATALOG, CATEGORIES, formatMoney, itemIcon, pay, toCopper, walletCopper, type CatalogItem } from "../model";
import { catalogLines, catalogMeta } from "../components/itemHints";
import { PriceEditor } from "./PriceEditor";
import { ShopShell } from "./ShopShell";

interface CartLine { id: string; price: number; qty: number }  // price in copper, as agreed when added
const byId = (id: string) => CATALOG.find(x => x.id === id);

export function CatalogDrawer({ mode, sh, onClose, onMessage, style }: {
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
  const cartCount = cart.reduce((t, l) => t + l.qty, 0);
  const total = cart.reduce((t, l) => t + l.price * l.qty, 0);
  const purse = walletCopper(s.wealth);

  const addToCart = (it: CatalogItem) => setCart(c => {
    const p = priceOf(it), i = c.findIndex(l => l.id === it.id && l.price === p);
    return i >= 0 ? c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)) : [...c, { id: it.id, price: p, qty: 1 }];
  });
  const changeLine = (i: number, d: number) => setCart(c => c.map((l, j) => (j === i ? { ...l, qty: l.qty + d } : l)).filter(l => l.qty > 0));
  const putInBag = (lines: { id: string; qty: number }[]) => {
    let bag = s.bag;
    for (const l of lines) { const it = byId(l.id); if (it) bag = addToBag(bag, it, l.qty); }
    update("bag", bag);
  };

  const addPicked = () => {
    putInBag([...picked].map(id => ({ id, qty: 1 })));
    onMessage(`Added ${picked.size} item${plural(picked.size)} to the bag`);
    setPicked(new Set());
  };
  const reset = () => { setCart([]); setPrices({}); setShowCart(false); };
  const checkout = () => {
    const purseAfter = pay(s.wealth, total);
    if (!purseAfter) return;
    putInBag(cart);
    update("wealth", purseAfter);
    onMessage(`Paid ${formatMoney(total)} for ${cartCount} item${plural(cartCount)}`);
    reset();
  };

  const categorySelect = (
    <select className="in shop__cat" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
      <option value="">All categories</option>
      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
  );

  return (
    <ShopShell title={mode === "add" ? "Add equipment" : "Purchase"} label={mode === "add" ? "Add equipment" : "Purchase equipment"}
      beside={categorySelect} onClose={onClose} style={style}>
      {!showCart && <input className="in shop__search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search equipment" />}

      {showCart ? (
        <ul className="shop__list shop__list--cart">
          {cart.length === 0 && <li className="empty">The cart is empty.</li>}
          {cart.map((l, i) => {
            const it = byId(l.id)!;
            return (
              <li key={`${l.id}-${l.price}`} className="shop__row">
                <Icon name={itemIcon(it)} size={20} />
                <span className="shop__name"><b>{it.name}</b><small>{formatMoney(l.price)} each</small></span>
                <Stepper variant="icon" value={l.qty} onDec={() => changeLine(i, -1)} onInc={() => changeLine(i, 1)} decLabel="One less" incLabel="One more" />
                <span className="shop__price">{formatMoney(l.price * l.qty)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="shop__list">
          {list.length === 0 && <li className="empty">Nothing in this category.</li>}
          {list.map(it => {
            const p = priceOf(it), on = picked.has(it.id);
            const name = (
              <Hint lines={catalogLines(it, mode === "buy" ? p : undefined)} className="shop__name">
                <b>{it.name}</b><small>{catalogMeta(it)}</small>
              </Hint>
            );
            return mode === "add" ? (
              <li key={it.id} className={`shop__row shop__row--pick${on ? " on" : ""}`} onClick={() => setPicked(x => toggled(x, it.id))}>
                <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-label={`Select ${it.name}`} />
                <Icon name={itemIcon(it)} size={20} />
                {name}
              </li>
            ) : (
              <li key={it.id} className="shop__row">
                <Icon name={itemIcon(it)} size={20} />
                {name}
                <PriceEditor value={p} base={toCopper(it.price)} label={`Price for ${it.name}`} onChange={v => setPrices(x => ({ ...x, [it.id]: v }))} />
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
    </ShopShell>
  );
}
