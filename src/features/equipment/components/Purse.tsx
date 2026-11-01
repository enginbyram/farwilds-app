/** The strip at the top of the Equipment card: coins, valuables, and the load gauge. Dev mode edits coins and valuables. */
import { capitalise, kg } from "@/core/format";
import type { SheetState } from "@/features/character/state/useSheet";
import type { Computed } from "@/features/rules/compute";
import { param } from "@/features/rules/params";
import type { Rules } from "@/features/rules/types";
import { Hint, Icon, RadialGauge } from "@/ui";
import { carriedWeight, COINS, VALUABLE_KINDS } from "../model";
import { itemLines } from "./itemHints";
import { askItem } from "./itemMenus";

function Coins({ sh, devMode }: { sh: SheetState; devMode: boolean }) {
  const { sheet: s, update } = sh;
  const setCoin = (id: string, v: number) => update("wealth", { ...s.wealth, [id]: Math.max(0, Math.floor(v) || 0) });
  return (
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
  );
}

function Valuables({ sh, devMode }: { sh: SheetState; devMode: boolean }) {
  const { sheet: s, update } = sh;
  const add = () => {
    const it = askItem("Valuable");
    if (!it) return;
    const kind = window.prompt(`Kind (${VALUABLE_KINDS.join(", ")})`, "gem")?.trim().toLowerCase() || "other";
    const qty = Math.max(1, Number(window.prompt("Quantity", "1")) || 1);
    update("valuables", [...s.valuables, { ...it, kind, qty }]);
  };
  return (
    <div className="purse__valuables" aria-label="Valuables">
      {s.valuables.map((v, i) => (
        <Hint key={i} lines={itemLines(v.kind ? capitalise(v.kind) : "Valuable", v)}>
          <span className="vchip">
            <Icon name={VALUABLE_KINDS.includes(v.kind ?? "") ? v.kind! : "other"} size={13} />
            {v.name}{v.qty && v.qty > 1 ? <b>×{v.qty}</b> : null}
            {devMode && <button type="button" className="vchip__x" aria-label={`Remove ${v.name}`}
              onClick={() => update("valuables", s.valuables.filter((_, j) => j !== i))}>×</button>}
          </span>
        </Hint>
      ))}
      {!s.valuables.length && !devMode && <span className="empty">No valuables</span>}
      {devMode && <button type="button" className="vchip vchip--add" onClick={add}>+ Valuable</button>}
    </div>
  );
}

/** Encumbrance: capacity = Strength score × CarryPerSTR; load = everything worn and carried. */
function LoadGauge({ sh, c, rules }: { sh: SheetState; c: Computed; rules: Rules }) {
  const str = c.attributes.find(a => a.key === "STR")?.score ?? 0;
  const perStr = param(rules, "CarryPerSTR", 8);
  const capacity = str * perStr;
  const load = carriedWeight(sh.sheet);
  const over = load > capacity;
  return (
    <Hint lines={[["Carried", kg(load)], ["Capacity", kg(capacity)], `Strength ${str} × ${perStr} kg`, ...(over ? [`Over by ${kg(load - capacity)}`] : [])]}>
      <RadialGauge now={Math.round(load)} max={Math.max(1, capacity)} kind={over ? "load-over" : "load"} size={50} label="kg" showMax
        title={`Load ${kg(load)} of ${kg(capacity)}`} />
    </Hint>
  );
}

export function Purse({ sh, c, rules, devMode }: { sh: SheetState; c: Computed; rules: Rules; devMode: boolean }) {
  return (
    <div className="purse">
      <div className="purse__money">
        <Coins sh={sh} devMode={devMode} />
        <Valuables sh={sh} devMode={devMode} />
      </div>
      <LoadGauge sh={sh} c={c} rules={rules} />
    </div>
  );
}
