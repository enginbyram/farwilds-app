/**
 * Money: prices, purses and change. Coin values come from gear.json; every sum is worked in copper.
 *   formatMoney(1234) → "12 gp 3 sp 4 cp"
 *   pay(purse, cost) → the purse after paying (with change), or null
 */
import type { Item } from "@/features/rules/types";
import { catalogItem } from "./catalog";
import { COINS, SELL_RATE } from "./gear";

export const COINS_DESC = [...COINS].sort((a, b) => b.value - a.value);
const COIN_BY_SHORT = Object.fromEntries(COINS.map(c => [c.short, c]));

export type Purse = Record<string, number>;

export const coinValue = (short: string) => COIN_BY_SHORT[short]?.value ?? 1;
export const toCopper = (p: { amount: number; coin: string }) => p.amount * coinValue(p.coin);
export const walletCopper = (w: Purse) => COINS.reduce((t, c) => t + (w[c.id] ?? 0) * c.value, 0);

/** Splits copper into the fewest coins: 1234 → [{gold,12},{silver,3},{copper,4}] (zeros included). */
export function inCoins(cp: number) {
  let left = Math.max(0, Math.round(cp));
  return COINS_DESC.map(c => { const n = Math.floor(left / c.value); left -= n * c.value; return { coin: c, n }; });
}

/** 1234 → "12 gp 3 sp 4 cp" (0 → "0 cp"). */
export function formatMoney(cp: number): string {
  const parts = inCoins(cp).filter(x => x.n).map(x => `${x.n} ${x.coin.short}`);
  return parts.join(" ") || `0 ${COINS_DESC[COINS_DESC.length - 1].short}`;
}

/**
 * Pays `cost` copper out of a purse the way a person would: smallest coins first, then breaks the
 * smallest coin that covers the rest and takes the change back in smaller coins.
 * Returns the new purse, or null when there is not enough money.
 */
export function pay(purse: Purse, cost: number): Purse | null {
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
      const out: Purse = {};
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

/** Puts copper into a purse in the largest coins. */
export function receive(purse: Purse, cp: number): Purse {
  const w = { ...purse };
  let left = Math.max(0, Math.floor(cp));
  for (const c of COINS_DESC) { const n = Math.floor(left / c.value); w[c.id] = (w[c.id] ?? 0) + n; left -= n * c.value; }
  return w;
}

/** What a merchant pays: the catalog price × SELL_RATE, in copper, rounded down. */
export const sellPrice = (it: Item) => {
  const c = catalogItem(it.ref);
  return c ? Math.floor(toCopper(c.price) * SELL_RATE) : 0;
};
