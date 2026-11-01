/**
 * The four steps of the Creator. Each is a plain component: it shows the draft and reports changes.
 * Add a step: write a component here and list it in STEPS (CharacterCreator.tsx).
 */
import { signed } from "@/core/format";
import type { Computed } from "@/features/rules/compute";
import { paramGetter } from "@/features/rules/compute";
import { ATTR_KEYS, type AttrKey, type AttrPoints, type CharacterSheet, type Focus, type Rules, zeroPoints } from "@/features/rules/types";
import { Badge, Choice, RadialGauge, Stepper } from "@/ui";

/** What every step works on. */
export interface StepProps {
  rules: Rules; c: Computed; sheet: CharacterSheet;
  setSheet: (f: (s: CharacterSheet) => CharacterSheet) => void;
  set: <K extends keyof CharacterSheet>(k: K, v: CharacterSheet[K]) => void;
}

/** Attribute bonuses as chips: "STR +2" (gold when 2 or more). */
function Chips({ points }: { points: AttrPoints }) {
  const on = ATTR_KEYS.filter(k => points[k]);
  if (!on.length) return <span className="mono">no bonus</span>;
  return <span className="chips">{on.map(k => <span key={k} className={`chip${points[k] >= 2 ? " chip--main" : ""}`}>{k} {signed(points[k])}</span>)}</span>;
}

/** 1 · Name, race, mark or power, dominant affinity. */
export function OriginStep({ rules, sheet, setSheet, set, name, setName }: StepProps & { name: string; setName: (n: string) => void }) {
  const p = paramGetter(rules);
  const lineages = [...new Set(rules.races.map(r => r.lineage))];
  return (
    <section className="card creator__body">
      <label className="field creator__name">
        <span className="field__label">Name</span>
        <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="Aldric Haemund" autoFocus spellCheck={false} />
      </label>

      <h3>Race</h3>
      {lineages.map(l => (
        <div key={l} className="creator__group">
          <span className="creator__groupname">{l}</span>
          <div className="choices">
            {rules.races.filter(r => r.lineage === l).map(r => (
              <Choice key={r.name} selected={sheet.race === r.name} onClick={() => set("race", r.name)}>
                <b>{r.name}</b><Chips points={r.points} />
              </Choice>
            ))}
          </div>
        </div>
      ))}

      <h3>Mark or power</h3>
      <div className="choices">
        {rules.marks.map(m => (
          <Choice key={m.name} selected={sheet.mark === m.name} onClick={() => setSheet(s => ({ ...s, mark: m.name, points: zeroPoints() }))}>
            <b>{m.name}</b>
            <span className="mono">{m.kind === "None" ? "no mark" : `${m.kind} · ${m.pole}`}</span>
            {m.freePoints > 0 ? <span className="chip chip--main">+{m.freePoints} free points</span> : <Chips points={m.points} />}
          </Choice>
        ))}
      </div>

      <h3>Dominant affinity</h3>
      <div className="choices">
        {rules.elements.map(e => (
          <Choice key={e.name} selected={sheet.dominant === e.name}
            onClick={() => setSheet(s => ({ ...s, dominant: e.name, subdominant: s.subdominant === e.name ? "None" : s.subdominant }))}>
            <b>{e.name}</b><span className="mono">sub-arts: {e.subArts || "—"}</span>
          </Choice>
        ))}
      </div>

      <p className="note">The subdominant affinity opens at Ascendancy {p("SubdominantAscension")}.</p>
    </section>
  );
}

/** 2 · Core class, grouped by aptitude. */
export function ClassStep({ rules, c, coreClass, setCoreClass }: Pick<StepProps, "rules" | "c"> & { coreClass: string; setCoreClass: (c: string) => void }) {
  const aptitudes = rules.aptitudes.map(a => a.name);
  return (
    <section className="card creator__body">
      {aptitudes.map(ap => (
        <div key={ap} className="creator__group">
          <span className="creator__groupname">{ap}</span>
          <div className="choices choices--wide">
            {rules.coreClasses.filter(k => k.aptitude === ap).map(k => (
              <Choice key={k.name} selected={coreClass === k.name} onClick={() => setCoreClass(k.name)} className="choice--class">
                <span className="choice__top"><b>{k.name}</b><span className="mono">d{k.hitDie}</span></span>
                <Chips points={k.points} />
                <span className="choice__text">{k.identity}</span>
                <span className="mono">Ascendancies: {rules.ascendancies.filter(a => a.coreClass === k.name && a.name !== k.name).map(a => a.name).join(", ")}</span>
              </Choice>
            ))}
          </div>
        </div>
      ))}
      <p className="note">The first ascendancy opens at level {c.levels.ascILevel}; it is chosen later on the Character page.</p>
    </section>
  );
}

