/** Top bar, left: level ring, name, build, race and mark, Level up / New character. */
import { param } from "@/features/rules/params";
import { Hint, Icon } from "@/ui";
import type { SheetProps } from "../types";

export function IdentitySection({ rules, sh, ch, c, onLevelUp, onCreate }: SheetProps & { onLevelUp: () => void; onCreate: () => void }) {
  const s = sh.sheet;
  const mark = rules.marks.find(m => m.name === s.mark);
  return (
    <section className="ct ct--data" aria-label="Character">
      <div className="ct__level" title={`Level ${c.level} · ${c.band.writtenAs}`}><b>{c.level}</b></div>
      <div className="ct__who">
        <input className="character__name ct__name" value={ch.name} aria-label="Character name" onChange={e => ch.setName(e.target.value)} spellCheck={false} />
        <div className="ct__class"><b>{c.buildName}</b><span className="mono">{ch.className} · {c.aptitude}</span></div>
        <div className="ct__facts">
          <Hint lines={[["Lineage", c.lineage || "—"], ["Speed", `${c.combat.speed} m`]]}><span className="ct__fact"><Icon name="race" />{s.race || "—"}</span></Hint>
          <Hint lines={mark && mark.kind !== "None" ? [[mark.kind, mark.pole], ...(mark.note ? [mark.note] : [])] : ["No mark or power"]}>
            <span className="ct__fact"><Icon name="mark" />{s.mark}</span></Hint>
        </div>
      </div>
      <div className="ct__actions">
        <button className="btn btn--class" onClick={onLevelUp} disabled={c.level >= param(rules, "MaxLevel", 45)}>Level up</button>
        <button className="btn btn--ghost btn--small" onClick={onCreate}>New character</button>
      </div>
    </section>
  );
}
