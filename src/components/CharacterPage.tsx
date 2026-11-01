/**
 * Character page — read-only character sheet. Points are spent only through Level Up
 * (tree node → Level Up screen) or the Creator. Dev mode turns the identity fields into inputs.
 *
 * Layout:  [ Identity (vertical) ] [ Resource pools                      ]
 *          [ + checks            ] [ Skills | Attributes | Combat stats   ]
 * Colours follow the core class (CLASS_THEME in config/settings.ts).
 */
import { CLASS_THEME } from "@/config/settings";
import type { Character } from "@/hooks/useCharacter";
import type { SheetState } from "@/hooks/useSheet";
import type { Computed } from "@/rules/compute";
import type { Rules } from "@/rules/types";
import { Badge, Hint, signed } from "./ui";

function Select({ value, options, onChange, label, blank }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string; blank?: string;
}) {
  const known = options.includes(value) || value === "";
  return (
    <select className="in" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {!known && <option value={value}>{value} (not in rules)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><dt>{label}</dt><dd>{children}</dd></>;
}

export function classStyle(coreClass: string): React.CSSProperties {
  const t = CLASS_THEME[coreClass];
  return (t ? { "--class-l": t[0], "--class-d": t[1] } : {}) as React.CSSProperties;
}

export function CharacterPage({ rules, sh, ch, c, devMode, onCreate, onLevelUp }: {
  rules: Rules; sh: SheetState; ch: Character; c: Computed; devMode: boolean; onCreate: () => void; onLevelUp: () => void;
}) {
  const { sheet: s, update } = sh;
  const failing = c.checks.filter(x => !x.ok);
  const maxLevel = rules.params.find(p => p.key === "MaxLevel")?.value ?? 45;
  const race = rules.races.find(r => r.name === s.race);
  const mark = rules.marks.find(m => m.name === s.mark);
  const core = rules.coreClasses.find(k => k.name === ch.className);
  const subAsc = rules.params.find(p => p.key === "SubdominantAscension")?.value ?? 3;

  const changeClass = (cls: string) => {
    if (cls === ch.className) return;
    if (ch.used > 0 && !window.confirm(`Changing the core class clears the ${ch.used} points spent on the tree. Continue?`)) return;
    ch.setClassName(cls);
    if (!rules.ascendancies.some(a => a.name === s.asc1 && a.coreClass === cls)) update("asc1", "");
  };

  const aptitudes = rules.aptitudes.map(a => ({ ...a, mod: c.aptitudeMods.find(m => m.name === a.name)?.mod ?? 0, rows: c.attributes.filter(x => x.aptitude === a.name) }));
  const focusOf = (key: string) => c.attributes.find(a => a.key === key)?.focus ?? "";

  return (
    <div className="char" style={classStyle(ch.className)}>
      <div className="char__layout">
        {/* ── Identity (vertical) ── */}
        <aside className="char__side">
          <section className="card char__identity">
            <input className="character__name char__name" value={ch.name} aria-label="Character name"
              onChange={e => ch.setName(e.target.value)} spellCheck={false} />
            <div className="char__buildname">{c.buildName}</div>
            <div className="mono">{c.band.writtenAs}</div>
            <div className="char__actions">
              <button className="btn btn--class" onClick={onLevelUp} disabled={c.level >= maxLevel}>Level up</button>
              <button className="btn btn--ghost btn--small" onClick={onCreate}>New character</button>
            </div>

            <h2>Identity</h2>
            <dl className="idlist">
              <Row label="Level">
                {devMode
                  ? <input type="number" className="in in--num" style={{ width: 70 }} min={1} max={maxLevel} value={s.level}
                      onChange={e => update("level", Math.max(1, Number(e.target.value) || 1))} aria-label="Level" />
                  : <b>{c.level}</b>}
                <span className="mono"> · tree {ch.used}/{ch.total} pts</span>
              </Row>
              <Row label="Race">
                {devMode ? <Select label="Race" value={s.race} options={rules.races.map(r => r.name)} onChange={v => update("race", v)} />
                  : <>{s.race} <span className="mono">{c.lineage}</span></>}
              </Row>
              <Row label="Mark / power">
                {devMode ? <Select label="Mark" value={s.mark} options={rules.marks.map(m => m.name)} onChange={v => update("mark", v)} />
                  : <>{s.mark}{mark && mark.kind !== "None" && <span className="mono"> {mark.kind}</span>}</>}
              </Row>
              <Row label="Core class">
                {devMode ? <Select label="Core class" value={ch.className} options={rules.coreClasses.map(x => x.name)} onChange={changeClass} />
                  : <>{ch.className} <span className="mono">{c.aptitude} · d{core?.hitDie ?? "?"}</span></>}
              </Row>
              <Row label="First ascendancy">
                {devMode ? <Select label="First ascendancy" value={s.asc1} blank="— none —"
                    options={rules.ascendancies.filter(a => a.coreClass === ch.className).map(a => a.name)} onChange={v => update("asc1", v)} />
                  : s.asc1 || <span className="muted">opens at level {c.levels.ascILevel}</span>}
              </Row>
              <Row label="Second ascendancy">
                {devMode ? <Select label="Second ascendancy" value={s.asc2} blank="— none —"
                    options={rules.ascendancies.filter(a => a.name !== s.asc1).map(a => a.name)} onChange={v => update("asc2", v)} />
                  : s.asc2 || <span className="muted">opens at level {c.levels.ascIILevel}</span>}
              </Row>
              {c.asc2Eff && <Row label="Combination">{c.combination ? <>{c.combination.name} <span className="mono">Root A: {c.combination.rootA}</span></> : "—"}</Row>}
              {c.cross && <Row label="Cross-aptitude">{c.cross} <span className="mono">{c.asc2Aptitude}</span></Row>}
              {c.gates.length > 0 && <Row label="Gate needed">{c.gates.join(", ")}</Row>}
              <Row label="Hit Die">d{c.hitDie}</Row>
              <Row label="Dominant affinity">
                {devMode ? <Select label="Dominant affinity" value={s.dominant} options={rules.elements.map(e => e.name)} onChange={v => update("dominant", v)} />
                  : s.dominant}
                {c.subArts && <span className="mono"> · {c.subArts}</span>}
              </Row>
              <Row label="Subdominant">
                {devMode ? <Select label="Subdominant" value={s.subdominant} options={["None", ...rules.elements.map(e => e.name)]} onChange={v => update("subdominant", v)} />
                  : c.subdominantOpen ? (s.subdominant !== "None" ? s.subdominant : "none chosen") : <span className="muted">opens at Ascendancy {["", "I", "II", "III", "IV", "V"][subAsc] ?? subAsc}</span>}
              </Row>
              {c.compound && <Row label="Compound arts">{c.compound}</Row>}
              <Row label="Well">{c.well?.tier ?? "—"}</Row>
              <Row label="Keystone points">{c.keystonePoints}</Row>
              <Row label="Expertise points">{c.expertisePoints}</Row>
            </dl>
          </section>

          <section className="card">
            <h2>Checks <span className={`pill${failing.length ? " pill--bad" : ""}`}>{failing.length ? `${failing.length} to fix` : "all pass"}</span></h2>
            <ul className="checks">
              {(failing.length ? failing : c.checks).map(k => (
                <li key={k.label} className={k.ok ? "ok" : "bad"}><span>{k.label}</span><b>{k.message}</b></li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="char__main">
          {/* ── Resource pools ── */}
          <section className="card char__pools">
            <h2>Resource pools</h2>
            <div className="pools">
              <Pool label="Quick" value={c.pools.quick} lines={[["Well", c.well?.tier ?? "—"], ["Base pool", c.well?.base ?? 0], [`Growth × ${c.level - 1} levels`, (c.well?.growth ?? 0) * (c.level - 1)], ["Ceiling", c.well?.ceiling ?? 0], ["CON bonus", Math.max(0, c.attributes.find(a => a.key === "CON")?.mod ?? 0) * (rules.params.find(p => p.key === "QuickPerCON")?.value ?? 0)]]} />
              <Pool label="Sanity" value={c.pools.sanity} lines={["Base + Endurance + 1 per level after the first", ["Endurance", signed(c.skills.find(k => k.name === "Endurance")?.total ?? 0)]]} />
              {c.pools.purequick !== null && <Pool label="Purequick" value={c.pools.purequick} lines={["(PQBase + WIS mod) × ((PQPerWIS + PQPerLevel) × (level − 1))", "Refills only by prayer"]} />}
              {c.pools.rage !== null && <Pool label="Rage (max)" value={c.pools.rage} lines={["Rests at 0; built by moves and damage taken"]} />}
              {c.pools.fel && <Pool label="Fel" value="0" lines={["Rests at 0; converted from Quick"]} />}
              {c.pools.felLimit !== null && <Pool label="Fel limit" value={c.pools.felLimit} lines={["The well itself: at this much fel, death or undeath"]} />}
            </div>
          </section>

          <div className="char__cols">
            {/* ── Skills ── */}
            <section className="card">
              <h2>Skills</h2>
              <ul className="skilllist">
                {c.skills.map(k => (
                  <li key={k.name}>
                    <span>{k.name}</span>
                    <Badge focus={focusOf(k.attribute)}>{k.attribute}</Badge>
                    <Hint className="skilllist__v" lines={[[`${k.attribute} modifier`, signed(k.mod)], ["Points spent", k.points], ["Gear & passives", signed(k.bonus)]]}>
                      <b>{signed(k.total)}</b>
                    </Hint>
                  </li>
                ))}
              </ul>
              <p className="note">Skill points {c.skillPointsUsed} / {c.skillPointsAvailable} · +{rules.params.find(p => p.key === "SkillPointsPerAscension")?.value ?? 0} per ascension</p>
            </section>

            {/* ── Attributes ── */}
            <section className="card">
              <h2>Attributes</h2>
              <table className="attrs">
                <tbody>
                  {aptitudes.map(ap => ap.rows.map((a, i) => (
                    <tr key={a.key} className={i === 0 ? "attrs__first" : ""}>
                      {i === 0 && (
                        <th rowSpan={ap.rows.length} className="attrs__apt">
                          <Hint lines={[`${ap.name} modifier: average of its attribute modifiers, rounded down`]}>
                            <span>{ap.name}</span><b>{signed(ap.mod)}</b>
                          </Hint>
                        </th>
                      )}
                      <td className="attrs__name">{a.name}</td>
                      <td><Badge focus={a.focus} title={a.focus ? `${a.focus} attribute` : undefined}>{a.key}</Badge></td>
                      <td className="attrs__score">
                        <Hint lines={[
                          ["Base", a.base],
                          [`Race (${s.race})`, signed(a.race)],
                          ...(a.mark ? [[`Mark (${s.mark})`, signed(a.mark)] as [string, string]] : []),
                          [`Class (${ch.className})`, signed(a.cls)],
                          ["Points spent", signed(a.points)],
                          ["Gear & passives", signed(a.external)],
                          ...(a.focus ? [`${a.focus}: race or class gives ${a.focus === "Main" ? 2 : 1}`] : []),
                        ]}><b>{a.score}</b></Hint>
                      </td>
                      <td><Hint lines={["(score − 10) ÷ 2, rounded down"]}><Badge focus={a.focus}>{signed(a.mod)}</Badge></Hint></td>
                    </tr>
                  )))}
                </tbody>
              </table>
              <p className="note">Attribute points {c.pointsUsed} / {c.attributePointsAvailable}</p>
            </section>

            {/* ── Combat stats ── */}
            <section className="card">
              <h2>Combat stats</h2>
              <dl className="statlist">
                <Stat label="Hit Points" value={c.combat.hp} big lines={[`Level 1: d${core?.hitDie ?? "?"} + CON`, `Then d/2 + 1 + CON per level`, `From Asc. I: d${c.hitDie}`]} />
                <Stat label="Armour" value={c.combat.armour} big lines={["Gear & passives"]} />
                <Stat label="Initiative" value={signed(c.combat.initiative)} lines={["DEX modifier"]} />
                <Stat label="Speed" value={`${c.combat.speed} m`} lines={[race?.speed === null || race?.speed === undefined ? "Base speed" : `${s.race} speed`]} />
                <Stat label="AP melee" value={signed(c.combat.apMelee)} lines={["STR mod × (1 + weapon AP)", "+ DEX mod × (0.5 + weapon AP)", "Weapon AP from gear"]} />
                <Stat label="AP ranged" value={signed(c.combat.apRanged)} lines={["DEX mod × (1 + weapon AP)", "Weapon AP from gear"]} />
                <Stat label="SP weave" value={signed(c.combat.spWeave)} lines={["Intellect modifier — arcane and darkweave spells"]} />
                <Stat label="SP well" value={signed(c.combat.spWell)} lines={["CON modifier — Quick spells"]} />
                <Stat label="SP divine" value={signed(c.combat.spDivine)} lines={["WIS modifier — divine spells and druidism"]} />
                <Stat label="Leech" value={c.combat.leech} lines={["Gear & passives"]} />
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pool({ label, value, lines }: { label: string; value: string | number; lines: (string | [string, string | number])[] }) {
  return <div className="pool"><Hint lines={lines}><b>{value}</b></Hint><span>{label}</span></div>;
}

function Stat({ label, value, big, lines }: { label: string; value: string | number; big?: boolean; lines: string[] }) {
  return (
    <div className={`statlist__row${big ? " statlist__row--big" : ""}`}>
      <dt>{label}</dt>
      <dd><Hint lines={lines}><b>{value}</b></Hint></dd>
    </div>
  );
}
