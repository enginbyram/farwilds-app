/**
 * Cards: what you can play on your turn, and playing them.
 * The engine knows only the action economy (one Main, one Side), limits per fight / per rest and losing
 * control in a surge. Everything a card does comes from its behaviour (mechanics/registry.ts).
 */
import { roll, diceText, type Rng } from "@/core/dice";
import { rule, SKILLS } from "../data";
import { cardBehaviour, each } from "../mechanics/registry";
import type { Behaviour, CardCtx, StrikeBoost, StrikePlan } from "../mechanics/types";
import { say, T } from "./log";
import { gainRage } from "./rage";
import { checkOver, livingFoe } from "./state";
import { ATTACK, PHYSICAL, type CombatState, type Fighter, type Owned, type PlayOptions } from "./types";

export type Slot = "active" | "side" | "misc";

/** Which drawer a card lives in. The plain weapon attack is always Main. */
export const cardSlot = (id: string): Slot =>
  id === ATTACK ? "active" : SKILLS[id]?.action === "active" ? "active" : SKILLS[id]?.action === "side" ? "side" : "misc";

/** Can this card be played right now? */
export function canPlay(s: CombatState, owned: Owned, id: string, targetKey: string): { ok: boolean; why: string } {
  const no = (why: string) => ({ ok: false, why });
  if (s.phase !== "player") return no("Not your turn");
  const slot = cardSlot(id);
  if (slot === "active" && s.used.active && s.extra.active <= 0) return no("Main action already used");
  if (slot === "side" && s.used.side && s.extra.side <= 0) return no("Side action already used");
  const def = SKILLS[id], per = def?.perFight ?? def?.uses;
  if (per !== undefined && (s.uses[id] ?? 0) >= per)
    return no(def?.perFight !== undefined ? `Used ${per}× this fight` : `Used — ready after a ${def?.recharge === "long" ? "long" : "short or long"} rest`);
  if (s.lostControl && id !== ATTACK) return no("Lost in the surge");
  if (id !== ATTACK && !owned.has(id)) return no("Not unlocked");
  const b = cardBehaviour(id);
  if (b.targeted && !livingFoe(s, targetKey)) return no("Pick a living target");
  const why = b.canPlay?.(s, owned) ?? "";
  return why ? no(why) : { ok: true, why: "" };
}

/** Plays one card from your hand. */
export function playCard(prev: CombatState, f: Fighter, owned: Owned, id: string, targetKey: string, rng: Rng, opt: PlayOptions): CombatState {
  if (!canPlay(prev, owned, id, targetKey).ok) return prev;
  const s = structuredClone(prev);
  const slot = cardSlot(id);
  if (slot === "active") { if (s.used.active) s.extra.active -= 1; else s.used.active = true; }
  else if (slot === "side") { if (s.used.side) s.extra.side -= 1; else s.used.side = true; }
  s.uses[id] = (s.uses[id] ?? 0) + 1;
  const c: CardCtx = { s, f, owned, rng, opt, id, targetKey };
  const b = cardBehaviour(id);
  if (b.play) b.play(c); else strike(c, b);
  checkOver(s, rng);
  return s;
}

/**
 * A weapon attack, shaped by the card (its name and dice) and the passives (more dice, multipliers).
 * Dice are kept as "base" (weapon, Blooded, Headlong) and "bought" with Rage (Unmake, Red Mist) for Past the Red.
 * Hit: d20 + attack bonus against the target's Defence; a natural 20 doubles the dice.
 */
function strike(c: CardCtx, b: Behaviour) {
  const { s, f, rng } = c;
  const target = s.foes.find(x => x.key === c.targetKey)!;
  const plan: StrikePlan = { name: "Weapon attack", base: [f.weapon], bought: [], spent: 0, rageAtSwing: s.rage };
  b.prepareStrike?.(c, plan);
  each(c, "strikeDice", h => h(c, plan));

  const r = roll(rng, { n: 1, d: rule("AttackDie") || 20, plus: 0 }), atk = r + f.attackBonus, crit = r === 20;
  const rolled = T("roll", `${r}+${f.attackBonus}=${atk} vs ${target.defence}`);
  if ((rule("NaturalOneMisses") && r === 1) || (!crit && atk < target.defence)) {
    say(s, "you", `${T("skill", plan.name)} at ${T("foe", target.name)} ${rolled} ${T("miss", "miss")}`);
  } else {
    const boosts: StrikeBoost[] = [];
    each(c, "strikeBoost", h => { const x = h(c, plan); if (x) boosts.push(x); });
    const times = (bought: boolean) => boosts.reduce((t, x) => t * x.times(bought), crit ? 2 : 1);
    let sum = 0; const parts: string[] = [];
    for (const [list, bought] of [[plan.base, false], [plan.bought, true]] as const) for (const x of list) {
      if (!x.n && !x.plus) continue;
      const m = times(bought), v = roll(rng, x, m); sum += v; parts.push(`${diceText({ ...x, n: x.n * m })}=${v}`);
    }
    // Armour cuts physical damage only (9.6); extra typed damage from gear and passives lands past it.
    const physical = !f.damageType || PHYSICAL.includes(f.damageType.toLowerCase());
    const armourCut = physical ? target.armour : 0;
    const main = Math.max(rule("MinDamage"), sum + f.ap - armourCut);
    const extras = Object.entries(f.extraDamage ?? {}).filter(([, v]) => v > 0);
    const dmg = main + extras.reduce((t, [, v]) => t + v, 0);
    target.hpNow -= dmg; s.stats.dealt += dmg;
    each(c, "onHit", h => h(c));
    say(s, "you", `${T("skill", plan.name)} at ${T("foe", target.name)} ${rolled} ${crit ? T("crit", "CRIT") : T("hit", "hit")}${boosts.map(x => ` ${T("skill", x.label)}`).join("")} ${parts.map(x => T("roll", x)).join(" + ")}${f.damageType ? ` ${f.damageType}` : ""} + ${T("stat", `AP ${f.ap}`)}${armourCut ? ` − ${T("stat", `Armour ${armourCut}`)}` : ""}${extras.map(([k, v]) => ` + ${T("stat", `${v} ${k}`)}`).join("")} = ${T("dmg", `${dmg} dmg`)} → ${T("stat", `${Math.max(0, target.hpNow)} HP left`)}`);
    if (dmg > 0) { s.cycle.dealt = true; gainRage(c, rule("RageOnDeal"), "dealt damage"); }
    if (target.hpNow <= 0) { say(s, "you", `${T("foe", target.name)} ${T("crit", "falls")}`); gainRage(c, rule("RageOnKill"), "kill"); }
    b.afterHit?.(c);
  }
  b.afterStrike?.(c, plan);
}
