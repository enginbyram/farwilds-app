/**
 * Combat page: your character against configurable foes, turn by turn, plus a simulator that
 * plays 1,000 fights with an autopilot. Engine: src/combat/engine.ts. Numbers: src/data/combat.json.
 */
import { useMemo, useState } from "react";
import type { Computed } from "@/rules/compute";
import { paramGetter } from "@/rules/compute";
import type { Rules } from "@/rules/types";
import type { Character } from "@/hooks/useCharacter";
import {
  COMBAT, SKILLS, DEFAULT_POLICY, autoChoice, options, parseDice, playTurn, simulate, startFight,
  type ActiveChoice, type CombatState, type Fighter, type FoeDef, type Policy, type SideChoice, type SimResult,
} from "@/combat/engine";
import { classStyle } from "./CharacterPage";
import { Hint, signed } from "./ui";

const rule = (k: string) => COMBAT.rules.find(r => r.key === k)?.value ?? 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();

export function CombatPage({ rules, c, ch }: { rules: Rules; c: Computed; ch: Character }) {
  const p = paramGetter(rules);
  const skillIds = Object.keys(SKILLS);
  const onTree = useMemo(() => new Set([...ch.owned].map(n => n.id).filter(id => id in SKILLS)), [ch.owned]);

  // ── Setup ──
  const [owned, setOwned] = useState<Set<string>>(() => new Set(onTree));
  const [weaponName, setWeaponName] = useState(COMBAT.weapons[0].name);
  const [armourName, setArmourName] = useState(() => {
    const maxOrder = Math.max(...[c.asc1Eff, c.asc2Eff].map(a => rules.armour.find(x => x.name === rules.ascendancies.find(r => r.name === a)?.maxArmour)?.order ?? 0));
    return rules.armour.find(a => a.order === maxOrder)?.name ?? "None";
  });
  const [foes, setFoes] = useState<FoeDef[]>(() => [COMBAT.foes[0], COMBAT.foes[0]].map(f => ({ ...f })));
  const [pastRedDoubles, setPastRedDoubles] = useState(false);

  const weapon = COMBAT.weapons.find(w => w.name === weaponName) ?? COMBAT.weapons[0];
  const armourWorn = rules.armour.find(a => a.name === armourName);
  const mods = Object.fromEntries(c.attributes.map(a => [a.key, a.mod])) as Record<string, number>;
  const skill = (n: string) => c.skills.find(s => s.name === n)?.total ?? 0;
  const hasRageSkills = [...owned].some(id => id.startsWith("bbr."));
  const fighter: Fighter = {
    name: ch.name,
    hpMax: Math.max(1, Math.round(c.combat.hp)),
    defence: rule("DefenceBase") + skill("Agility"),
    armour: (armourWorn?.value ?? 0) + c.combat.armour,
    attackBonus: mods.STR ?? 0,
    ap: Math.floor((mods.STR ?? 0) * (p("APMeleeSTR") + weapon.ap) + (mods.DEX ?? 0) * (p("APMeleeDEX") + weapon.ap)),
    weapon: parseDice(weapon.dice),
    endurance: skill("Endurance"), intimidation: skill("Intimidation"), conMod: mods.CON ?? 0,
    sanity: c.pools.sanity,
    rageMax: c.pools.rage ?? (hasRageSkills ? p("RageMax") : 0),
  };

  // ── Fight ──
  const [fight, setFight] = useState<CombatState>(() => startFight(fighter, foes));
  const [active, setActive] = useState<ActiveChoice>("attack");
  const [side, setSide] = useState<SideChoice>("");
  const [sideFirst, setSideFirst] = useState(true);
  const [biteSpend, setBiteSpend] = useState(4);
  const opts = options(fight, owned);
  const opt = { pastRedDoublesRageDice: pastRedDoubles };
  const reset = () => { setFight(startFight(fighter, foes)); setActive("attack"); setSide(""); };
  const play = (auto: boolean) => setFight(s => playTurn(s, fighter, owned,
    auto ? autoChoice(s, fighter, owned, policy) : { active, side, sideFirst, biteSpend }, Math.random, opt));

  // ── Simulator ──
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [sim, setSim] = useState<{ off: SimResult; on: SimResult } | null>(null);
  const runSim = () => setSim({
    off: simulate(fighter, foes, owned, policy, { pastRedDoublesRageDice: false }, 1000, 7),
    on: simulate(fighter, foes, owned, policy, { pastRedDoublesRageDice: true }, 1000, 7),
  });

  const toggle = (id: string) => setOwned(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setFoe = (i: number, k: keyof FoeDef, v: string) => setFoes(fs => fs.map((f, j) => j !== i ? f : { ...f, [k]: k === "name" || k === "damage" ? v : Number(v) }));
  const pillars = [...new Set(skillIds.map(id => SKILLS[id].pillar))];
  const name = (id: string) => (id === "attack" ? "Weapon attack" : id === "" ? "None" : SKILLS[id]?.name ?? id);
  const R = fighter.rageMax || 10;

  return (
    <div className="char combat" style={classStyle(ch.className)}>
      <div className="combat__grid">
        {/* ── Fighter ── */}
        <section className="card">
          <h2>Fighter</h2>
          <p className="title">{ch.name}</p>
          <p className="mono muted">{c.buildName} · level {c.level}</p>
          <div className="combat__form">
            <label>Weapon<select value={weaponName} onChange={e => setWeaponName(e.target.value)}>
              {COMBAT.weapons.map(w => <option key={w.name} value={w.name}>{w.name} · {w.dice}</option>)}</select></label>
            <label>Armour worn<select value={armourName} onChange={e => setArmourName(e.target.value)}>
              {rules.armour.map(a => <option key={a.name} value={a.name}>{a.name} · {a.value}</option>)}</select></label>
          </div>
          <dl className="combat__stats">
            <dt>Hit Points</dt><dd>{fighter.hpMax}</dd>
            <dt><Hint lines={[["DefenceBase", rule("DefenceBase")], ["Agility", signed(skill("Agility"))], "Proposed rule — tune in combat.json"]}>Defence</Hint></dt><dd>{fighter.defence}</dd>
            <dt>Armour</dt><dd>{fighter.armour}</dd>
            <dt><Hint lines={["d20 + STR modifier vs the foe's Defence", "Proposed rule"]}>Attack</Hint></dt><dd>{signed(fighter.attackBonus)}</dd>
            <dt>Damage</dt><dd>{weapon.dice} {signed(fighter.ap)} AP</dd>
            <dt>Endurance</dt><dd>{signed(fighter.endurance)}</dd>
            <dt>Rage cap</dt><dd>{fighter.rageMax || "—"}</dd>
          </dl>
          {!c.pools.rage && hasRageSkills && <p className="note">This character has no Rage yet (take Barbarian at ring 1). Rage skills are on for testing.</p>}
        </section>

        {/* ── Foes ── */}
        <section className="card">
          <h2>Foes</h2>
          <div className="combat__foes">
            <span>Name</span><span>HP</span><span>Def</span><span>Arm</span><span>Atk</span><span>Damage</span><span />
            {foes.map((f, i) => (
              <div className="combat__foe" key={i}>
                <input aria-label="Foe name" value={f.name} onChange={e => setFoe(i, "name", e.target.value)} />
                {(["hp", "defence", "armour", "attack"] as const).map(k => (
                  <input key={k} aria-label={k} type="number" value={f[k]} onChange={e => setFoe(i, k, e.target.value)} />))}
                <input aria-label="damage" value={f.damage} onChange={e => setFoe(i, "damage", e.target.value)} />
                <button className="btn btn--small btn--ghost" aria-label="Remove foe" onClick={() => setFoes(fs => fs.filter((_, j) => j !== i))} disabled={foes.length === 1}>×</button>
              </div>
            ))}
          </div>
          <div className="combat__row">
            <select aria-label="Add foe" value="" onChange={e => { const d = COMBAT.foes.find(x => x.name === e.target.value); if (d) setFoes(fs => [...fs, { ...d }]); }}>
              <option value="">Add a foe…</option>
              {COMBAT.foes.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
            <button className="btn btn--small" onClick={reset}>Start a new fight with these</button>
          </div>
          <p className="note">Foe numbers are placeholders until the bestiary exists.</p>
        </section>

        {/* ── Skills ── */}
        <section className="card">
          <h2>Skills in play</h2>
          <div className="combat__row">
            <button className="btn btn--small" onClick={() => setOwned(new Set(onTree))}>Match my tree ({onTree.size} ●)</button>
            <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set(skillIds))}>All</button>
            <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set())}>None</button>
          </div>
          {pillars.map(pl => (
            <div key={pl}>
              <h3>{pl}</h3>
              <ul className="combat__skills">
                {skillIds.filter(id => SKILLS[id].pillar === pl).map(id => (
                  <li key={id}>
                    <label>
                      <input type="checkbox" checked={owned.has(id)} onChange={() => toggle(id)} />
                      <Hint lines={[SKILLS[id].text]}>{SKILLS[id].name}</Hint>
                    </label>
                    <span className="mono muted" title={onTree.has(id) ? "Unlocked on your tree" : undefined}>{SKILLS[id].action}{onTree.has(id) ? " ●" : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <div className="combat__grid combat__grid--wide">
        {/* ── Fight ── */}
        <section className="card">
          <h2>Fight · turn {fight.turn}{fight.result ? ` · ${fight.result.toUpperCase()}` : ""}</h2>
          <div className="combat__bars">
            <div className="bar"><span>HP</span><div className="bar__track"><i style={{ width: `${Math.max(0, fight.hp) / fighter.hpMax * 100}%` }} /></div><b>{Math.max(0, fight.hp)} / {fighter.hpMax}</b></div>
            <div className="bar bar--rage"><span>Rage</span>
              <div className="rage">{Array.from({ length: R }, (_, i) => <i key={i} className={`${i < fight.rage ? "on" : ""}${i + 1 === rule("RageThreshold") || i + 1 === R ? " mark" : ""}`} />)}</div>
              <b>{fight.rage} / {R}</b></div>
            <p className="mono muted">Held {fight.held}{fight.heldQueue.length ? ` (+${fight.heldQueue.join(", ")} queued)` : ""} · Red Mist {fight.bank}d6 · Fel {fight.fel} · Sanity −{fight.sanityLost}{fight.lostControl ? " · LOST CONTROL next turn" : ""}</p>
            <ul className="combat__foelist">{fight.foes.map(f => <li key={f.id} className={f.hpNow <= 0 ? "dead" : ""}>{f.name}: {Math.max(0, f.hpNow)} / {f.hp}{f.eaten ? " (eaten)" : ""}</li>)}</ul>
          </div>
          <div className="combat__choices">
            <fieldset><legend>Active card</legend>
              {opts.active.map(o => <label key={o.id} className={o.ok ? "" : "off"}><input type="radio" name="active" checked={active === o.id} disabled={!o.ok} onChange={() => setActive(o.id)} />{name(o.id)}{!o.ok && o.why ? <em> — {o.why}</em> : null}</label>)}
            </fieldset>
            <fieldset><legend>Side card</legend>
              {opts.side.map(o => <label key={o.id || "none"} className={o.ok ? "" : "off"}><input type="radio" name="side" checked={side === o.id} disabled={!o.ok} onChange={() => setSide(o.id)} />{name(o.id)}{!o.ok && o.why ? <em> — {o.why}</em> : null}</label>)}
              <label><input type="checkbox" checked={sideFirst} onChange={e => setSideFirst(e.target.checked)} />Side card before Active</label>
              {owned.has("bbr.bitedown1") && <label>Bite Down spends <input type="number" min={2} step={2} value={biteSpend} onChange={e => setBiteSpend(Number(e.target.value))} /> Rage</label>}
            </fieldset>
          </div>
          <div className="combat__row">
            <button className="btn btn--class" onClick={() => play(false)} disabled={!!fight.result}>Play turn</button>
            <button className="btn" onClick={() => play(true)} disabled={!!fight.result}>Autopilot turn</button>
            <button className="btn btn--ghost" onClick={reset}>Reset fight</button>
            <label className="check"><input type="checkbox" checked={pastRedDoubles} onChange={e => setPastRedDoubles(e.target.checked)} />Past the Red doubles dice bought with Rage</label>
          </div>
          <ol className="combat__log" reversed>
            {[...fight.log].reverse().map((l, i) => <li key={i} className={`log--${l.who}`}><span className="mono">T{l.turn}</span> {l.text}</li>)}
          </ol>
        </section>

        {/* ── Simulator ── */}
        <section className="card">
          <h2>Simulate 1,000 fights</h2>
          <p className="note">The autopilot plays every turn by these rules, against the foes above.</p>
          <div className="combat__form">
            <label><input type="checkbox" checked={policy.headlong} onChange={e => setPolicy({ ...policy, headlong: e.target.checked })} /> Open with Headlong</label>
            <label><input type="checkbox" checked={policy.berserker} onChange={e => setPolicy({ ...policy, berserker: e.target.checked })} /> Berserker every turn</label>
            <label>Unmake at Rage <input type="number" min={0} max={R} value={policy.unmakeAt} onChange={e => setPolicy({ ...policy, unmakeAt: Number(e.target.value) })} /></label>
            <label>Bite Down under HP % <input type="number" min={0} max={100} value={policy.biteBelowPct} onChange={e => setPolicy({ ...policy, biteBelowPct: Number(e.target.value) })} /></label>
            <label>Bite Down spends <input type="number" min={2} step={2} value={policy.biteSpend} onChange={e => setPolicy({ ...policy, biteSpend: Number(e.target.value) })} /></label>
            <label>Corpse-Eater under HP % <input type="number" min={0} max={100} value={policy.corpseBelowPct} onChange={e => setPolicy({ ...policy, corpseBelowPct: Number(e.target.value) })} /></label>
          </div>
          <button className="btn btn--class" onClick={runSim}>Run</button>
          {sim && (
            <table className="combat__sim">
              <thead><tr><th /><th>Past the Red: base dice only</th><th>…and Rage-bought dice</th></tr></thead>
              <tbody>
                {([
                  ["Win rate", (r: SimResult) => pct(r.winRate)],
                  ["Loss rate", (r: SimResult) => pct(r.lossRate)],
                  ["Average turns", (r: SimResult) => one(r.avgTurns)],
                  ["Damage per turn", (r: SimResult) => one(r.dmgPerTurn)],
                  ["HP left after a win", (r: SimResult) => one(r.avgHpLeft)],
                  ["Peak Rage", (r: SimResult) => one(r.avgPeakRage)],
                  ["Surges per fight", (r: SimResult) => one(r.surgesPerFight)],
                  ["Sanity lost per fight", (r: SimResult) => one(r.sanityPerFight)],
                  ["Fel per fight", (r: SimResult) => one(r.felPerFight)],
                ] as const).map(([label, f]) => <tr key={label}><th>{label}</th><td>{f(sim.off)}</td><td>{f(sim.on)}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
