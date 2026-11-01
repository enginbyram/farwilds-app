/** One card in a drawer: a square button with a two-letter symbol, and a tooltip saying what it does and whether it can be played. */
import { initials, signed } from "@/core/format";
import type { WeaponChoice } from "@/features/equipment/model";
import { ATTACK, SKILLS, cardSlot, type Fighter, type FoeState } from "../engine";
import { cardBehaviour } from "../mechanics";

const SLOT_NAME = { active: "Main", side: "Side", misc: "Misc" } as const;

export function CardButton({ id, verdict, upgraded, target, weapon, fighter, onPlay }: {
  id: string; verdict: { ok: boolean; why: string }; upgraded: boolean; target?: FoeState;
  weapon: WeaponChoice; fighter: Fighter; onPlay: () => void;
}) {
  const def = SKILLS[id];
  const title = id === ATTACK ? "Weapon attack" : def.name;
  const slot = cardSlot(id);
  const targeted = !!cardBehaviour(id).targeted;
  return (
    <div className="sq">
      <button className={`sq__btn sq__btn--${slot}${verdict.ok ? "" : " sq__btn--off"}`} disabled={!verdict.ok} onClick={onPlay} aria-label={title}>
        <span className="sq__glyph">{id === ATTACK ? "At" : initials(def.name)}</span>
        {upgraded && <i className="sq__lvl">II</i>}
      </button>
      <span className="sq__tip" role="tooltip">
        <b>{title}{upgraded ? " II" : ""}</b>
        <em>{SLOT_NAME[slot]}{def ? ` · ${def.pillar}` : ""}</em>
        {id === ATTACK ? `Strike with your ${weapon.name.toLowerCase()}: ${weapon.dice}${weapon.damageType ? ` ${weapon.damageType}` : ""} ${signed(fighter.ap)} AP.` : def.text}
        <strong className={verdict.ok ? "" : "off"}>{verdict.ok ? (targeted && target ? `Click to use on ${target.name}` : "Click to use") : verdict.why}</strong>
      </span>
    </div>
  );
}
