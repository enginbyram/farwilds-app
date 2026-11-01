/** Top bar, middle: HP and pools as gauges, combat stats as icons, and the rest buttons. */
import { signed } from "@/core/format";
import { SKILLS } from "@/features/combat/data";
import { linesFor } from "@/features/rules/bonuses";
import { longRest, shortRest } from "@/features/rules/rest";
import { Hint, HintGauge, RadialGauge, StatIcon, type HintLine } from "@/ui";
import { bonusLinesOrNone } from "../bonusLines";
import type { SheetProps } from "../types";

export function StatsSection({ rules, sh, ch, c, onMessage }: SheetProps & { onMessage?: (m: string) => void }) {
  const { sheet: s, update } = sh;
  const cond = s.condition;   // what is used up since the last rest (rules/rest.ts)
  const ext = c.external;
  const core = rules.coreClasses.find(k => k.name === ch.className);
  const race = rules.races.find(r => r.name === s.race);
  const hpNow = Math.max(0, c.combat.hp - cond.hpLost);
  const mod = (key: string) => signed(c.attributes.find(a => a.key === key)?.mod ?? 0);
  const sp = signed;
  const usedLines: HintLine[] = Object.entries(cond.uses).map(([id, n]) => [`Used: ${SKILLS[id]?.name ?? id}`, `${n}×`]);
  const doLong = () => { update("condition", longRest(cond)); onMessage?.(`${ch.name} took a long rest.`); };
  const doShort = () => { update("condition", shortRest(cond, c.pools.purequick)); onMessage?.(`${ch.name} took a short rest.`); };

  return (
    <section className="ct ct--stats" aria-label="Stats">
      <h2>Stats</h2>
      <div className="ct__row">
        <Hint lines={[`Level 1: d${core?.hitDie ?? "?"} + CON`, "Then d/2 + 1 + CON per level", `From Asc. I: d${c.hitDie}`, ...linesFor(ext, "hp"), ["Now", `${hpNow} of ${c.combat.hp}`]]}>
          <RadialGauge now={hpNow} max={c.combat.hp} kind="hp" size={54} label="HP" title={`Hit Points ${hpNow} of ${c.combat.hp}`} /></Hint>
        <div className="ct__pools">
          <HintGauge label="Quick" now={Math.max(0, c.pools.quick - cond.quickSpent)} max={c.pools.quick} kind="quick" lines={["Hit Die + CON mod, +2 every 2 levels", [`Hit Die (d${c.hitDie})`, c.hitDie], ["CON mod", mod("CON")], ["Level growth", c.pools.poolGrowth], "Refills on rest and food"]} />
          <HintGauge label="Sanity" now={Math.max(0, c.pools.sanity - cond.sanityLost)} max={c.pools.sanity} kind="sanity" lines={["Base + Endurance + 1 per level after the first", ["Endurance", signed(c.skills.find(k => k.name === "Endurance")?.total ?? 0)]]} />
          {c.pools.purequick !== null && <HintGauge label="Purequick" now={Math.max(0, c.pools.purequick - cond.purequickSpent)} max={c.pools.purequick} kind="pq" lines={["Hit Die + WIS mod, +2 every 2 levels", [`Hit Die (d${c.hitDie})`, c.hitDie], ["WIS mod", mod("WIS")], ["Level growth", c.pools.poolGrowth], "Refills only by prayer; rest counts as prayer (short rest half, long rest all)"]} />}
          {c.pools.rage !== null && <HintGauge label="Rage" now={0} max={c.pools.rage} kind="rage" lines={["Rests at 0; built by moves and damage taken", ["Cap", c.pools.rage]]} />}
          {c.pools.felLimit !== null && <HintGauge label="Fel" now={0} max={c.pools.felLimit} kind="fel" lines={["Rests at 0; converted from Quick", ["Fel limit", c.pools.felLimit]]} />}
        </div>
        <div className="ct__stats">
          <StatIcon icon="armour" label="AR" value={c.combat.armour} lines={["Armour — reduces physical damage", ...bonusLinesOrNone(ext, "armour")]} />
          <StatIcon icon="defence" label="Def" value={c.combat.defence} lines={["Defence — the DEX score", "Physical attacks roll against it"]} />
          <StatIcon icon="initiative" label="Init" value={sp(c.combat.initiative)} lines={["Initiative — d20 + DEX modifier", ...linesFor(ext, "initiative")]} />
          <StatIcon icon="speed" label="Speed" value={`${c.combat.speed} m`} lines={[race?.speed == null ? "Base speed" : `${s.race} speed`, ...linesFor(ext, "speed")]} />
          <StatIcon icon="melee" label="AP" value={`${sp(c.combat.apMelee)} / ${sp(c.combat.apRanged)}`} lines={[["Melee", sp(c.combat.apMelee)], ["Ranged", sp(c.combat.apRanged)], "Melee: STR × (1 + weapon AP) + DEX × (0.5 + weapon AP)", "Ranged: DEX × (1 + weapon AP)", ...linesFor(ext, "weapon_ap_melee", "weapon_ap_ranged", "ap", "ap_melee", "ap_ranged")]} />
          <StatIcon icon="spell" label="SP" value={`${sp(c.combat.spWeave)} / ${sp(c.combat.spWell)} / ${sp(c.combat.spDivine)}`} lines={[["Weave (Intellect)", sp(c.combat.spWeave)], ["Well (CON)", sp(c.combat.spWell)], ["Divine (WIS)", sp(c.combat.spDivine)], ...linesFor(ext, "sp")]} />
          <StatIcon icon="leech" label="Leech" value={c.combat.leech} lines={["Leech — returns health from damage and healing", ...bonusLinesOrNone(ext, "leech")]} />
        </div>
        <div className="ct__rest" aria-label="Rest">
          <Hint lines={["Long rest — 8 hours, once per 24 hours", "All Hit Points, Quick and Purequick return", "Cards that recharge on a rest are ready again", ...usedLines]}>
            <button type="button" className="btn btn--rest" onClick={doLong}>Long rest</button></Hint>
          <Hint lines={["Short rest — 1 hour", "Purequick refills by half (rest counts as prayer)", "Cards that recharge on a short rest are ready again", "HP and Quick return through food, not rest", ...usedLines]}>
            <button type="button" className="btn btn--rest btn--rest-short" onClick={doShort}>Short rest</button></Hint>
        </div>
      </div>
    </section>
  );
}
