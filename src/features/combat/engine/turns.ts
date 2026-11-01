/**
 * Turn flow. A fight runs in initiative order (highest first, clockwise round the turn wheel):
 *   rollInitiative → step … step → (your turn) playCard / playCard → endTurn → step … → next round
 *
 *  - `step` performs whoever's turn it is when that is a foe, or opens your turn and stops.
 *  - Rage decay and the surge check look back over your whole turn cycle (your turn plus the foes'
 *    turns after it) and are settled when your next turn opens.
 */
import { die, parseDice, rollN, type Rng } from "@/core/dice";
import { rule } from "../data";
import { each, first } from "../mechanics/registry";
import { divider, say, T } from "./log";
import { gainRage, spendRage } from "./rage";
import { checkOver, freshCycle } from "./state";
import { YOU, type CombatState, type Ctx, type FoeState, type Fighter, type InitRoll, type Owned } from "./types";

/** Everyone rolls initiative (d20 + DEX modifier); the order is fixed for the whole fight.
 *  Ties: a PC goes before an NPC; NPCs (or PCs) tied with each other reroll until the results differ. */
export function rollInitiative(prev: CombatState, f: Fighter, rng: Rng): CombatState {
  const s = structuredClone(prev);
  const dieSize = rule("InitiativeDie") || 20, addDex = rule("InitiativeAddsDex") ? 1 : 0;
  const you: InitRoll = { key: YOU, name: f.name, roll: die(rng, dieSize), bonus: addDex * f.initiative, total: 0, side: "you" };
  const foes: InitRoll[] = s.foes.map(x => ({ key: x.key, name: x.name, roll: die(rng, dieSize), bonus: 0, total: 0, side: "foe" }));
  const all: InitRoll[] = [you, ...foes].map(r => ({ ...r, total: r.roll + r.bonus }));
  const tied = new Map<number, InitRoll[]>();
  all.filter(r => r.side === "foe").forEach(r => tied.set(r.total, [...(tied.get(r.total) ?? []), r]));
  const rerolls: string[] = [];
  for (const group of tied.values()) {
    if (group.length < 2) continue;
    let vals: number[];
    do { vals = group.map(() => die(rng, dieSize)); } while (new Set(vals).size < vals.length);
    group.forEach((r, i) => { r.tie = vals[i]; });
    rerolls.push(group.map(r => `${T("foe", r.name)} ${T("roll", r.tie ?? 0)}`).join(" "));
  }
  all.sort((a, b) => b.total - a.total || (a.side === "you" ? -1 : b.side === "you" ? 1 : 0) || (b.tie ?? 0) - (a.tie ?? 0));
  s.order = all; s.cursor = 0; s.round = 1; s.phase = "foes";
  say(s, "sys", `Initiative: ${all.map(r => `${T(r.side, r.name)} ${T("roll", r.total)}`).join(" ")}`);
  rerolls.forEach(t => say(s, "sys", `Tie reroll: ${t}`));
  divider(s, "round", "Round 1");
  return s;
}

/** Moves the turn pointer on; wrapping past the last combatant starts a new round. */
function advance(s: CombatState) {
  s.cursor += 1;
  if (s.cursor >= s.order.length) {
    s.cursor = 0; s.round += 1;
    if (s.round <= rule("MaxTurns")) divider(s, "round", `Round ${s.round}`);
    if (s.round > rule("MaxTurns")) { s.result = "draw"; s.phase = "over"; say(s, "sys", `Still standing after ${rule("MaxTurns")} rounds — draw.`); }
  }
}

/** Opens your turn: settles the last cycle (skills looking back, Rage decay, the surge), then start-of-turn effects. */
function beginPlayerTurn(c: Ctx) {
  const { s, f } = c;
  s.phase = "player"; s.playerTurns += 1; s.used = { active: false, side: false };
  s.extra = { active: Math.max(0, (f.mainActions ?? 1) - 1), side: Math.max(0, (f.sideActions ?? 1) - 1) };
  s.guardDown = false; s.open = false; s.lostControl = false;
  const cycle = s.cycle;
  if (s.playerTurns > 1) {
    each(c, "settleCycle", h => h(c));
    if (!cycle.dealt && !cycle.took && s.rage > 0) { say(s, "you", `No blood since your last turn: ${T("fail", `−${rule("RageDecay")} Rage`)}`); spendRage(c, rule("RageDecay")); }
    settleSurge(c);
  }
  s.cycle = freshCycle();
  each(c, "startOfTurnDamage", h => h(c));
  each(c, "startOfTurn", h => h(c));
  say(s, "sys", s.lostControl ? `${T("you", "Your turn")} ${T("fail", "lost in the surge")} a plain weapon attack only` : T("you", "Your turn"));
  checkOver(s, c.rng);
}

