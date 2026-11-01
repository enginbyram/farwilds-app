/** A drawer of cards (Main, Side or Misc) floating above the bottom bar. Cards with an input (Bite Down) show it in the head. */
import type { WeaponChoice } from "@/features/equipment/model";
import { canPlay, type CombatState, type Fighter, type Owned, type PlayOptions, type Slot } from "../engine";
import { cardBehaviour, isUpgraded } from "../mechanics";
import { CardButton } from "./CardButton";

const TITLE = { active: "Main actions", side: "Side actions", misc: "Misc actions" } as const;

export function ActionDrawer({ slot, cards, fight, owned, targetKey, fighter, weapon, opt, setOpt, onPlay, onClose }: {
  slot: Slot; cards: string[]; fight: CombatState; owned: Owned; targetKey: string; fighter: Fighter; weapon: WeaponChoice;
  opt: PlayOptions; setOpt: (o: PlayOptions) => void; onPlay: (id: string) => void; onClose: () => void;
}) {
  const target = fight.foes.find(x => x.key === targetKey);
  const options = cards.map(id => cardBehaviour(id).option).filter((o): o is NonNullable<typeof o> => !!o);
  return (
    <div className={`cb__drawer cb__drawer--${slot}`} role="dialog" aria-label={`${slot} actions`}>
      <div className="cb__drawer-head">
        <h3>{TITLE[slot]}</h3>
        {options.map(o => (
          <label key={o.key} className="cb__inline">{o.label} <input type="number" min={o.min} step={o.step} value={opt[o.key]}
            onChange={e => setOpt({ ...opt, [o.key]: Number(e.target.value) })} /> {o.suffix}</label>
        ))}
        <button className="btn btn--small btn--ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="sq-row">
        {cards.length === 0 && <p className="note">Nothing here yet. Items, movement and other actions will live in Misc.</p>}
        {cards.map(id => (
          <CardButton key={id} id={id} verdict={canPlay(fight, owned, id, targetKey)} upgraded={isUpgraded(owned, id)}
            target={target} weapon={weapon} fighter={fighter} onPlay={() => onPlay(id)} />
        ))}
      </div>
    </div>
  );
}
