/** Passives and reactions: the tray (grows up from the bottom-right button) and its button. Lit symbols are active right now. */
import { initials } from "@/core/format";
import { SKILLS, type Owned } from "../engine";
import { isUpgraded } from "../mechanics";

export function PassiveTray({ ids, lit, owned }: { ids: string[]; lit: Record<string, boolean>; owned: Owned }) {
  return (
    <ul className="cb__tray" aria-label="Passives and reactions">
      {ids.length === 0 && <li className="cb__tray-empty">No passives or reactions</li>}
      {ids.map(id => {
        const def = SKILLS[id], up = isUpgraded(owned, id);
        return (
          <li key={id} className={`aura aura--${def.pillar.toLowerCase()}${lit[id] ? " aura--on" : ""}`} tabIndex={0}>
            <span className="aura__glyph">{initials(def.name)}{up && <i>II</i>}</span>
            <span className="aura__tip" role="tooltip">
              <b>{def.name}{up ? " II" : ""}</b>
              <em>{def.action === "reaction" ? "Reaction" : "Passive"} · {def.pillar}{lit[id] ? " · active now" : ""}</em>
              {def.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function TrayButton({ ids, lit, open, onToggle }: { ids: string[]; lit: Record<string, boolean>; open: boolean; onToggle: () => void }) {
  return (
    <button className={`tray-btn${open ? " tray-btn--open" : ""}`} onClick={onToggle} aria-expanded={open} title="Passives and reactions">
      <span className="tray-btn__grid">{ids.slice(0, 4).map(id => <i key={id} className={lit[id] ? "on" : ""} />)}</span>
      <span>{ids.length}</span>
    </button>
  );
}
