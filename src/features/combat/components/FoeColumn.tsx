/** Left third of the Combat page: the foes. Before the fight their numbers can be edited; during it, click one to target it. */
import { signed } from "@/core/format";
import { RadialGauge } from "@/ui";
import { COMBAT, type CombatState, type FoeDef, type FoeState } from "../engine";

const FOE_FIELDS = [["hp", "HP"], ["defence", "DEX"], ["armour", "Arm"], ["attack", "Atk"]] as const;

function FoeEditor({ foe, canRemove, onChange, onRemove }: { foe: FoeDef; canRemove: boolean; onChange: (k: keyof FoeDef, v: string) => void; onRemove: () => void }) {
  return (
    <div className="unit__edit">
      <input aria-label="Foe name" value={foe.name} onChange={e => onChange("name", e.target.value)} />
      <button className="unit__x" aria-label="Remove foe" onClick={onRemove} disabled={!canRemove}>×</button>
      {FOE_FIELDS.map(([k, label]) => (
        <label key={k}>{label}<input type="number" value={foe[k]} onChange={e => onChange(k, e.target.value)} /></label>))}
      <label>Dmg<input value={foe.damage} onChange={e => onChange("damage", e.target.value)} /></label>
    </div>
  );
}

function FoeCard({ f, fight, targeted }: { f: FoeState; fight: CombatState; targeted: boolean }) {
  const init = fight.order.find(o => o.key === f.key);
  return (
    <>
      <div className="unit__top"><b>{f.name}</b>{init && <span className="unit__init" title="Initiative roll">Init {init.total}</span>}</div>
      <div className="unit__body">
        <RadialGauge now={Math.max(0, f.hpNow)} max={f.hp} kind="foe" size={50} label="HP" />
        <div className="unit__meta">DEX {f.defence} · Arm {f.armour}<br />Atk {signed(f.attack)} · {f.damage}{f.eaten ? " · eaten" : ""}</div>
      </div>
      {targeted && <span className="unit__tag">Target</span>}
    </>
  );
}

export function FoeColumn({ fight, setup, foes, setFoes, targetKey, onTarget }: {
  fight: CombatState; setup: boolean; foes: FoeDef[]; setFoes: (f: (fs: FoeDef[]) => FoeDef[]) => void; targetKey: string; onTarget: (key: string) => void;
}) {
  const setFoe = (i: number, k: keyof FoeDef, v: string) => setFoes(fs => fs.map((f, j) => j !== i ? f : { ...f, [k]: k === "name" || k === "damage" ? v : Number(v) }));
  return (
    <section className="cb__col">
      <h2 className="cb__h">Foes <span>{fight.foes.filter(x => x.hpNow > 0).length} standing</span></h2>
      <ul className="cb__list">
        {fight.foes.map((f, i) => {
          const dead = f.hpNow <= 0;
          const isTurn = fight.order[fight.cursor]?.key === f.key && fight.phase === "foes";
          const targeted = targetKey === f.key && !dead;
          return (
            <li key={f.key} className={`unit unit--foe${targeted ? " unit--target" : ""}${dead ? " unit--dead" : ""}${isTurn ? " unit--turn" : ""}`}
              onClick={() => !dead && !setup && onTarget(f.key)}>
              {setup && foes[i]
                ? <FoeEditor foe={foes[i]} canRemove={foes.length > 1} onChange={(k, v) => setFoe(i, k, v)} onRemove={() => setFoes(fs => fs.filter((_, j) => j !== i))} />
                : <FoeCard f={f} fight={fight} targeted={targeted} />}
            </li>
          );
        })}
      </ul>
      {setup && (
        <select className="cb__add" aria-label="Add a foe" value="" onChange={e => { const d = COMBAT.foes.find(x => x.name === e.target.value); if (d) setFoes(fs => [...fs, { ...d }]); }}>
          <option value="">+ Add a foe…</option>
          {COMBAT.foes.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
        </select>
      )}
      {setup && <p className="note">Foe numbers are placeholders until the bestiary exists.</p>}
    </section>
  );
}