/** Rage went past the cap since your last turn: an Endurance check, or you lose control this turn and lose Sanity. */
function settleSurge(c: Ctx) {
  const { s, f, rng } = c;
  const overflow = s.cycle.overflow, banked = s.cycle.banked;
  if (overflow <= 0) return;
  s.stats.surges += 1;
  const roll = die(rng, 20), total = roll + f.endurance, dc = rule("SurgeDC");
  const check = `${T("skill", "Surge")} ${T("rage", `${overflow} past the cap`)} ${T("roll", `Endurance ${roll}+${f.endurance}=${total} vs ${dc}`)}`;
  if (total >= dc) { say(s, "you", `${check} ${T("check", "held")}`); return; }
  const loss = first(c, "surgeLoss", h => h(c, overflow, banked)) ?? overflow;
  s.lostControl = true; s.sanityLost += loss;
  say(s, "you", `${check} ${T("fail", "failed")} you lose control this turn, ${T("dmg", `−${loss} Sanity`)}`);
}

/** One foe attacks you. */
function foeTurn(c: Ctx, foe: FoeState) {
  const { s, f, rng } = c;
  if (foe.attack <= -50) { say(s, "foe", `${T("foe", foe.name)} stands there.`); return; }   // dummies
  let armourNow = f.armour;
  each(c, "incomingArmour", h => { armourNow = h(c, armourNow); });
  const dieSize = rule("AttackDie") || 20;
  const roll = s.open ? Math.max(die(rng, dieSize), die(rng, dieSize)) : die(rng, dieSize);
  const atk = roll + foe.attack, crit = roll === 20;
  const rolled = T("roll", `${roll}+${foe.attack}=${atk} vs ${f.defence}`);
  if ((rule("NaturalOneMisses") && roll === 1) || (!crit && atk < f.defence)) { say(s, "foe", `${T("foe", foe.name)} attacks ${rolled} ${T("miss", "miss")}`); return; }
  const dd = parseDice(foe.damage);
  const dmg = Math.max(rule("MinDamage"), rollN(rng, dd.n * (crit ? 2 : 1), dd.d) + dd.plus - armourNow);
  const hitWord = crit ? T("crit", "crit") : T("hit", "hits");
  if (dmg <= 0) { say(s, "foe", `${T("foe", foe.name)} ${hitWord} but ${T("stat", `Armour ${armourNow}`)} stops it`); return; }
  s.cycle.took = true; s.cycle.struck = true; s.stats.taken += dmg;
  const held = first(c, "holdDamage", (h, name) => { const n = h(c, dmg); return n ? { n, name } : null; });
  s.held += held?.n ?? 0; s.hp -= dmg - (held?.n ?? 0);
  say(s, "foe", `${T("foe", foe.name)} ${hitWord} ${rolled} ${T("dmg", `${dmg} dmg`)}${held ? ` ${T("skill", held.name)} holds ${T("stat", held.n)} (holding ${s.held})` : ""} → ${T("stat", `${s.hp} HP`)}`);
  gainRage(c, rule("RageOnTake"), "took damage");
  each(c, "afterStruck", h => h(c, foe));
  foe.hasHitYou = true;
}

/** Performs one turn of whoever is up. On your turn it only opens it; you then play cards and end it. */
export function step(prev: CombatState, f: Fighter, owned: Owned, rng: Rng): CombatState {
  if (prev.phase !== "foes") return prev;
  const s = structuredClone(prev);
  const c: Ctx = { s, f, owned, rng };
  const cur = s.order[s.cursor];
  if (cur.key === YOU) { beginPlayerTurn(c); return s; }
  const foe = s.foes.find(x => x.key === cur.key);
  if (foe && foe.hpNow > 0) {
    foeTurn(c, foe);
    divider(s, "turn", `${foe.name}'s turn ends`);
  }
  checkOver(s, rng);
  if (!s.result) advance(s);
  return s;
}

/** Ends your turn; the foes after you in the order act next. */
export function endTurn(prev: CombatState): CombatState {
  if (prev.phase !== "player") return prev;
  const s = structuredClone(prev);
  divider(s, "turn", "Your turn ends");
  s.phase = "foes"; advance(s);
  return s;
}
