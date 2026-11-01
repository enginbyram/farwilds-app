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
import { collectBonuses } from "@/rules/bonuses";
import { ATTR_KEYS, type AttrKey, type CharacterSheet, type Rules, zeroPoints } from "@/rules/types";
import { classStyle } from "./CharacterPage";
import { Badge, signed } from "./ui";

export interface PendingLevelUp { from: number; to: number; snapshot: string[]; }

export interface TreeAscendancy { node: string; asc: string; note: string; }
/**
 * Ascendancies are chosen on the tree, not on this screen: an ascendancy node owned one ring out from the
 * class start is the first ascendancy, two rings out the second.
 *  - "Barbarian" → Barbarian;  "Fighter II" → Fighter (go deep)
 *  - a combination node ("Bloodrager" = Barbarian + Bloodmagic) → its other root
 *  - a deepening node ("Carnage II") → no new ascendancy; the build stays in the first one
 */
export function ascendanciesFromTree(rules: Rules, model: TreeModel, ids: string[], startRing: number, asc1Hint = "") {
  const nodes = ids.map(id => model.byId.get(id)).filter((n): n is NonNullable<typeof n> => !!n && /ascend/i.test(n.type));
  const resolve = (name: string, first: string): { asc: string; note: string } => {
    const exact = rules.ascendancies.find(a => a.name === name);
    if (exact) return { asc: exact.name, note: "" };
    const base = name.replace(/\s+(I{1,3}|IV|V)$/, "");
    const deep = rules.ascendancies.find(a => a.name === base);
    if (deep) return { asc: deep.name, note: base === first ? "deepens the first ascendancy" : "go deep" };
    const combo = rules.combinations.find(c => c.name === name);
    if (combo) return { asc: combo.rootA === first ? combo.rootB : combo.rootB === first ? combo.rootA : combo.rootB, note: `${combo.name} = ${combo.rootA} + ${combo.rootB}` };
    return { asc: "", note: "deepens the first ascendancy" };
  };
  const at = (ring: number) => nodes.find(n => n.ring === ring);
  const n1 = at(startRing + 1), n2 = at(startRing + 2);
  const first: TreeAscendancy | null = n1 ? { node: n1.name, ...resolve(n1.name, "") } : null;
  const a1 = first?.asc || asc1Hint;
  const second: TreeAscendancy | null = n2 ? { node: n2.name, ...resolve(n2.name, a1) } : null;
  if (second && second.asc === a1) { second.asc = ""; second.note = "deepens the first ascendancy"; }
  return { first, second };
}

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
              <Fragment key={l} label={l} before={b} after={a} />
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
