/**
 * Character page — read-only character sheet. Points are spent only through Level Up
 * (tree node → Level Up screen) or the Creator. Dev mode turns the identity fields into inputs.
 *
 * Layout:  top bar  [ Data | Affinities | Stats (HP + pools + icons) | Hit Die | Points ]
 *          body     [ Attributes / Skills | Gear | Wealth / Equipment ]  — three equal thirds
 *          dev      [ Identity | Checks ]  (Dev mode only, under the body)
 * Colours follow the core class (CLASS_THEME in config/settings.ts).
 */
import { CLASS_THEME } from "@/config/settings";
import type { Character } from "@/hooks/useCharacter";
import type { SheetState } from "@/hooks/useSheet";
import type { Computed } from "@/rules/compute";
import type { Rules } from "@/rules/types";
import type { ShopMode } from "./EquipmentDrawer";
import { BagPanel, GearPanel, WealthPanel } from "./Inventory";
import { Badge, Hint, Icon, RadialGauge, signed } from "./ui";

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

export function CharacterPage({ rules, sh, ch, c, devMode, onCreate, onLevelUp, onShop }: {
  rules: Rules; sh: SheetState; ch: Character; c: Computed; devMode: boolean; onCreate: () => void; onLevelUp: () => void; onShop: (m: ShopMode) => void;
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

  const sp = (n: number) => signed(n);
  const subOpen = c.subdominantOpen, hasSub = !!s.subdominant && s.subdominant !== "None";
  const el = (name: string) => rules.elements.find(e => e.name === name);

  return (
    <div className="char" style={classStyle(ch.className)}>
      {/* ── Top bar: everything important at a glance, left to right ── */}
      <header className="char-top">
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
            <button className="btn btn--class" onClick={onLevelUp} disabled={c.level >= maxLevel}>Level up</button>
            <button className="btn btn--ghost btn--small" onClick={onCreate}>New character</button>
          </div>
        </section>

        <section className="ct ct--aff" aria-label="Affinities">
          <h2>Affinities</h2>
          <div className="ct__row">
            <Hint lines={[["Dominant", s.dominant], ["Sub-arts", el(s.dominant)?.subArts || "—"]]}>
              <span className={`aff aff--${s.dominant.toLowerCase()}`}><Icon name={s.dominant} size={22} /><b>{s.dominant}</b><small>dominant</small></span></Hint>
            {subOpen && hasSub ? (
              <Hint lines={[["Subdominant", s.subdominant], ["Compound arts", c.compound || "—"]]}>
                <span className={`aff aff--${s.subdominant.toLowerCase()}`}><Icon name={s.subdominant} size={22} /><b>{s.subdominant}</b><small>subdominant</small></span></Hint>
            ) : (
              <Hint lines={[subOpen ? "Open — choose it on the next Level Up" : `Opens at Ascendancy ${["", "I", "II", "III", "IV", "V"][subAsc] ?? subAsc}`]}>
                <span className="aff aff--locked"><Icon name={subOpen ? "none" : "lock"} size={22} /><b>{subOpen ? "None" : "Locked"}</b><small>subdominant</small></span></Hint>
            )}
          </div>
        </section>

        <section className="ct ct--stats" aria-label="Stats">
          <h2>Stats</h2>
          <div className="ct__row">
            <Hint lines={[`Level 1: d${core?.hitDie ?? "?"} + CON`, "Then d/2 + 1 + CON per level", `From Asc. I: d${c.hitDie}`]}>
              <RadialGauge now={c.combat.hp} max={c.combat.hp} kind="hp" size={54} label="HP" title={`Hit Points ${c.combat.hp}`} /></Hint>
            <div className="ct__pools">
              <Pool label="Quick" now={c.pools.quick} max={c.pools.quick} kind="quick" lines={["Hit Die + CON mod, +2 every 2 levels", [`Hit Die (d${c.hitDie})`, c.hitDie], ["CON mod", signed(c.attributes.find(a => a.key === "CON")?.mod ?? 0)], ["Level growth", c.pools.poolGrowth], "Refills on rest and food"]} />
              <Pool label="Sanity" now={c.pools.sanity} max={c.pools.sanity} kind="sanity" lines={["Base + Endurance + 1 per level after the first", ["Endurance", signed(c.skills.find(k => k.name === "Endurance")?.total ?? 0)]]} />
              {c.pools.purequick !== null && <Pool label="Purequick" now={c.pools.purequick} max={c.pools.purequick} kind="pq" lines={["Hit Die + WIS mod, +2 every 2 levels", [`Hit Die (d${c.hitDie})`, c.hitDie], ["WIS mod", signed(c.attributes.find(a => a.key === "WIS")?.mod ?? 0)], ["Level growth", c.pools.poolGrowth], "Refills only by prayer; rest counts as prayer (short rest half, long rest all)"]} />}
              {c.pools.rage !== null && <Pool label="Rage" now={0} max={c.pools.rage} kind="rage" lines={["Rests at 0; built by moves and damage taken", ["Cap", c.pools.rage]]} />}
              {c.pools.felLimit !== null && <Pool label="Fel" now={0} max={c.pools.felLimit} kind="fel" lines={["Rests at 0; converted from Quick", ["Fel limit", c.pools.felLimit]]} />}
            </div>
            <div className="ct__stats">
              <StatIcon icon="armour" label="AR" value={c.combat.armour} lines={["Armour — from gear & passives", "Reduces physical damage"]} />
              <StatIcon icon="defence" label="Def" value={c.combat.defence} lines={["Defence — the DEX score", "Physical attacks roll against it"]} />
              <StatIcon icon="initiative" label="Init" value={sp(c.combat.initiative)} lines={["Initiative — d20 + DEX modifier"]} />
              <StatIcon icon="speed" label="Speed" value={`${c.combat.speed} m`} lines={[race?.speed == null ? "Base speed" : `${s.race} speed`]} />
              <StatIcon icon="melee" label="AP" value={`${sp(c.combat.apMelee)} / ${sp(c.combat.apRanged)}`} lines={[["Melee", sp(c.combat.apMelee)], ["Ranged", sp(c.combat.apRanged)], "Melee: STR × (1 + weapon AP) + DEX × (0.5 + weapon AP)", "Ranged: DEX × (1 + weapon AP)"]} />
              <StatIcon icon="spell" label="SP" value={`${sp(c.combat.spWeave)} / ${sp(c.combat.spWell)} / ${sp(c.combat.spDivine)}`} lines={[["Weave (Intellect)", sp(c.combat.spWeave)], ["Well (CON)", sp(c.combat.spWell)], ["Divine (WIS)", sp(c.combat.spDivine)]]} />
              <StatIcon icon="leech" label="Leech" value={c.combat.leech} lines={["Gear & passives"]} />
            </div>
          </div>
        </section>

        <section className="ct ct--hd" aria-label="Hit Die">
          <h2>Hit Die</h2>
          <div className="ct__row">
            <Hint lines={[[`Level 1 (${ch.className})`, `d${core?.hitDie ?? "?"}`], [`From Asc. I${s.asc1 ? ` (${s.asc1})` : ""}`, `d${c.hitDie}`], "Each level after the first: d/2 + 1 + CON"]}>
              <span className="ptbox"><Icon name="die" size={24} /><b>d{c.hitDie}</b><small>per level</small></span></Hint>
          </div>
        </section>

        <section className="ct ct--points" aria-label="Points">
          <h2>Points</h2>
          <div className="ct__row">
            <Hint lines={[["Tree points", `${ch.used} spent of ${ch.total}`], "1 keystone point per level"]}>
              <span className="ptbox"><Icon name="keystone" size={22} /><b>{ch.left}</b><small>keystone</small></span></Hint>
            <Hint lines={[["Expertise points", c.expertisePoints], `From Ascendancy II – Level 1 (level ${c.levels.expertiseStart})`]}>
              <span className="ptbox"><Icon name="expertise" size={22} /><b>{c.expertisePoints}</b><small>expertise</small></span></Hint>
          </div>
        </section>
      </header>

      <div className="char__thirds">
        <div className="char__third">
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

          {/* ── Skills ── */}
          <section className="card">
            <h2>Skills</h2>
            <ul className="skilllist skilllist--compact">
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
        </div>

        <div className="char__third">
          <GearPanel sh={sh} c={c} devMode={devMode} />
        </div>

        <div className="char__third">
          <WealthPanel sh={sh} devMode={devMode} />
          <BagPanel sh={sh} devMode={devMode} onShop={onShop} />
        </div>
      </div>

      {devMode && <div className="char__dev">
        {/* ── Dev mode only: identity editing and rule checks ── */}
        <section className="card">
          <h2>Dev · identity</h2>
          <dl className="idlist">
            <Row label="Level"><input type="number" className="in in--num" style={{ width: 70 }} min={1} max={maxLevel} value={s.level}
              onChange={e => update("level", Math.max(1, Number(e.target.value) || 1))} aria-label="Level" /></Row>
            <Row label="Race"><Select label="Race" value={s.race} options={rules.races.map(r => r.name)} onChange={v => update("race", v)} /></Row>
            <Row label="Mark / power"><Select label="Mark" value={s.mark} options={rules.marks.map(m => m.name)} onChange={v => update("mark", v)} /></Row>
            <Row label="Core class"><Select label="Core class" value={ch.className} options={rules.coreClasses.map(x => x.name)} onChange={changeClass} /></Row>
            <Row label="First ascendancy"><Select label="First ascendancy" value={s.asc1} blank="— none —"
              options={rules.ascendancies.filter(a => a.coreClass === ch.className).map(a => a.name)} onChange={v => update("asc1", v)} /></Row>
            <Row label="Second ascendancy"><Select label="Second ascendancy" value={s.asc2} blank="— none —"
              options={rules.ascendancies.filter(a => a.name !== s.asc1).map(a => a.name)} onChange={v => update("asc2", v)} /></Row>
            <Row label="Dominant"><Select label="Dominant affinity" value={s.dominant} options={rules.elements.map(e => e.name)} onChange={v => update("dominant", v)} /></Row>
            <Row label="Subdominant"><Select label="Subdominant" value={s.subdominant} options={["None", ...rules.elements.map(e => e.name)]} onChange={v => update("subdominant", v)} /></Row>
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
      </div>}
    </div>
  );
}

function Pool({ label, now, max, kind, lines }: { label: string; now: number; max: number; kind: string; lines: (string | [string, string | number])[] }) {
  return <Hint lines={lines}><RadialGauge now={now} max={Math.max(1, max)} kind={kind} size={54} label={label} /></Hint>;
}

function StatIcon({ icon, label, value, lines }: { icon: string; label: string; value: string | number; lines: (string | [string, string | number])[] }) {
  return (
    <Hint lines={lines}>
      <span className="stat-ic"><Icon name={icon} /><b>{value}</b><small>{label}</small></span>
    </Hint>
  );
}
