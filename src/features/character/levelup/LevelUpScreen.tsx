/**
 * Level up, step 2: what the level gives — new ascendancy (ring I / II, read from the tree), subdominant affinity
 * (Ascendancy III), skill points (+2 per ascension), attribute points (AttributePointsPerLevel).
 * Nothing is kept until "Confirm level up"; Cancel refunds the node(s) taken in step 1.
 */
import { useMemo, useState } from "react";
import type { TreeModel } from "@/features/tree/types";
import type { Character } from "@/features/character/state/useCharacter";
import { bandLabel, computeCharacter, paramGetter } from "@/features/rules/compute";
import { collectBonuses } from "@/features/rules/bonuses";
import { ATTR_KEYS, type AttrKey, type CharacterSheet, type Rules, zeroPoints } from "@/features/rules/types";
import { signed } from "@/core/format";
import { Badge, classStyle, Stepper } from "@/ui";
import { ascendanciesFromTree, type TreeAscendancy } from "./ascendancies";
import type { PendingLevelUp } from "./types";

export function LevelUpScreen({ rules, model, ch, sheet, pending, onConfirm, onCancel }: {
  rules: Rules; model: TreeModel; ch: Character; sheet: CharacterSheet; pending: PendingLevelUp;
  onConfirm: (next: CharacterSheet) => void; onCancel: () => void;
}) {
  const p = paramGetter(rules);
  const cls = ch.className;
  // Bonuses before the level (nodes owned when it started) and after (with the new nodes).
  const skillNames = rules.skills.map(k => k.name);
  const extBefore = useMemo(() => collectBonuses(sheet, [...ch.owned].filter(n => n.isCentre || pending.snapshot.includes(n.id) || n === ch.start), model.effects, skillNames),
    [sheet, ch.owned, pending.snapshot, model.effects]);   // eslint-disable-line react-hooks/exhaustive-deps
  const extAfter = useMemo(() => collectBonuses(sheet, ch.owned, model.effects, skillNames), [sheet, ch.owned, model.effects]);   // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => computeCharacter(rules, sheet, cls, extBefore), [rules, sheet, cls, extBefore]);
  const band = bandLabel(pending.to, p("BandSize") || 1);
  const crossing = band.inBand === 1 && band.band >= 1;
  const lv = before.levels;

  const startRing = ch.start?.ring ?? 1;
  const tree = ascendanciesFromTree(rules, model, ch.unlockedIds, startRing, sheet.asc1);
  const asc1 = sheet.asc1 || tree.first?.asc || "";
  const asc2 = sheet.asc2 || tree.second?.asc || "";
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
  const after = computeCharacter(rules, draft, cls, extAfter);
  const skillLeft = after.skillPointsAvailable - after.skillPointsUsed;
  const attrLeft = after.attributePointsAvailable - after.pointsUsed;
  const newNodes = ch.unlockedIds.filter(id => !pending.snapshot.includes(id)).map(id => model.byId.get(id)?.name ?? id);
  const ready = skillLeft >= 0 && attrLeft >= 0;

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
              <DiffRow key={l} label={l} before={b} after={a} />
            ))}
          </dl>
        </section>

        {needAsc1 && (
          <AscCard title="First ascendancy" ring={startRing + 1} taken={tree.first} rules={rules} />
        )}

        {needAsc2 && (
          <section className="card">
            <h2>Second ascendancy · from the tree</h2>
            {tree.second ? (
              <dl className="facts">
                <dt>Node</dt><dd><b>{tree.second.node}</b>{tree.second.note ? <span className="mono"> · {tree.second.note}</span> : null}</dd>
                <dt>Build name</dt><dd><b>{after.buildName}</b>{after.combination ? " (named combination)" : ""}</dd>
                <dt>Cross-aptitude</dt><dd>{after.cross || "—"}</dd>
                <dt>Gate needed</dt><dd>{after.gates.length ? after.gates.join(", ") : "—"}</dd>
              </dl>
            ) : <p className="note">Not taken yet. Unlock an ascendancy node on ring {startRing + 2} of the tree to take it.</p>}
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
                    <Stepper value={(sheet.skillPoints[k.name] ?? 0) + add} canDec={add > 0} canInc={skillLeft > 0}
                      onDec={() => setSkillAdd(x => ({ ...x, [k.name]: add - 1 }))} onInc={() => setSkillAdd(x => ({ ...x, [k.name]: add + 1 }))}
                      decLabel={`Less ${k.name}`} incLabel={`More ${k.name}`} />
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
                  <Stepper value={a.score} canDec={attrAdd[a.key] > 0} canInc={attrLeft > 0}
                    onDec={() => setAttrAdd(x => ({ ...x, [a.key as AttrKey]: x[a.key] - 1 }))} onInc={() => setAttrAdd(x => ({ ...x, [a.key as AttrKey]: x[a.key] + 1 }))}
                    decLabel={`Less ${a.name}`} incLabel={`More ${a.name}`} />
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

/** "Hit Points 24 → 31 +7" */
function DiffRow({ label, before, after }: { label: string; before: number | string | null; after: number | string | null }) {
  const b = before ?? "—", a = after ?? "—";
  const gain = typeof before === "number" && typeof after === "number" ? after - before : null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{b} → <b>{a}</b>{gain ? <span className="gain"> {signed(gain)}</span> : null}</dd>
    </>
  );
}

function AscCard({ title, ring, taken, rules }: { title: string; ring: number; taken: TreeAscendancy | null; rules: Rules }) {
  const a = taken ? rules.ascendancies.find(x => x.name === taken.asc) : undefined;
  return (
    <section className="card">
      <h2>{title} · from the tree</h2>
      {taken ? (
        <>
          <p className="title">{taken.node}</p>
          {a && <p className="mono">{taken.note || (a.name === a.coreClass ? "go deep" : "sundering")} · d{a.hitDie} · {a.maxArmour} armour</p>}
          {a && <p className="note">{a.identity}</p>}
        </>
      ) : <p className="note">Not taken yet. Unlock an ascendancy node on ring {ring} of the tree to take it.</p>}
    </section>
  );
}
