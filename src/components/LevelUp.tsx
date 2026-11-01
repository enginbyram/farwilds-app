/**
 * Level up, in two steps:
 *   1. Tree page — LevelUpCard sits on top of the sidebar while you unlock the new level's node.
 *   2. LevelUpScreen — what the level gives: new ascendancy (ring I / II), subdominant affinity
 *      (Ascendancy III), skill points (+2 per ascension), attribute points (AttributePointsPerLevel).
 * Nothing is kept until "Confirm level up"; Cancel refunds the node(s) taken in step 1.
 */
import { useMemo, useState } from "react";
import type { TreeModel } from "@/data/types";
import type { Character } from "@/hooks/useCharacter";
import { bandLabel, computeCharacter, paramGetter } from "@/rules/compute";
import { ATTR_KEYS, type AttrKey, type CharacterSheet, type Rules, zeroPoints } from "@/rules/types";
import { classStyle } from "./CharacterPage";
import { Badge, signed } from "./ui";

export interface PendingLevelUp { from: number; to: number; snapshot: string[]; }

export function LevelUpCard({ pending, ch, onContinue, onCancel }: {
  pending: PendingLevelUp; ch: Character; onContinue: () => void; onCancel: () => void;
}) {
  const taken = ch.unlockedIds.filter(id => !pending.snapshot.includes(id)).length;
  return (
    <section className="card levelup-card">
      <h2>Level up · {pending.from} → {pending.to}</h2>
      <p className="title">{taken ? "Node taken" : "Choose a node"}</p>
      <p className="note" style={{ marginTop: 4 }}>
        {ch.left > 0 ? `Unlock a node on the map — ${ch.left} point${ch.left === 1 ? "" : "s"} to spend.` : "All points spent. Continue to the Level Up screen."}
      </p>
      <div className="node-card__actions" style={{ marginTop: 10 }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--success" style={{ flex: 1 }} onClick={onContinue}>
          {ch.left > 0 ? "Continue without a node" : "Continue"}
        </button>
      </div>
    </section>
  );
}

export function LevelUpScreen({ rules, model, ch, sheet, pending, onConfirm, onCancel }: {
  rules: Rules; model: TreeModel; ch: Character; sheet: CharacterSheet; pending: PendingLevelUp;
  onConfirm: (next: CharacterSheet) => void; onCancel: () => void;
}) {
  const p = paramGetter(rules);
  const cls = ch.className;
  const before = useMemo(() => computeCharacter(rules, sheet, cls), [rules, sheet, cls]);
  const band = bandLabel(pending.to, p("BandSize") || 1);
  const crossing = band.inBand === 1 && band.band >= 1;
  const lv = before.levels;

  const [asc1, setAsc1] = useState(sheet.asc1);
  const [asc2, setAsc2] = useState(sheet.asc2);
  const [sub, setSub] = useState(sheet.subdominant);
  const [skillAdd, setSkillAdd] = useState<Record<string, number>>({});
  const [attrAdd, setAttrAdd] = useState(zeroPoints());

  const needAsc1 = pending.to >= lv.ascILevel && !sheet.asc1;
  const needAsc2 = pending.to >= lv.ascIILevel && !sheet.asc2;
  const offerSub = band.band >= p("SubdominantAscension") && (!sheet.subdominant || sheet.subdominant === "None");

  const draft: CharacterSheet = {
    ...sheet, level: pending.to, asc1, asc2, subdominant: sub,
    skillPoints: Object.fromEntries(rules.skills.map(k => [k.name, (sheet.skillPoints[k.name] ?? 0) + (skillAdd[k.name] ?? 0)])),
    points: Object.fromEntries(ATTR_KEYS.map(k => [k, (sheet.points[k] ?? 0) + attrAdd[k]])) as CharacterSheet["points"],
  };
  const after = computeCharacter(rules, draft, cls);
  const skillLeft = after.skillPointsAvailable - after.skillPointsUsed;
  const attrLeft = after.attributePointsAvailable - after.pointsUsed;
  const newNodes = ch.unlockedIds.filter(id => !pending.snapshot.includes(id)).map(id => model.byId.get(id)?.name ?? id);
  const ready = (!needAsc1 || !!asc1) && (!needAsc2 || !!asc2) && skillLeft >= 0 && attrLeft >= 0;

  const diffs: [string, number | string | null, number | string | null][] = [
    ["Hit Points", before.combat.hp, after.combat.hp],
    ["Quick", before.pools.quick, after.pools.quick],
    ["Sanity", before.pools.sanity, after.pools.sanity],
    ["Purequick", before.pools.purequick, after.pools.purequick],
    ["Keystone points", before.keystonePoints, after.keystonePoints],
    ["Expertise points", before.expertisePoints, after.expertisePoints],
    ["Skill points", before.skillPointsAvailable, after.skillPointsAvailable],
  ];
  const focusOf = (k: string) => after.attributes.find(a => a.key === k)?.focus ?? "";
  const asc1Options = rules.ascendancies.filter(a => a.coreClass === cls);
  const asc2Options = rules.ascendancies.filter(a => a.name !== asc1);

  return (
    <div className="creator levelup" style={classStyle(cls)}>
      <section className="card creator__head levelup__head">
        <div>
          <h2>Level up</h2>
          <p className="title">{ch.name}: level {pending.from} → {pending.to}</p>
          <p className="mono">{band.writtenAs}{crossing ? ` · ring ${band.band} reached` : ""}</p>
        </div>
        <div className="levelup__nodes">
          <span className="field__label">Tree</span>
          {newNodes.length ? newNodes.map(n => <span key={n} className="chip chip--main">{n}</span>) : <span className="muted">no node taken</span>}
        </div>
      </section>

      <div className="levelup__grid">
        <section className="card">
          <h2>What changes</h2>
          <dl className="facts">
            {diffs.filter(d => d[1] !== null || d[2] !== null).map(([l, b, a]) => (
              <Fragment key={l} label={l} before={b} after={a} />
            ))}
          </dl>
        </section>

        {needAsc1 && (
          <section className="card">
            <h2>First ascendancy · required</h2>
            <div className="choices choices--wide">
              {asc1Options.map(a => (
                <button key={a.name} type="button" className={`choice${asc1 === a.name ? " choice--on" : ""}`} onClick={() => setAsc1(a.name)}>
                  <span className="choice__top"><b>{a.name}</b><span className="mono">{a.name === cls ? "go deep" : "sundering"} · d{a.hitDie}</span></span>
                  <span className="choice__text">{a.identity}</span>
                  {a.forbidden && <span className="reason">Forbidden — needs the forbidden zone gate</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {needAsc2 && (
          <section className="card">
            <h2>Second ascendancy · required</h2>
            <select className="in" value={asc2} onChange={e => setAsc2(e.target.value)} aria-label="Second ascendancy">
              <option value="">— choose —</option>
              {rules.coreClasses.map(k => (
                <optgroup key={k.name} label={`${k.name} · ${k.aptitude}`}>
                  {asc2Options.filter(a => a.coreClass === k.name).map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
            {asc2 && (
              <dl className="facts">
                <dt>Build name</dt><dd><b>{after.buildName}</b>{after.combination ? " (named combination)" : ""}</dd>
                <dt>Cross-aptitude</dt><dd>{after.cross || "—"}</dd>
                <dt>Gate needed</dt><dd>{after.gates.length ? after.gates.join(", ") : "—"}</dd>
              </dl>
            )}
          </section>
        )}

        {offerSub && (
          <section className="card">
            <h2>Subdominant affinity · now open</h2>
            <div className="choices">
              {["None", ...rules.elements.map(e => e.name).filter(n => n !== sheet.dominant)].map(n => (
                <button key={n} type="button" className={`choice${sub === n ? " choice--on" : ""}`} onClick={() => setSub(n)}>
                  <b>{n}</b>{n !== "None" && <span className="mono">compound: {sheet.dominant} + {n}</span>}
                </button>
              ))}
            </div>
            <p className="note">You can leave it for later.</p>
          </section>
        )}

        {(after.skillPointsAvailable - before.skillPointsUsed > 0) && (
          <section className="card">
            <h2>Skill points · {skillLeft} left</h2>
            <ul className="skilllist skilllist--edit">
              {rules.skills.map(k => {
                const add = skillAdd[k.name] ?? 0;
                return (
                  <li key={k.name}>
                    <span>{k.name}</span>
                    <Badge focus={focusOf(k.attribute)}>{k.attribute}</Badge>
                    <span className="stepperbtns">
                      <button className="btn btn--small" disabled={add <= 0} onClick={() => setSkillAdd(x => ({ ...x, [k.name]: add - 1 }))} aria-label={`Less ${k.name}`}>−</button>
                      <b className="stepperbtns__v">{(sheet.skillPoints[k.name] ?? 0) + add}</b>
                      <button className="btn btn--small" disabled={skillLeft <= 0} onClick={() => setSkillAdd(x => ({ ...x, [k.name]: add + 1 }))} aria-label={`More ${k.name}`}>+</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {skillLeft > 0 && <p className="note">Unspent points carry over to the next level up.</p>}
          </section>
        )}

        {(after.attributePointsAvailable - before.pointsUsed > 0) && (
          <section className="card">
            <h2>Attribute points · {attrLeft} left</h2>
            <ul className="skilllist skilllist--edit">
              {after.attributes.map(a => (
                <li key={a.key}>
                  <span>{a.name}</span>
                  <Badge focus={a.focus}>{a.key}</Badge>
                  <span className="stepperbtns">
                    <button className="btn btn--small" disabled={attrAdd[a.key] <= 0} onClick={() => setAttrAdd(x => ({ ...x, [a.key as AttrKey]: x[a.key] - 1 }))}>−</button>
                    <b className="stepperbtns__v">{a.score}</b>
                    <button className="btn btn--small" disabled={attrLeft <= 0} onClick={() => setAttrAdd(x => ({ ...x, [a.key as AttrKey]: x[a.key] + 1 }))}>+</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="creator__nav">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel level up</button>
        <span className="reason">{!ready ? (needAsc1 && !asc1 ? "Choose the first ascendancy." : needAsc2 && !asc2 ? "Choose the second ascendancy." : "") : ""}</span>
        <button className="btn btn--success" disabled={!ready} onClick={() => onConfirm(draft)}>Confirm level up</button>
      </div>
    </div>
  );
}

function Fragment({ label, before, after }: { label: string; before: number | string | null; after: number | string | null }) {
  const b = before ?? "—", a = after ?? "—";
  const gain = typeof before === "number" && typeof after === "number" ? after - before : null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{b} → <b>{a}</b>{gain ? <span className="gain"> {signed(gain)}</span> : null}</dd>
    </>
  );
}
