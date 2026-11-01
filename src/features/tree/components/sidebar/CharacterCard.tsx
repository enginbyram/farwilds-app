/** Tree sidebar, top card: name, class and tree points of the character being built. */
import type { TreeModel } from "@/features/tree/types";
import type { Character } from "@/features/character/state/useCharacter";
import { RadialGauge } from "@/ui";

export function CharacterCard({ model, ch, classLocked }: { model: TreeModel; ch: Character; classLocked?: boolean }) {
  const classes = [...model.classes.values()].filter(c => c.name !== "Centre");
  return (
    <section className="card character">
      <input className="character__name" value={ch.name} aria-label="Character name"
        onChange={e => ch.setName(e.target.value)} spellCheck={false} />
      <div className="character__row">
        <select className="character__class" aria-label="Class" value={ch.className} disabled={classLocked}
          title={classLocked ? "The class is chosen in the Creator (Dev mode unlocks it here)" : undefined}
          onChange={e => ch.setClassName(e.target.value)}>
          {classes.map(c => <option key={c.name} value={c.name}>{c.name} · {c.aptitude}</option>)}
        </select>
        <button className="btn btn--small btn--ghost" onClick={ch.reset} disabled={ch.used === 0} title="Refund every node">Reset</button>
      </div>
      <div className="numbers numbers--gauge">
        <RadialGauge now={ch.left} max={ch.total} kind="points" size={54} title={`${ch.left} of ${ch.total} tree points left`} />
        <div><b>{ch.left}</b><span>points left</span></div>
        <div><b>{ch.used}</b><span>used</span></div>
        <div><b>{ch.total}</b><span>total (= level)</span></div>
      </div>
    </section>
  );
}
