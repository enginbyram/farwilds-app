/**
 * Sell: the bag, each item at its selling price (catalog price × sellRate in gear.json) with a price to haggle
 * and a count to sell. Counts and haggled prices live only while the drawer is open.
 */
import { useState } from "react";
import { s as plural } from "@/core/format";
import type { SheetState } from "@/features/character/state/useSheet";
import { Hint, Icon, Stepper } from "@/ui";
import { catalogItem, categoryLabel, formatMoney, itemIcon, receive, SELL_RATE, sellPrice, takeCounts, walletCopper } from "../model";
import { catalogLines } from "../components/itemHints";
import { PriceEditor } from "./PriceEditor";
import { ShopShell } from "./ShopShell";

export function SellDrawer({ sh, onClose, onMessage, style }: { sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties }) {
  const { sheet: s, setSheet } = sh;
  const [count, setCount] = useState<Record<number, number>>({});   // bag index → how many to sell
  const [prices, setPrices] = useState<Record<number, number>>({});  // bag index → haggled price each, copper

  const rows = s.bag.map((it, i) => ({ it, i, c: catalogItem(it.ref), base: sellPrice(it), qty: it.qty ?? 1 }));
  const priceOf = (i: number) => prices[i] ?? rows[i].base;
  const setN = (i: number, n: number) => setCount(x => ({ ...x, [i]: Math.max(0, Math.min(rows[i].qty, n)) }));
  const total = rows.reduce((t, r) => t + (count[r.i] ?? 0) * priceOf(r.i), 0);
  const pieces = Object.values(count).reduce((t, n) => t + n, 0);
  const reset = () => { setCount({}); setPrices({}); };

  const sell = () => {
    setSheet(x => ({ ...x, bag: takeCounts(x.bag, count), wealth: receive(x.wealth, total) }));
    onMessage(`Sold ${pieces} item${plural(pieces)} for ${formatMoney(total)}`);
    reset();
  };

  return (
    <ShopShell title="Sell" label="Sell equipment" onClose={onClose} style={style}
      beside={<span className="shop__cat note">Merchants pay {Math.round(SELL_RATE * 100)}% of the list price</span>}>
      <ul className="shop__list">
        {rows.length === 0 && <li className="empty">The bag is empty. Worn gear must be taken off before it can be sold.</li>}
        {rows.map(({ it, i, c, base, qty }) => {
          const p = priceOf(i), n = count[i] ?? 0;
          return (
            <li key={i} className={`shop__row${n ? " on" : ""}`}>
              <Icon name={itemIcon(it)} size={20} />
              <Hint lines={c ? catalogLines(c, p) : [[categoryLabel(it.kind) || "Item", it.name], "Not from the catalog: no price"]} className="shop__name">
                <b>{it.name}</b><small>{qty > 1 ? `${qty} in the bag · ` : ""}{base ? `${formatMoney(base)} each` : "no price"}</small>
              </Hint>
              <PriceEditor value={p} base={base} disabled={!base} label={`Price for ${it.name}`} onChange={v => setPrices(x => ({ ...x, [i]: v }))} />
              <Stepper variant="icon" value={n} onDec={() => setN(i, n - 1)} onInc={() => setN(i, n + 1)} canDec={!!n} canInc={!!base && n < qty}
                decLabel="Sell one less" incLabel="Sell one more" />
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
          <button type="button" className="btn btn--ghost btn--small" onClick={reset} disabled={!pieces && !Object.keys(prices).length}>Reset</button>
          <button type="button" className="btn btn--class" onClick={sell} disabled={!pieces}>Sell {pieces || ""}</button>
        </div>
      </div>
    </ShopShell>
  );
}
