/**
 * Character creator — a new level-1 character, step by step:
 *   1 Origin (name, race, mark or power, dominant affinity) → 2 Class → 3 Attributes → 4 Review.
 * Every character starts with the same well (the playerStart tier); the subdominant affinity opens later.
 * Nothing touches the current character until "Create character" is pressed.
 */
import { useMemo, useState } from "react";
import { DEFAULT_SHEET } from "@/hooks/useSheet";
import { attributeFocus, computeCharacter, creationBudget, paramGetter, startingWell } from "@/rules/compute";
import { Badge, signed } from "./ui";
import { ATTR_KEYS, type AttrKey, type AttrPoints, type CharacterSheet, type Rules, zeroPoints } from "@/rules/types";

export interface NewCharacter { name: string; coreClass: string; sheet: CharacterSheet; }

const STEPS = ["Origin", "Class", "Attributes", "Review"] as const;

function Chips({ points }: { points: AttrPoints }) {
  const on = ATTR_KEYS.filter(k => points[k]);
  if (!on.length) return <span className="mono">no bonus</span>;
  return <span className="chips">{on.map(k => <span key={k} className={`chip${points[k] >= 2 ? " chip--main" : ""}`}>{k} {signed(points[k])}</span>)}</span>;
}

function Choice({ selected, onClick, children, className = "" }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={`choice${selected ? " choice--on" : ""} ${className}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function CharacterCreator({ rules, onCreate, onCancel }: { rules: Rules; onCreate: (c: NewCharacter) => void; onCancel: () => void }) {
  const p = paramGetter(rules);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [coreClass, setCoreClass] = useState("");
  const [sheet, setSheet] = useState<CharacterSheet>(() => ({
    ...DEFAULT_SHEET, race: "", mark: "None", subdominant: "None", level: 1, points: zeroPoints(), skillPoints: {},
  }));
  const set = <K extends keyof CharacterSheet>(k: K, v: CharacterSheet[K]) => setSheet(s => ({ ...s, [k]: v }));

  const c = useMemo(() => computeCharacter(rules, sheet, coreClass), [rules, sheet, coreClass]);
  const focus = attributeFocus(rules, sheet.race, coreClass);
  const budget = creationBudget(rules, sheet.mark), maxPer = p("CreationMaxPerAttribute");
  const well = startingWell(rules);
  const left = budget - c.pointsUsed;

  const lineages = [...new Set(rules.races.map(r => r.lineage))];
  const aptitudes = rules.aptitudes.map(a => a.name);
  const bump = (k: AttrKey, d: number) => setSheet(s => {
    const v = (s.points[k] ?? 0) + d;
    if (v < 0 || v > maxPer || (d > 0 && left <= 0)) return s;
    return { ...s, points: { ...s.points, [k]: v } };
  });

  const stepOk = [
    name.trim() !== "" && !!sheet.race && !!sheet.dominant,
    !!coreClass,
    left === 0,
    true,
  ];
  const missing1 = !name.trim() ? "Give the character a name." : !sheet.race ? "Choose a race." : "";
  const canGo = (i: number) => stepOk.slice(0, i).every(Boolean);

  return (
    <div className="creator">
      <section className="card creator__head">
        <h2>New character · level 1</h2>
        <ol className="stepper">
          {STEPS.map((t, i) => (
            <li key={t}>
              <button className={`stepper__step${i === step ? " is-on" : ""}${stepOk[i] && i < step ? " is-done" : ""}`}
                disabled={!canGo(i)} onClick={() => setStep(i)}>
                <span className="stepper__n">{i + 1}</span>{t}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 1 Origin ── */}
      {step === 0 && (
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

          <p className="note">Every character starts with a {well?.tier ?? "—"} well (Quick {well?.base ?? 0}, ceiling {well?.ceiling ?? 0}).
            The subdominant affinity opens at Ascendancy {p("SubdominantAscension")}.</p>
        </section>
      )}

      {/* ── 2 Class ── */}
      {step === 1 && (
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
      )}

      {/* ── 3 Attributes ── */}
      {step === 2 && (
        <section className="card creator__body">
          <div className="creator__budget">
            <div><b className={left === 0 ? "ok" : ""}>{left}</b><span>points left of {budget}</span></div>
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
                      <span className="stepperbtns">
                        <button className="btn btn--small" aria-label={`Less ${a.name}`} disabled={a.points <= 0} onClick={() => bump(a.key, -1)}>−</button>
                        <b className="stepperbtns__v">{a.points}</b>
                        <button className="btn btn--small" aria-label={`More ${a.name}`} disabled={a.points >= maxPer || left <= 0} onClick={() => bump(a.key, 1)}>+</button>
                      </span>
                    </td>
                    <td className="num"><b>{a.score}</b></td>
                    <td className="num"><Badge focus={focus[a.key]}>{signed(a.mod)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 4 Review ── */}
      {step === 3 && (
        <section className="card creator__body">
          <p className="title">{name}</p>
          <p className="mono">{sheet.race} ({c.lineage}){sheet.mark !== "None" ? ` · ${sheet.mark}` : ""} · {coreClass} ({c.aptitude}) · d{c.hitDie}</p>
          <div className="creator__review">
            <dl className="facts">
              <dt>Affinity</dt><dd>{sheet.dominant}</dd>
              <dt>Sub-arts open</dt><dd>{c.subArts || "—"}</dd>
              <dt>Mark or power</dt><dd>{sheet.mark}</dd>
              <dt>Well</dt><dd>{well?.tier}</dd>
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
      )}

      <div className="creator__nav">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <span className="reason">{step === 0 && missing1}{step === 2 && left !== 0 ? (left > 0 ? `Spend ${left} more point${left === 1 ? "" : "s"}.` : "") : ""}</span>
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1
          ? <button className="btn primary" disabled={!stepOk[step]} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>
          : <button className="btn btn--success" onClick={() => onCreate({ name: name.trim(), coreClass, sheet })}>Create character</button>}
      </div>
    </div>
  );
}
