/**
 * Gear card — RPG paper doll: slots left and right of a figure, weapon slots underneath.
 * Click a slot for its menu (itemMenus.ts). Slots come from src/data/gear.json.
 */
import { useState } from "react";
import { signed } from "@/core/format";
import type { SheetState } from "@/features/character/state/useSheet";
import type { Computed } from "@/features/rules/compute";
import type { Item } from "@/features/rules/types";
import { Hint, Icon, Menu, menuAt, type MenuState } from "@/ui";
import { GEAR_SLOTS, slotsOnSide, type GearSlot } from "../model";
import { itemLines } from "./itemHints";
import { askItem, slotEntries } from "./itemMenus";

function Slot({ slot, item, onOpen }: { slot: GearSlot; item?: Item; onOpen: (e: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <Hint lines={itemLines(slot.label, item)}>
      <button type="button" className="slot__btn" onClick={onOpen} aria-haspopup="menu" aria-label={`${slot.label} slot${item ? `: ${item.name}` : ""}`}>
        <span className={`slot${item ? " slot--full" : ""}`}>
          <Icon name={slot.icon} size={22} />
          {item && <span className="slot__name">{item.name}</span>}
        </span>
      </button>
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

function WeaponGroup({ title, ap, children }: { title: string; ap: number; children: React.ReactNode }) {
  return (
    <div className="paperdoll__wgroup">
      <small>{title}</small>
      <div className="paperdoll__wslots">{children}</div>
      <Hint lines={[[`Attack Power, ${title.toLowerCase()}`, signed(ap)], "Added to the d20 for physical attacks"]}><b>{signed(ap)}</b></Hint>
    </div>
  );
}

export function GearPanel({ sh, c, devMode, onMessage = () => {} }: { sh: SheetState; c: Computed; devMode: boolean; onMessage?: (m: string) => void }) {
  const { sheet: s, update } = sh;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const edit = (slot: GearSlot) => {
    const next = askItem(slot.label, s.equipped[slot.id]);
    if (next === undefined) return;
    const equipped = { ...s.equipped };
    if (next) equipped[slot.id] = { ...next, kind: slot.id }; else delete equipped[slot.id];
    update("equipped", equipped);
  };
  const open = (e: React.MouseEvent<HTMLElement>, slot: GearSlot) => {
    const it = s.equipped[slot.id];
    const entries = slotEntries(sh, slot, onMessage);
    if (devMode) entries.push({ label: "Edit by hand (dev)", icon: "edit", onClick: () => edit(slot) });
    setMenu(menuAt(e, it ? it.name : slot.label, entries));
  };
  const side = (k: GearSlot["side"]) => slotsOnSide(k).map(x => <Slot key={x.id} slot={x} item={s.equipped[x.id]} onOpen={e => open(e, x)} />);

  return (
    <section className="card gearcard" aria-label="Gear">
      <h2>Gear <span className="h3hint">{Object.keys(s.equipped).length} of {GEAR_SLOTS.length} slots</span></h2>
      <div className="paperdoll">
        <div className="paperdoll__col">{side("left")}</div>
        <Figure />
        <div className="paperdoll__col">{side("right")}</div>
      </div>
      <div className="paperdoll__weapons">
        <WeaponGroup title="Melee" ap={c.combat.apMelee}>{side("melee")}</WeaponGroup>
        <WeaponGroup title="Ranged" ap={c.combat.apRanged}>{side("ranged")}</WeaponGroup>
      </div>
      <Menu menu={menu} onClose={() => setMenu(null)} />
    </section>
  );
}
