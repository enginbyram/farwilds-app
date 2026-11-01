/**
 * Combat screen.
 *   left third   — foes (click one to target it; add foes at the bottom)
 *   centre third — the turn wheel (initiative order, clockwise) and the combat log
 *   right third  — you and your allies
 *   bottom bar   — End turn, your HP and Rage, the Main / Side / Misc drawers, the passives tray
 * Drawers, the tray and the Dev tools float over the screen and never push anything.
 * Engine: src/combat/engine.ts. Numbers: src/data/combat.json.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Computed } from "@/rules/compute";
import { attackPower, paramGetter } from "@/rules/compute";
import type { Condition, Item, Rules } from "@/rules/types";
import { catalogItem, equippedWeapons, isWeaponItem, type WeaponChoice } from "@/model/equipment";
import type { Character } from "@/hooks/useCharacter";
import {
  ATTACK, COMBAT, DEFAULT_POLICY, SKILLS, YOU, autoTurn, canPlay, cardSlot, endTurn, newFight, parseDice, passiveState,
  playCard, rollInitiative, rule, simulate, step,
  type CombatState, type Fighter, type FoeDef, type Policy, type SimResult,
} from "@/combat/engine";
import { classStyle } from "./CharacterPage";
import { RadialGauge, signed } from "./ui";

type Drawer = "" | "active" | "side" | "misc";
const FOE_STEP_MS = 650;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();

/** Cards whose uses carry over between fights until a rest (combat.json → skills → recharge). */
const restUses = (uses: Record<string, number>) => Object.fromEntries(Object.entries(uses).filter(([id, n]) => n > 0 && SKILLS[id]?.recharge));

