/** Dev tools (Dev mode, floating): which skills are in play, Past the Red's option, autopilot, and the 1,000-fight simulator. */
import { useState } from "react";
import { oneDecimal, pct } from "@/core/format";
import { toggled } from "@/core/objects";
import { DEFAULT_POLICY, SKILL_IDS, SKILLS, simulate, type FoeDef, type Fighter, type Owned, type PlayOptions, type Policy, type SimResult } from "../engine";

const SIM_ROWS: [string, (r: SimResult) => string][] = [
  ["Win rate", r => pct(r.winRate)], ["Loss rate", r => pct(r.lossRate)],
  ["Rounds", r => oneDecimal(r.avgRounds)], ["Damage per turn", r => oneDecimal(r.dmgPerTurn)],
  ["HP left after a win", r => oneDecimal(r.avgHpLeft)], ["Peak Rage", r => oneDecimal(r.avgPeakRage)],
  ["Surges per fight", r => oneDecimal(r.surgesPerFight)], ["Sanity lost", r => oneDecimal(r.sanityPerFight)],
  ["Fel gained", r => oneDecimal(r.felPerFight)],
];

/** Autopilot rules shown as inputs: [field, label, kind, min, max, step]. */
const POLICY_FIELDS: { key: keyof Policy; label: string; check?: boolean; min?: number; max?: number; step?: number }[] = [
  { key: "headlong", label: "Open with Headlong", check: true },
  { key: "berserker", label: "Berserker every turn", check: true },
  { key: "unmakeAt", label: "Unmake at Rage", min: 0 },
  { key: "biteBelowPct", label: "Bite Down under HP %", min: 0, max: 100 },
  { key: "biteSpend", label: "Bite Down spends", min: 2, step: 2 },
  { key: "corpseBelowPct", label: "Corpse-Eater under HP %", min: 0, max: 100 },
];

export function DevTools({ owned, setOwned, onTree, opt, setOpt, myTurn, fighter, foes, onAutopilot, onClose }: {
  owned: Owned; setOwned: (o: Owned) => void; onTree: Owned; opt: PlayOptions; setOpt: (o: PlayOptions) => void;
  myTurn: boolean; fighter: Fighter; foes: FoeDef[]; onAutopilot: (p: Policy) => void; onClose: () => void;
}) {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [sim, setSim] = useState<{ off: SimResult; on: SimResult } | null>(null);
  const runSim = () => setSim({
    off: simulate({ ...fighter, hpStart: undefined }, foes, owned, policy, false, 1000, 7),   // simulations start fresh
    on: simulate({ ...fighter, hpStart: undefined }, foes, owned, policy, true, 1000, 7),
  });
  return (
    <aside className="cb__dev">
      <div className="cb__drawer-head"><h3>Dev tools</h3><button className="btn btn--small btn--ghost" onClick={onClose}>Close</button></div>
      <h4>Skills in play</h4>
      <div className="cb__row">
        <button className="btn btn--small" onClick={() => setOwned(new Set(onTree))}>Match my tree ({onTree.size})</button>
        <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set(SKILL_IDS))}>All</button>
        <button className="btn btn--small btn--ghost" onClick={() => setOwned(new Set())}>None</button>
      </div>
      <ul className="cb__skills">
        {SKILL_IDS.map(id => (
          <li key={id}><label><input type="checkbox" checked={owned.has(id)} onChange={() => setOwned(toggled(owned, id))} />{SKILLS[id].name}</label>
            <span className="mono">{SKILLS[id].action}{onTree.has(id) ? " ●" : ""}</span></li>))}
      </ul>
      <label className="cb__check"><input type="checkbox" checked={opt.pastRedDoublesRageDice} onChange={e => setOpt({ ...opt, pastRedDoublesRageDice: e.target.checked })} />Past the Red also doubles dice bought with Rage</label>
      <button className="btn btn--small" onClick={() => onAutopilot(policy)} disabled={!myTurn}>Autopilot this turn</button>

      <h4>Simulate 1,000 fights</h4>
      <p className="note">The autopilot plays every turn by these rules, against the foes on the left.</p>
      <div className="cb__form">
        {POLICY_FIELDS.map(x => x.check
          ? <label key={x.key}><input type="checkbox" checked={policy[x.key] as boolean} onChange={e => setPolicy({ ...policy, [x.key]: e.target.checked })} /> {x.label}</label>
          : <label key={x.key}>{x.label} <input type="number" min={x.min} max={x.max} step={x.step} value={policy[x.key] as number} onChange={e => setPolicy({ ...policy, [x.key]: Number(e.target.value) })} /></label>)}
      </div>
      <button className="btn btn--class" onClick={runSim}>Run</button>
      {sim && (
        <table className="cb__sim">
          <thead><tr><th /><th>Past the Red: base dice</th><th>+ Rage dice</th></tr></thead>
          <tbody>{SIM_ROWS.map(([label, f]) => <tr key={label}><th>{label}</th><td>{f(sim.off)}</td><td>{f(sim.on)}</td></tr>)}</tbody>
        </table>
      )}
    </aside>
  );
}