/** 3 · Spend the creation points. */
export function AttributesStep({ rules, c, setSheet, set, focus }: StepProps & { focus: Record<AttrKey, Focus> }) {
  const p = paramGetter(rules);
  const budget = c.creationPoints, maxPer = p("CreationMaxPerAttribute");
  const left = budget - c.pointsUsed;
  const bump = (k: AttrKey, d: number) => setSheet(s => {
    const v = (s.points[k] ?? 0) + d;
    if (v < 0 || v > maxPer || (d > 0 && left <= 0)) return s;
    return { ...s, points: { ...s.points, [k]: v } };
  });
  return (
    <section className="card creator__body">
      <div className="creator__budget">
        <div className="creator__budgetnum"><RadialGauge now={left} max={budget} kind="points" size={56} title={`${left} of ${budget} points left`} /><span>points left of {budget}</span></div>
        <p className="note">{p("CreationPoints")} points{budget > p("CreationPoints") ? ` + ${budget - p("CreationPoints")} free (no mark)` : ""}; up to {maxPer} per attribute, on top of race, mark and class. Focus: Main where race or class gives 2, Side where it gives 1.</p>
        <button className="btn btn--small btn--ghost" onClick={() => set("points", zeroPoints())} disabled={c.pointsUsed === 0}>Clear</button>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Attribute</th><th /><th>Race</th><th>Mark</th><th>Class</th><th className="in-col">Points</th><th>Score</th><th>Mod</th></tr></thead>
          <tbody>
            {c.attributes.map(a => (
              <tr key={a.key}>
                <td>{a.name}</td>
                <td><Badge focus={focus[a.key]}>{a.key}</Badge></td>
                <td className="num">{signed(a.race)}</td>
                <td className="num">{signed(a.mark)}</td>
                <td className="num">{signed(a.cls)}</td>
                <td>
                  <Stepper value={a.points} canDec={a.points > 0} canInc={a.points < maxPer && left > 0}
                    onDec={() => bump(a.key, -1)} onInc={() => bump(a.key, 1)} decLabel={`Less ${a.name}`} incLabel={`More ${a.name}`} />
                </td>
                <td className="num"><b>{a.score}</b></td>
                <td className="num"><Badge focus={focus[a.key]}>{signed(a.mod)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 4 · Everything at a glance before Create. */
export function ReviewStep({ c, sheet, name, coreClass }: Pick<StepProps, "c" | "sheet"> & { name: string; coreClass: string }) {
  return (
    <section className="card creator__body">
      <p className="title">{name}</p>
      <p className="mono">{sheet.race} ({c.lineage}){sheet.mark !== "None" ? ` · ${sheet.mark}` : ""} · {coreClass} ({c.aptitude}) · d{c.hitDie}</p>
      <div className="creator__review">
        <dl className="facts">
          <dt>Affinity</dt><dd>{sheet.dominant}</dd>
          <dt>Sub-arts open</dt><dd>{c.subArts || "—"}</dd>
          <dt>Mark or power</dt><dd>{sheet.mark}</dd>
        </dl>
        <div className="stats">
          <div className="stat stat--big"><b>{c.combat.hp}</b><span>Hit Points</span></div>
          <div className="stat stat--big"><b>{c.pools.quick}</b><span>Quick</span></div>
          <div className="stat stat--big"><b>{c.pools.sanity}</b><span>Sanity</span></div>
          <div className="stat"><b>{signed(c.combat.initiative)}</b><span>Initiative</span></div>
          <div className="stat"><b>{c.combat.speed} m</b><span>Speed</span></div>
          <div className="stat"><b>{signed(c.combat.apMelee)}</b><span>AP melee</span></div>
        </div>
      </div>
      <div className="scores">
        {c.attributes.map(a => (
          <div key={a.key} className="score"><Badge focus={a.focus}>{a.key}</Badge><b>{a.score}</b><span>{signed(a.mod)}</span></div>
        ))}
      </div>
    </section>
  );
}
