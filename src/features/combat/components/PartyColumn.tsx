/** Right third of the Combat page: you (weapon and, in Dev mode, test armour picked before the fight) and, later, allies. */
import { signed } from "@/core/format";
import type { WeaponChoice } from "@/features/equipment/model";
import type { BonusLine } from "@/features/rules/bonuses";
import type { Computed } from "@/features/rules/compute";
import type { Rules } from "@/features/rules/types";
import { RadialGauge } from "@/ui";
import { YOU, type CombatState, type Fighter } from "../engine";

export function PartyColumn({ fight, fighter, c, rules, weapons, weapon, onWeapon, armourName, onArmour, condLines, devMode, noRagePool }: {
  fight: CombatState; fighter: Fighter; c: Computed; rules: Rules;
  weapons: WeaponChoice[]; weapon: WeaponChoice; onWeapon: (key: string) => void;
  armourName: string; onArmour: (name: string) => void; condLines: BonusLine[]; devMode: boolean; noRagePool: boolean;
}) {
  const setup = fight.phase === "setup";
  const init = fight.order.find(o => o.key === YOU);
  return (
    <section className="cb__col">
      <h2 className="cb__h">Party</h2>
      <ul className="cb__list">
        <li className={`unit unit--you${fight.phase === "player" ? " unit--turn" : ""}`}>
          <div className="unit__top"><b>{fighter.name}</b>{init && <span className="unit__init" title="Initiative roll">Init {init.total}</span>}</div>
          <div className="unit__meta">{c.buildName} · level {c.level}</div>
          <div className="unit__body">
            <RadialGauge now={Math.max(0, fight.hp)} max={fighter.hpMax} kind="hp" size={50} label="HP" />
            <dl className="unit__stats">
              <dt>Defence (DEX)</dt><dd>{fighter.defence}</dd><dt>Armour</dt><dd>{fighter.armour}</dd>
              <dt>Attack</dt><dd title={condLines.map(l => `${l.source} +${l.value}`).join(", ") || undefined}>{signed(fighter.attackBonus)}</dd>
              <dt>Damage</dt><dd>{weapon.dice} {signed(fighter.ap)}{Object.entries(c.combat.extraDamage).map(([k, v]) => ` +${v} ${k}`).join("")}{weapon.damageType ? ` · ${weapon.damageType}` : ""}</dd>
            </dl>
          </div>
          <div className="unit__gear">
            <label>Weapon<select value={weapon.key} disabled={!setup} onChange={e => onWeapon(e.target.value)}>
              {weapons.map(w => <option key={w.key} value={w.key}>{w.name} · {w.dice}{w.damageType ? ` ${w.damageType}` : ""}</option>)}</select></label>
            {devMode && <label>Test armour<select value={armourName} disabled={!setup} onChange={e => onArmour(e.target.value)}>
              {rules.armour.map(a => <option key={a.name} value={a.name}>{a.name === "None" ? "None (gear only)" : `+${a.value} (${a.name})`}</option>)}</select></label>}
          </div>
        </li>
        <li className="unit unit--empty">No allies yet. Friendly characters will join here.</li>
      </ul>
      {noRagePool && <p className="note">No Rage on this character yet (take Barbarian at ring 1). Rage skills are on for testing.</p>}
    </section>
  );
}
