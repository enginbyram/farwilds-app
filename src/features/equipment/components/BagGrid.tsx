/** The bag: a grid of cells (gear.json → bagColumns, bagMinCells). Click an item for its menu; Dev mode adds by hand. */
import { useState } from "react";
import type { SheetState } from "@/features/character/state/useSheet";
import { Hint, Icon, Menu, menuAt, type MenuState } from "@/ui";
import { BAG_COLUMNS, BAG_MIN_CELLS, itemIcon } from "../model";
import { bagItemLines } from "./itemHints";
import { askItem, bagEntries } from "./itemMenus";

export function BagGrid({ sh, devMode, onMessage }: { sh: SheetState; devMode: boolean; onMessage: (m: string) => void }) {
  const { sheet: s, update } = sh;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const cells = Math.max(BAG_MIN_CELLS, Math.ceil((s.bag.length + (devMode ? 1 : 0)) / BAG_COLUMNS) * BAG_COLUMNS);
  const edit = (i: number) => {
    const next = askItem(`Bag cell ${i + 1}`, s.bag[i]);
    if (next === undefined) return;
    const bag = [...s.bag];
    if (next) bag[i < bag.length ? i : bag.length] = next; else bag.splice(i, 1);
    update("bag", bag);
  };

  return (
    <>
      <div className="bag" style={{ gridTemplateColumns: `repeat(${BAG_COLUMNS}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }, (_, i) => {
          const it = s.bag[i];
          const cell = (
            <span className={`bag__cell${it ? " bag__cell--full" : ""}`}>
              {it && <>{it.kind || it.ref ? <Icon name={itemIcon(it)} size={18} /> : <span className="bag__abbr">{it.name.slice(0, 2)}</span>}
                {it.qty && it.qty > 1 ? <b className="bag__qty">{it.qty}</b> : null}</>}
            </span>
          );
          if (it) {
            const open = (e: React.MouseEvent<HTMLElement>) => setMenu(menuAt(e, it.name, [
              ...bagEntries(sh, i, onMessage),
              ...(devMode ? [{ label: "Edit by hand (dev)", icon: "edit", onClick: () => edit(i) }] : []),
            ]));
            return <Hint key={i} lines={bagItemLines(it)}><button type="button" className="slot__btn" onClick={open} aria-haspopup="menu" aria-label={it.name}>{cell}</button></Hint>;
          }
          const content = devMode && i === s.bag.length
            ? <button type="button" className="slot__btn" onClick={() => edit(i)} aria-label="Add an item by hand">{cell}</button>
            : cell;
          return <span key={i} className="bag__wrap">{content}</span>;
        })}
      </div>
      <Menu menu={menu} onClose={() => setMenu(null)} />
    </>
  );
}