export function CombatPage({ rules, c, ch, equipped, condition, onFightEnd, devMode }: {
  rules: Rules; c: Computed; ch: Character; equipped: Record<string, Item>;
  condition: Condition; onFightEnd: (next: Condition) => void; devMode: boolean;
}) {
  const p = paramGetter(rules);
  const skillIds = Object.keys(SKILLS);
  const onTree = useMemo(() => new Set([...ch.owned].map(n => n.id).filter(id => id in SKILLS)), [ch.owned]);

  // ── Setup ──
  const [owned, setOwned] = useState<Set<string>>(() => new Set(onTree));
  // Weapons: what is equipped (Character page → Gear), then bare hands; Dev mode adds the test presets.
  const weapons: WeaponChoice[] = useMemo(() => [
    ...equippedWeapons(equipped),
    ...(devMode ? COMBAT.weapons.map(w => ({ key: `test:${w.name}`, name: `${w.name} (test)`, dice: w.dice, damageType: w.damageType ?? "", kind: "melee" as const, ap: w.ap, equipped: false, properties: [] })) : []),
  ], [equipped, devMode]);
  const [weaponName, setWeaponName] = useState(() => weapons[0].key);
  // Armour comes from gear and passives. Dev mode can add a test tier on top.
  const [armourName, setArmourName] = useState("None");
  const [foes, setFoes] = useState<FoeDef[]>(() => [COMBAT.foes[0], COMBAT.foes[0]].map(f => ({ ...f })));
  const [pastRedDoubles, setPastRedDoubles] = useState(false);
  const [biteSpend, setBiteSpend] = useState(4);

  const weapon = weapons.find(w => w.key === weaponName) ?? weapons[0];
  const armourWorn = devMode ? rules.armour.find(a => a.name === armourName) : undefined;
  const mods = Object.fromEntries(c.attributes.map(a => [a.key, a.mod])) as Record<string, number>;
  const skill = (n: string) => c.skills.find(s => s.name === n)?.total ?? 0;
  const hasRageSkills = [...owned].some(id => id.startsWith("bbr."));
  const flat = (k: string) => c.external.flat[k] ?? 0;
  // Conditional to-hit bonuses (Weapon Mastery…) that fit the weapon in hand.
  const offhandWeapon = isWeaponItem(catalogItem(equipped.offhand?.ref));
  const fits = (cond?: string) => cond === "two-handed" ? weapon.properties.includes("two-handed")
    : cond === "thrown" ? weapon.properties.includes("thrown")
    : cond === "ranged" ? weapon.kind === "ranged"
    : cond === "melee" ? weapon.kind === "melee"
    : cond === "offhand" ? offhandWeapon && weapon.key.startsWith("mainhand:")
    : false;
  const condLines = c.external.lines.filter(l => l.target === "attack" && l.when && fits(l.cond));
  const condAttack = condLines.reduce((t, l) => t + l.value, 0);
  const weaponAP = attackPower(rules, mods, weapon.kind, weapon.ap) + flat("ap") + flat(weapon.kind === "melee" ? "ap_melee" : "ap_ranged");
  const fighter: Fighter = {
    name: ch.name,
    hpMax: Math.max(1, Math.round(c.combat.hp)),
    mainActions: c.combat.mainActions, sideActions: c.combat.sideActions,
    level: c.level,
    hpStart: Math.max(0, Math.round(c.combat.hp) - condition.hpLost),   // the fight starts from the sheet's current HP
    defence: c.combat.defence,                     // physical attacks roll against the DEX score (1 Nov)
    armour: (armourWorn?.value ?? 0) + c.combat.armour,
    attackBonus: weaponAP + c.combat.attack + condAttack,   // attack = d20 + AP (1 Nov) + to-hit bonuses
    ap: weaponAP,
    initiative: c.combat.initiative,
    weapon: parseDice(weapon.dice),
    weaponName: weapon.name, damageType: weapon.damageType,
    extraDamage: c.combat.extraDamage,
    endurance: skill("Endurance"), intimidation: skill("Intimidation"), conMod: mods.CON ?? 0,
    sanity: Math.max(0, c.pools.sanity - condition.sanityLost),
    rageMax: c.pools.rage ?? (hasRageSkills ? p("RageMax") : 0),
  };

  // ── Fight ──
  const [fight, setFight] = useState<CombatState>(() => newFight(fighter, foes, condition.uses));
  const [targetKey, setTargetKey] = useState("foe0");
  const [drawer, setDrawer] = useState<Drawer>("");
  const [tray, setTray] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const opt = { pastRedDoublesRageDice: pastRedDoubles, biteSpend };
  const setup = fight.phase === "setup";

  // Rebuild the (unstarted) fight when foes or gear change.
  useEffect(() => { if (setup) setFight(newFight(fighter, foes, condition.uses)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [foes, weaponName, armourName, owned, setup]);
  // Foes act one by one, so the wheel can be followed.
  useEffect(() => {
    if (fight.phase !== "foes") return;
    const t = setTimeout(() => setFight(s => step(s, fighter, owned, Math.random)), fight.order[fight.cursor]?.key === YOU ? 120 : FOE_STEP_MS);
    return () => clearTimeout(t);
  });
  // Keep a living target.
  useEffect(() => {
    if (!fight.foes.some(x => x.key === targetKey && x.hpNow > 0)) {
      const next = fight.foes.find(x => x.hpNow > 0); if (next) setTargetKey(next.key);
    }
  }, [fight.foes, targetKey]);
  // Esc closes whatever floats.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setDrawer(""); setTray(false); setDevOpen(false); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  // When a fight ends, the wounds, lost Sanity and rest-limited cards go back to the sheet.
  const saved = useRef<CombatState | null>(null);
  useEffect(() => {
    if (fight.phase !== "over" || saved.current === fight) return;
    saved.current = fight;
    onFightEnd({ ...condition, hpLost: Math.max(0, fighter.hpMax - Math.max(0, fight.hp)), sanityLost: condition.sanityLost + fight.sanityLost, uses: restUses(fight.uses) });
  }, [fight]);   // eslint-disable-line react-hooks/exhaustive-deps
  const downed = (fighter.hpStart ?? 1) <= 0;

  const start = () => { setDrawer(""); setFight(rollInitiative(newFight(fighter, foes, condition.uses), fighter, Math.random)); };
  const reset = () => { setDrawer(""); setFight(newFight(fighter, foes, condition.uses)); };
  const play = (id: string) => { setFight(s => playCard(s, fighter, owned, id, targetKey, Math.random, opt)); setDrawer(""); };
  const autopilot = () => setFight(s => autoTurn(s, fighter, owned, policy, Math.random, opt));

  // ── Dev: simulator ──
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [sim, setSim] = useState<{ off: SimResult; on: SimResult } | null>(null);
  const runSim = () => setSim({
    off: simulate({ ...fighter, hpStart: undefined }, foes, owned, policy, false, 1000, 7),   // simulations start fresh
    on: simulate({ ...fighter, hpStart: undefined }, foes, owned, policy, true, 1000, 7),
  });

  const setFoe = (i: number, k: keyof FoeDef, v: string) => setFoes(fs => fs.map((f, j) => j !== i ? f : { ...f, [k]: k === "name" || k === "damage" ? v : Number(v) }));
  const toggle = (id: string) => setOwned(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Cards in each drawer: owned skills of that slot (+ the plain weapon attack under Main).
  const cards = (slot: Drawer) => [
    ...(slot === "active" ? [ATTACK] : []),
    ...skillIds.filter(id => owned.has(id) && cardSlot(id) === slot && ["active", "side", "misc"].includes(SKILLS[id].action)),
  ];
  const trayIds = skillIds.filter(id => owned.has(id) && (SKILLS[id].action === "passive" || SKILLS[id].action === "reaction"));
  const lit = passiveState(fight, owned, fighter);
  const upgraded = (id: string) => skillIds.some(u => SKILLS[u].upgrades === id && owned.has(u));
  const R = fighter.rageMax;
  const myTurn = fight.phase === "player";
  const slotLeft = (slot: "active" | "side") => myTurn && !fight.used[slot];

  return (
    <div className="cb" style={classStyle(ch.className)}>
      <div className="cb__main">
        {/* ── Foes ── */}
        <section className="cb__col">
          <h2 className="cb__h">Foes <span>{fight.foes.filter(x => x.hpNow > 0).length} standing</span></h2>
          <ul className="cb__list">
            {fight.foes.map((f, i) => {
              const dead = f.hpNow <= 0, init = fight.order.find(o => o.key === f.key);
              const isTurn = fight.order[fight.cursor]?.key === f.key && fight.phase === "foes";
              return (
                <li key={f.key} className={`unit unit--foe${targetKey === f.key && !dead ? " unit--target" : ""}${dead ? " unit--dead" : ""}${isTurn ? " unit--turn" : ""}`}
                  onClick={() => !dead && !setup && setTargetKey(f.key)}>
                  {setup ? (
                    <div className="unit__edit">
                      <input aria-label="Foe name" value={foes[i]?.name ?? ""} onChange={e => setFoe(i, "name", e.target.value)} />
                      <button className="unit__x" aria-label="Remove foe" onClick={() => setFoes(fs => fs.filter((_, j) => j !== i))} disabled={foes.length === 1}>×</button>
                      {(["hp", "defence", "armour", "attack"] as const).map(k => (
                        <label key={k}>{k === "hp" ? "HP" : k === "defence" ? "DEX" : k === "armour" ? "Arm" : "Atk"}
                          <input type="number" value={foes[i]?.[k] ?? 0} onChange={e => setFoe(i, k, e.target.value)} /></label>))}
                      <label>Dmg<input value={foes[i]?.damage ?? ""} onChange={e => setFoe(i, "damage", e.target.value)} /></label>
                    </div>
                  ) : (
                    <>
                      <div className="unit__top"><b>{f.name}</b>{init && <span className="unit__init" title="Initiative roll">Init {init.total}</span>}</div>
                      <div className="unit__body">
                        <RadialGauge now={Math.max(0, f.hpNow)} max={f.hp} kind="foe" size={50} label="HP" />
                        <div className="unit__meta">DEX {f.defence} · Arm {f.armour}<br />Atk {signed(f.attack)} · {f.damage}{f.eaten ? " · eaten" : ""}</div>
                      </div>
                      {targetKey === f.key && !dead && <span className="unit__tag">Target</span>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {setup && (
            <select className="cb__add" aria-label="Add a foe" value="" onChange={e => { const d = COMBAT.foes.find(x => x.name === e.target.value); if (d) setFoes(fs => [...fs, { ...d }]); }}>
              <option value="">+ Add a foe…</option>
              {COMBAT.foes.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          )}
          {setup && <p className="note">Foe numbers are placeholders until the bestiary exists.</p>}
        </section>

        {/* ── Turn wheel + log ── */}
        <section className="cb__col cb__centre">
          <TurnWheel fight={fight} setup={setup} />
          <Log fight={fight} />
        </section>

        {/* ── Party ── */}
        <section className="cb__col">
          <h2 className="cb__h">Party</h2>
          <ul className="cb__list">
            <li className={`unit unit--you${myTurn ? " unit--turn" : ""}`}>
              <div className="unit__top"><b>{ch.name}</b>{fight.order.find(o => o.key === YOU) && <span className="unit__init" title="Initiative roll">Init {fight.order.find(o => o.key === YOU)!.total}</span>}</div>
              <div className="unit__meta">{c.buildName} · level {c.level}</div>
              <div className="unit__body">
                <RadialGauge now={Math.max(0, fight.hp)} max={fighter.hpMax} kind="hp" size={50} label="HP" />
              <dl className="unit__stats">
                <dt>Defence (DEX)</dt><dd>{fighter.defence}</dd><dt>Armour</dt><dd>{fighter.armour}</dd>
                <dt>Attack</dt><dd title={condLines.map(l => `${l.source} +${l.value}`).join(", ") || undefined}>{signed(fighter.attackBonus)}</dd><dt>Damage</dt><dd>{weapon.dice} {signed(fighter.ap)}{Object.entries(c.combat.extraDamage).map(([k, v]) => ` +${v} ${k}`).join("")}{weapon.damageType ? ` · ${weapon.damageType}` : ""}</dd>
              </dl>
              </div>
              <div className="unit__gear">
                <label>Weapon<select value={weapon.key} disabled={!setup} onChange={e => setWeaponName(e.target.value)}>
                  {weapons.map(w => <option key={w.key} value={w.key}>{w.name} · {w.dice}{w.damageType ? ` ${w.damageType}` : ""}</option>)}</select></label>
                {devMode && <label>Test armour<select value={armourName} disabled={!setup} onChange={e => setArmourName(e.target.value)}>
                  {rules.armour.map(a => <option key={a.name} value={a.name}>{a.name === "None" ? "None (gear only)" : `+${a.value} (${a.name})`}</option>)}</select></label>}
              </div>
            </li>
            <li className="unit unit--empty">No allies yet. Friendly characters will join here.</li>
          </ul>
          {!c.pools.rage && hasRageSkills && <p className="note">No Rage on this character yet (take Barbarian at ring 1). Rage skills are on for testing.</p>}
        </section>
      </div>

      {/* ── Floating: drawer ── */}
      {drawer && (
        <div className={`cb__drawer cb__drawer--${drawer}`} role="dialog" aria-label={`${drawer} actions`}>
          <div className="cb__drawer-head">
            <h3>{drawer === "active" ? "Main actions" : drawer === "side" ? "Side actions" : "Misc actions"}</h3>
            {drawer === "side" && owned.has("bbr.bitedown1") && (
              <label className="cb__inline">Bite Down spends <input type="number" min={2} step={2} value={biteSpend} onChange={e => setBiteSpend(Number(e.target.value))} /> Rage</label>)}
            <button className="btn btn--small btn--ghost" onClick={() => setDrawer("")} aria-label="Close">×</button>
          </div>
          <div className="sq-row">
            {cards(drawer).length === 0 && <p className="note">Nothing here yet. Items, movement and other actions will live in Misc.</p>}
            {cards(drawer).map(id => {
              const v = canPlay(fight, owned, id, targetKey);
              const def = SKILLS[id];
              const target = fight.foes.find(x => x.key === targetKey);
              const title = id === ATTACK ? "Weapon attack" : def.name;
              const targeted = ["attack", "bbr.headlong1", "bbr.unmake1"].includes(id);
              return (
                <div key={id} className="sq">
                  <button className={`sq__btn sq__btn--${cardSlot(id)}${v.ok ? "" : " sq__btn--off"}`} disabled={!v.ok} onClick={() => play(id)} aria-label={title}>
                    <span className="sq__glyph">{id === ATTACK ? "At" : glyph(def.name)}</span>
                    {upgraded(id) && <i className="sq__lvl">II</i>}
                  </button>
                  <span className="sq__tip" role="tooltip">
                    <b>{title}{upgraded(id) ? " II" : ""}</b>
                    <em>{cardSlot(id) === "active" ? "Main" : cardSlot(id) === "side" ? "Side" : "Misc"}{def ? ` · ${def.pillar}` : ""}</em>
                    {id === ATTACK ? `Strike with your ${weapon.name.toLowerCase()}: ${weapon.dice}${weapon.damageType ? ` ${weapon.damageType}` : ""} ${signed(fighter.ap)} AP.` : def.text}
                    <strong className={v.ok ? "" : "off"}>{v.ok ? (targeted && target ? `Click to use on ${target.name}` : "Click to use") : v.why}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Floating: passives & reactions tray (bottom right, grows upward) ── */}
      {tray && (
        <ul className="cb__tray" aria-label="Passives and reactions">
          {trayIds.length === 0 && <li className="cb__tray-empty">No passives or reactions</li>}
          {trayIds.map(id => (
            <li key={id} className={`aura aura--${SKILLS[id].pillar.toLowerCase()}${lit[id] ? " aura--on" : ""}`} tabIndex={0}>
              <span className="aura__glyph">{glyph(SKILLS[id].name)}{upgraded(id) && <i>II</i>}</span>
              <span className="aura__tip" role="tooltip">
                <b>{SKILLS[id].name}{upgraded(id) ? " II" : ""}</b>
                <em>{SKILLS[id].action === "reaction" ? "Reaction" : "Passive"} · {SKILLS[id].pillar}{lit[id] ? " · active now" : ""}</em>
                {SKILLS[id].text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Floating: Dev tools ── */}
      {devMode && devOpen && (
        <aside className="cb__dev">
          <div className="cb__drawer-head"><h3>Dev tools</h3><button className="btn btn--small btn--ghost" onClick={() => setDevOpen(false)}>Close</button></div>
          <h4>Skills in play</h4>
          <div className="cb__row">
            <button className="btn btn--small" onClick={() => setOwned(new Set(onTree))}>Match my tree ({onTree.size})</button>
            <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set(skillIds))}>All</button>
            <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set())}>None</button>
          </div>
          <ul className="cb__skills">
            {skillIds.map(id => (
              <li key={id}><label><input type="checkbox" checked={owned.has(id)} onChange={() => toggle(id)} />{SKILLS[id].name}</label>
                <span className="mono">{SKILLS[id].action}{onTree.has(id) ? " ●" : ""}</span></li>))}
          </ul>
          <label className="cb__check"><input type="checkbox" checked={pastRedDoubles} onChange={e => setPastRedDoubles(e.target.checked)} />Past the Red also doubles dice bought with Rage</label>
          <button className="btn btn--small" onClick={autopilot} disabled={!myTurn}>Autopilot this turn</button>

          <h4>Simulate 1,000 fights</h4>
          <p className="note">The autopilot plays every turn by these rules, against the foes on the left.</p>
          <div className="cb__form">
            <label><input type="checkbox" checked={policy.headlong} onChange={e => setPolicy({ ...policy, headlong: e.target.checked })} /> Open with Headlong</label>
            <label><input type="checkbox" checked={policy.berserker} onChange={e => setPolicy({ ...policy, berserker: e.target.checked })} /> Berserker every turn</label>
            <label>Unmake at Rage <input type="number" min={0} value={policy.unmakeAt} onChange={e => setPolicy({ ...policy, unmakeAt: Number(e.target.value) })} /></label>
            <label>Bite Down under HP % <input type="number" min={0} max={100} value={policy.biteBelowPct} onChange={e => setPolicy({ ...policy, biteBelowPct: Number(e.target.value) })} /></label>
            <label>Bite Down spends <input type="number" min={2} step={2} value={policy.biteSpend} onChange={e => setPolicy({ ...policy, biteSpend: Number(e.target.value) })} /></label>
            <label>Corpse-Eater under HP % <input type="number" min={0} max={100} value={policy.corpseBelowPct} onChange={e => setPolicy({ ...policy, corpseBelowPct: Number(e.target.value) })} /></label>
          </div>
          <button className="btn btn--class" onClick={runSim}>Run</button>
          {sim && (
            <table className="cb__sim">
              <thead><tr><th /><th>Past the Red: base dice</th><th>+ Rage dice</th></tr></thead>
              <tbody>
                {([
                  ["Win rate", (r: SimResult) => pct(r.winRate)], ["Loss rate", (r: SimResult) => pct(r.lossRate)],
                  ["Rounds", (r: SimResult) => one(r.avgRounds)], ["Damage per turn", (r: SimResult) => one(r.dmgPerTurn)],
                  ["HP left after a win", (r: SimResult) => one(r.avgHpLeft)], ["Peak Rage", (r: SimResult) => one(r.avgPeakRage)],
                  ["Surges per fight", (r: SimResult) => one(r.surgesPerFight)], ["Sanity lost", (r: SimResult) => one(r.sanityPerFight)],
                  ["Fel gained", (r: SimResult) => one(r.felPerFight)],
                ] as const).map(([label, f]) => <tr key={label}><th>{label}</th><td>{f(sim.off)}</td><td>{f(sim.on)}</td></tr>)}
              </tbody>
            </table>
          )}
        </aside>
      )}

      {/* ── Result banner ── */}
      {fight.result && (
        <div className={`cb__result cb__result--${fight.result}`}>
          <b>{fight.result === "win" ? "Victory" : fight.result === "loss" ? "Defeat" : "Draw"}</b>
          <span>Round {fight.round} · {fight.stats.dealt} damage dealt · {fight.stats.taken} taken</span>
          <button className="btn btn--class" onClick={reset}>New fight</button>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <footer className="cb__bar">
        <div className="cb__bar-left">
          {setup && <button className="btn btn--class btn--big" onClick={start} disabled={!foes.length || downed}
            title={downed ? "Downed at 0 HP — take a long rest on the Character page" : undefined}>{downed ? "Downed — rest first" : "Start fight"}</button>}
          {!setup && fight.phase !== "over" && <button className="btn btn--class btn--big" onClick={() => { setDrawer(""); setFight(s => endTurn(s)); }} disabled={!myTurn}>{myTurn ? "End turn" : "Foes acting…"}</button>}
          {fight.phase === "over" && <button className="btn btn--class btn--big" onClick={reset}>New fight</button>}
          {!setup && fight.phase !== "over" && <button className="btn btn--small btn--ghost" onClick={reset} title="Abandon this fight">Reset</button>}
        </div>

        <div className="cb__me">
          <div className="cb__me-name"><b>{ch.name}</b><span>{setup ? "Ready" : myTurn ? "Your turn" : fight.phase === "foes" ? "Foes acting" : "Fight over"} · Round {fight.round || "—"}</span></div>
          <div className="gauges">
            <RadialGauge label="HP" now={Math.max(0, fight.hp)} max={fighter.hpMax} kind="hp" />
            {R > 0 && <RadialGauge label="Rage" now={fight.rage} max={R} kind="rage" marks={[rule("RageThreshold"), R]} />}
            {c.pools.quick > 0 && <RadialGauge label="Quick" now={c.pools.quick} max={c.pools.quick} kind="quick" />}
            {c.pools.purequick !== null && c.pools.purequick > 0 && <RadialGauge label="Purequick" now={c.pools.purequick} max={c.pools.purequick} kind="pq" />}
            <RadialGauge label="Sanity" now={Math.max(0, fighter.sanity - fight.sanityLost)} max={Math.max(1, fighter.sanity)} kind="sanity" />
          </div>
          <div className="cb__chips">
            {fight.held > 0 && <span className="cb-chip" title="Held Wounds: lands when Rage hits 0">Held {fight.held}</span>}
            {fight.heldQueue.length > 0 && <span className="cb-chip" title="Unbroken instalments">Queued {fight.heldQueue.join("+")}</span>}
            {fight.bank > 0 && <span className="cb-chip" title="Red Mist bank: added to your next hit">Red Mist {fight.bank}d6</span>}
            {fight.guardDown && <span className="cb-chip cb-chip--warn" title="Berserker: Armour halved">Guard down</span>}
            {fight.open && <span className="cb-chip cb-chip--warn" title="Corpse-Eater: foes attack with advantage">Open</span>}
            {fight.lostControl && <span className="cb-chip cb-chip--warn">Lost in the surge</span>}
            {fight.fel > 0 && <span className="cb-chip" title="Fel taken in">Fel {fight.fel}</span>}
            {fight.sanityLost > 0 && <span className="cb-chip" title="Sanity lost this fight">Sanity −{fight.sanityLost}</span>}
          </div>
        </div>

        <div className="cb__drawers">
          {([["active", "Main"], ["side", "Side"], ["misc", "Misc"]] as const).map(([slot, label]) => (
            <button key={slot} className={`slot${drawer === slot ? " slot--open" : ""}${slot !== "misc" && slotLeft(slot) ? " slot--ready" : ""}`}
              onClick={() => setDrawer(d => (d === slot ? "" : slot))} aria-expanded={drawer === slot}>
              <span>{label}</span>
              <small>{slot === "misc" ? `${cards("misc").length}` : !myTurn ? "—" : fight.used[slot] ? "used" : "1 left"}</small>
            </button>
          ))}
        </div>

        <div className="cb__bar-right">
          {devMode && <button className={`btn btn--small${devOpen ? " btn--dev" : ""}`} onClick={() => setDevOpen(o => !o)}>Dev tools</button>}
          <button className={`tray-btn${tray ? " tray-btn--open" : ""}`} onClick={() => setTray(t => !t)} aria-expanded={tray} title="Passives and reactions">
            <span className="tray-btn__grid">{trayIds.slice(0, 4).map(id => <i key={id} className={lit[id] ? "on" : ""} />)}</span>
            <span>{trayIds.length}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Two letters for a skill's tray symbol: "Held Wounds" → "HW", "Blooded" → "Bl". */
function glyph(name: string) {
  const w = name.replace(/\bII\b/, "").trim().split(/\s+/).filter(x => !/^(the|of|it)$/i.test(x));
  return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : w[0].slice(0, 2);
}


/** Initiative wheel: one wedge per combatant, clockwise from the top in turn order. */
function TurnWheel({ fight, setup }: { fight: CombatState; setup: boolean }) {
  const size = 300, cx = size / 2, cy = size / 2, R = 136, r = 92;
  const order = fight.order;
  const n = Math.max(1, order.length);
  const pt = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  const wedge = (i: number) => {
    const gap = n > 1 ? 0.025 : 0, a0 = (i / n) * 2 * Math.PI + gap, a1 = ((i + 1) / n) * 2 * Math.PI - gap;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    if (n === 1) return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const cur = order[fight.cursor];
  const curAngle = ((fight.cursor + 0.5) / n) * 2 * Math.PI;
  const [px, py] = pt(R + 10, curAngle);
  return (
    <div className="wheel-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="turnwheel" role="img" aria-label="Turn order">
        <circle cx={cx} cy={cy} r={R + 4} className="tw__ring" />
        <circle cx={cx} cy={cy} r={r - 4} className="tw__ring" />
        {setup && <circle cx={cx} cy={cy} r={(R + r) / 2} className="tw__idle" />}
        {order.map((o, i) => {
          const foe = fight.foes.find(x => x.key === o.key);
          const dead = !!foe && foe.hpNow <= 0;
          const mid = ((i + 0.5) / n) * 2 * Math.PI, [lx, ly] = pt((R + r) / 2, mid);
          const isCur = i === fight.cursor && !fight.result;
          return (
            <g key={o.key} className={`tw__seg tw__seg--${o.side}${dead ? " tw__seg--dead" : ""}${isCur ? " tw__seg--cur" : ""}`}>
              <path d={wedge(i)} />
              <text x={lx} y={ly - 3} textAnchor="middle" className="tw__name">{o.side === "you" ? "You" : short(o.name)}</text>
              <text x={lx} y={ly + 11} textAnchor="middle" className="tw__init">{o.total}</text>
            </g>
          );
        })}
        {!setup && cur && !fight.result && <circle cx={px} cy={py} r={5} className="tw__pointer" />}
        <text x={cx} y={cy - 6} textAnchor="middle" className="tw__round">{setup ? "Ready" : `Round ${fight.round}`}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="tw__who">
          {setup ? "Start the fight to roll initiative" : fight.result ? fight.result.toUpperCase() : cur?.side === "you" ? "Your turn" : `${cur?.name ?? ""}'s turn`}
        </text>
      </svg>
    </div>
  );
}
const short = (s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s);

/** Turns "⟦kind|text⟧" markup from the engine into coloured pills. */
function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /⟦(\w+)\|([^⟧]*)⟧/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={i++} className={`pill pill--${m[1]}`}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Log({ fight }: { fight: CombatState }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [fight.log.length]);
  return (
    <ol className="cb__log" ref={ref} aria-label="Combat log">
      {fight.log.length === 0 && <li className="log--sys">Set up the foes on the left, then press Start fight.</li>}
      {fight.log.map((l, i) => l.kind === "turn" || l.kind === "round"
        ? <li key={i} className={`log-div log-div--${l.kind}`}><span>{l.text}</span></li>
        : <li key={i} className={`log--${l.who}`}><Rich text={l.text} /></li>)}
    </ol>
  );
}
