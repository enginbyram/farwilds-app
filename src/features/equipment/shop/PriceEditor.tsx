/**
 * A price as one box per coin (gp / sp / cp). Typing in any box changes the price; the boxes are then shown
 * in the fewest coins (15 sp → 1 gp 5 sp). Red when below the default, yellow when above.
 */
import { Hint } from "@/ui";
import { formatMoney, inCoins } from "../model";

export function PriceEditor({ value, base, onChange, disabled, label }: { value: number; base: number; onChange: (cp: number) => void; disabled?: boolean; label: string }) {
  const parts = inCoins(value);
  const set = (id: string, n: number) => onChange(parts.reduce((t, x) => t + (x.coin.id === id ? Math.max(0, Math.floor(n) || 0) : x.n) * x.coin.value, 0));
  const trend = value < base ? " down" : value > base ? " up" : "";
  return (
    <Hint className={`price${trend}`} lines={[["Default", formatMoney(base)], ["Now", formatMoney(value)], "Type in any coin. Not saved when the drawer closes."]}>
      <span className="price__boxes" role="group" aria-label={label}>
        {parts.map(({ coin: c, n }) => (
          <label key={c.id} className={`price__coin coin--${c.id}`}>
            <input type="number" min={0} className="in in--num price__in" value={n} disabled={disabled} aria-label={c.label}
              onChange={e => set(c.id, Number(e.target.value))} onFocus={e => e.target.select()} />
            <small>{c.short}</small>
          </label>
        ))}
        {value !== base && !disabled && <button type="button" className="price__reset" onClick={() => onChange(base)} aria-label="Back to the default price" title="Back to the default price">↺</button>}
      </span>
    </Hint>
  );
}
