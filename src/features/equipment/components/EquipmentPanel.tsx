/**
 * Equipment card: the purse strip (coins, valuables, load), then the bag grid, with Add / Purchase / Sell
 * opening the shop drawer (shop/). Items live on the sheet, so they are saved with the character file.
 */
import type { SheetState } from "@/features/character/state/useSheet";
import type { Computed } from "@/features/rules/compute";
import type { Rules } from "@/features/rules/types";
import { Icon } from "@/ui";
import type { ShopMode } from "../shop/EquipmentDrawer";
import { BagGrid } from "./BagGrid";
import { Purse } from "./Purse";

export function EquipmentPanel({ sh, c, rules, devMode, onShop, onMessage = () => {} }: {
  sh: SheetState; c: Computed; rules: Rules; devMode: boolean; onShop: (m: ShopMode) => void; onMessage?: (m: string) => void;
}) {
  const s = sh.sheet;
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
      <Purse sh={sh} c={c} rules={rules} devMode={devMode} />
      <BagGrid sh={sh} devMode={devMode} onMessage={onMessage} />
      <p className="note">Click an item for Wear, Use or Drop.{devMode ? " Dev mode: the first empty cell adds an item by hand; coins edit in place." : ""}</p>
    </section>
  );
}
