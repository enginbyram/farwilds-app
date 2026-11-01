/**
 * Combat engine — pure functions, no UI.
 *
 * A fight runs in initiative order (highest first, clockwise round the turn wheel):
 *   rollInitiative → step … step → (your turn) playCard / playCard → endTurn → step … → next round
 *
 *  - `step` performs whoever's turn it is when that is a foe, or opens your turn and stops.
 *  - On your turn you may play one Main (active) card and one Side card, in any order, then End turn.
 *  - Rage decay and the surge check look back over your whole turn cycle (your turn plus the foes'
 *    turns after it) and are settled when your next turn opens.
 *
 * Numbers live in src/data/combat.json (rules + skills); character stats come from the Character page.
 * Change a NUMBER in the JSON; change HOW something works here.
 */
import raw from "@/data/combat.json";

// ── Data ─────────────────────────────────────────────────────

export type Action = "active" | "side" | "misc" | "passive" | "reaction" | "upgrade";
export interface SkillDef {
  name: string; action: Action; pillar: string; text: string; upgrades?: string;
  rage?: number; rageIfStruck?: number; impactDice?: string; dicePer2Rage?: string; atRage?: number;
  bonusDice?: string; extraRagePerHit?: number; armourFactor?: number; bankDice?: string; bankMax?: number;
  minFoes?: number; healPer2Rage?: string; cost?: number; conMultiplier?: number; heal?: string; fel?: number; turns?: number;
}
export interface WeaponDef { name: string; dice: string; ap: number; note?: string; }
export interface FoeDef { name: string; hp: number; defence: number; armour: number; attack: number; damage: string; composure: number; note?: string; }
export interface RuleRow { key: string; value: number; status: string; note: string; }

type Data = { rules: RuleRow[]; skills: Record<string, SkillDef>; weapons: WeaponDef[]; foes: FoeDef[] };
export const COMBAT = raw as unknown as Data;
export const SKILLS = COMBAT.skills;
export const rule = (k: string) => COMBAT.rules.find(r => r.key === k)?.value ?? 0;

// ── Dice ─────────────────────────────────────────────────────

/** "2d6+1" → { n: 2, d: 6, plus: 1 }. "" or "0" → nothing. */
export interface Dice { n: number; d: number; plus: number; }
export function parseDice(s: string | undefined): Dice {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(s ?? "");
  if (!m) { const flat = Number(s); return { n: 0, d: 0, plus: Number.isFinite(flat) ? flat : 0 }; }
  return { n: m[1] ? Number(m[1]) : 1, d: Number(m[2]), plus: m[3] ? Number(m[3].replace(/\s/g, "")) : 0 };
}

export type Rng = () => number;
/** Seeded random numbers (mulberry32), so a simulation can be repeated exactly. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const die = (rng: Rng, d: number) => 1 + Math.floor(rng() * d);
const rollN = (rng: Rng, n: number, d: number) => { let t = 0; for (let i = 0; i < n; i++) t += die(rng, d); return t; };
const d20 = (rng: Rng, mode: "adv" | "" = "") => {
  const a = die(rng, rule("AttackDie") || 20); if (!mode) return a;
  return Math.max(a, die(rng, rule("AttackDie") || 20));
};

// ── Setup ────────────────────────────────────────────────────

/** Everything the fight needs from the character sheet plus the chosen gear. */
export interface Fighter {
  name: string; hpMax: number; defence: number; armour: number; attackBonus: number; ap: number; initiative: number;
  weapon: Dice; endurance: number; intimidation: number; conMod: number; sanity: number; rageMax: number;
}
/** Which skills the fighter has: node ids from the tree (or Dev mode's test toggles). */
export type Owned = Set<string>;

/** The effective value of a skill field, taking upgrades (Level 2 nodes) into account. */
function eff<K extends keyof SkillDef>(owned: Owned, id: string, key: K): SkillDef[K] | undefined {
  if (!owned.has(id)) return undefined;
  let v = SKILLS[id]?.[key];
  for (const [uid, s] of Object.entries(SKILLS)) if (s.upgrades === id && owned.has(uid) && s[key] !== undefined) v = s[key];
  return v;
}

export interface FoeState extends FoeDef { id: number; key: string; hpNow: number; hasHitYou: boolean; eaten: boolean; }
export interface InitRoll { key: string; name: string; roll: number; bonus: number; total: number; side: "you" | "foe"; }
export interface LogLine { round: number; who: "you" | "foe" | "sys"; text: string; }
export type Phase = "setup" | "player" | "foes" | "over";

export interface CombatState {
  phase: Phase; round: number; order: InitRoll[]; cursor: number; playerTurns: number;
  used: { active: boolean; side: boolean };
  hp: number; rage: number; held: number; heldQueue: number[]; bank: number;
  guardDown: boolean;   // Berserker until your next turn
  open: boolean;        // Corpse-Eater: foes attack with advantage until your next turn
  lostControl: boolean; // failed surge: this turn only a weapon attack, no Side card
  fel: number; sanityLost: number; foes: FoeState[];
  cycle: { dealt: boolean; took: boolean; overflow: number; banked: number; charged: boolean; struck: boolean };
  log: LogLine[]; result: "" | "win" | "loss" | "draw";
  stats: { dealt: number; taken: number; peakRage: number; surges: number };
}

export const YOU = "you";

export function newFight(f: Fighter, foes: FoeDef[]): CombatState {
  return {
    phase: "setup", round: 0, order: [], cursor: 0, playerTurns: 0, used: { active: false, side: false },
    hp: f.hpMax, rage: 0, held: 0, heldQueue: [], bank: 0, guardDown: false, open: false, lostControl: false,
    fel: 0, sanityLost: 0,
    foes: foes.map((x, i) => {
      const same = foes.filter(y => y.name === x.name);   // "Bandit 1", "Bandit 2" when names repeat
      const name = same.length > 1 ? `${x.name} ${foes.slice(0, i + 1).filter(y => y.name === x.name).length}` : x.name;
      return { ...x, name, id: i, key: `foe${i}`, hpNow: x.hp, hasHitYou: false, eaten: false };
    }),
    cycle: { dealt: false, took: false, overflow: 0, banked: 0, charged: false, struck: false },
    log: [], result: "", stats: { dealt: 0, taken: 0, peakRage: 0, surges: 0 },
  };
}

/** Everyone rolls initiative; the order is fixed for the whole fight (ties go to you). */
export function rollInitiative(prev: CombatState, f: Fighter, rng: Rng): CombatState {
  const s = structuredClone(prev);
  const dieSize = rule("InitiativeDie") || 20, addDex = rule("InitiativeAddsDex") ? 1 : 0;
  const you: InitRoll = { key: YOU, name: f.name, roll: die(rng, dieSize), bonus: addDex * f.initiative, total: 0, side: "you" };
  const foes: InitRoll[] = s.foes.map(x => ({ key: x.key, name: x.name, roll: die(rng, dieSize), bonus: 0, total: 0, side: "foe" }));
  const all = [you, ...foes].map(r => ({ ...r, total: r.roll + r.bonus }));
  all.sort((a, b) => b.total - a.total || (a.side === "you" ? -1 : b.side === "you" ? 1 : 0));
  s.order = all; s.cursor = 0; s.round = 1; s.phase = "foes";
  s.log.push({ round: 1, who: "sys", text: `Initiative: ${all.map(r => `${r.name} ${r.total}`).join(", ")}.` });
  return s;
}

// ── Helpers that change the state in place (only ever on a fresh clone) ──

const say = (s: CombatState, who: LogLine["who"], text: string) => s.log.push({ round: s.round, who, text });
const aliveFoes = (s: CombatState) => s.foes.filter(x => x.hpNow > 0);

function gainRage(s: CombatState, f: Fighter, owned: Owned, n: number, why: string) {
  if (n <= 0 || f.rageMax <= 0) return;
  const before = s.rage;
  s.rage = Math.min(f.rageMax, s.rage + n);
  const over = before + n - f.rageMax;
  say(s, "you", `+${n} Rage (${why}) → ${s.rage}`);
  if (over > 0) {
    s.cycle.overflow += over;   // checked once, when your next turn opens
    if (owned.has("bbr.redmist2")) {
      const max = SKILLS["bbr.redmist2"].bankMax ?? 3;
      const banked = Math.min(over, max - s.bank); s.bank += banked; s.cycle.banked += banked;
      if (banked > 0) say(s, "you", `Red Mist banks ${banked} → ${s.bank}d6 on your next hit`);
    }
  }
  s.stats.peakRage = Math.max(s.stats.peakRage, s.rage);
}

function releaseHeld(s: CombatState, f: Fighter, owned: Owned, rng: Rng) {
  if (s.held <= 0) return;
  if (owned.has("bbr.unbroken")) {
    const roll = die(rng, 20), total = roll + f.endurance, dc = rule("UnbrokenDC");
    if (total >= dc) {
      const n = SKILLS["bbr.unbroken"].turns ?? 3, part = Math.ceil(s.held / n);
      s.heldQueue.push(...Array.from({ length: n }, (_, i) => Math.min(part, s.held - part * i)).filter(x => x > 0));
      say(s, "you", `Unbroken: Endurance ${total} vs ${dc} — ${s.held} held damage lands over ${n} turns.`);
      s.held = 0; return;
    }
    say(s, "you", `Unbroken: Endurance ${total} vs ${dc} — failed.`);
  }
  s.hp -= s.held; say(s, "you", `Rage hits 0: ${s.held} held damage lands at once → ${s.hp} HP`);
  s.held = 0;
}

function spendRage(s: CombatState, f: Fighter, owned: Owned, rng: Rng, n: number) {
  const was = s.rage; s.rage = Math.max(0, s.rage - n);
  if (was > 0 && s.rage === 0) releaseHeld(s, f, owned, rng);
}

function checkOver(s: CombatState) {
  if (s.result) return;
  if (s.hp <= 0) { s.result = "loss"; s.phase = "over"; say(s, "sys", `You fall in round ${s.round}.`); }
  else if (!aliveFoes(s).length) { s.result = "win"; s.phase = "over"; say(s, "sys", `Victory in round ${s.round}.`); }
}

// ── Turn flow ────────────────────────────────────────────────

/** Moves the turn pointer on; wrapping past the last combatant starts a new round. */
function advance(s: CombatState) {
  s.cursor += 1;
  if (s.cursor >= s.order.length) {
    s.cursor = 0; s.round += 1;
    if (s.round > rule("MaxTurns")) { s.result = "draw"; s.phase = "over"; say(s, "sys", `Still standing after ${rule("MaxTurns")} rounds — draw.`); }
  }
}

/** Opens your turn: settles the last cycle (decay, surge, Headlong), then start-of-turn effects. */
function beginPlayerTurn(s: CombatState, f: Fighter, owned: Owned, rng: Rng) {
  s.phase = "player"; s.playerTurns += 1; s.used = { active: false, side: false };
  s.guardDown = false; s.open = false; s.lostControl = false;
  const c = s.cycle;
  if (s.playerTurns > 1) {
    if (c.charged && c.struck) gainRage(s, f, owned, SKILLS["bbr.headlong1"]?.rageIfStruck ?? 1, "struck during the charge");
    if (!c.dealt && !c.took && s.rage > 0) { say(s, "you", `No blood since your last turn: −${rule("RageDecay")} Rage.`); spendRage(s, f, owned, rng, rule("RageDecay")); }
    const overflow = s.cycle.overflow, banked = s.cycle.banked;
    if (overflow > 0) {
      s.stats.surges += 1;
      const roll = die(rng, 20), total = roll + f.endurance, dc = rule("SurgeDC");
      if (total >= dc) say(s, "you", `Surge: ${overflow} Rage past the cap. Endurance ${roll}+${f.endurance}=${total} vs ${dc} — held.`);
      else {
        const loss = owned.has("bbr.redmist2") ? Math.max(1, banked) : overflow;
        s.lostControl = true; s.sanityLost += loss;
        say(s, "you", `Surge: ${overflow} Rage past the cap. Endurance ${roll}+${f.endurance}=${total} vs ${dc} — FAILED: you lose control this turn, −${loss} Sanity.`);
      }
    }
  }
  s.cycle = { dealt: false, took: false, overflow: 0, banked: 0, charged: false, struck: false };
  if (s.heldQueue.length) { const part = s.heldQueue.shift()!; s.hp -= part; say(s, "you", `Unbroken: ${part} held damage lands → ${s.hp} HP`); }
  if (owned.has("bbr.thickit1") && s.playerTurns > 1 && aliveFoes(s).length >= (SKILLS["bbr.thickit1"].minFoes ?? 2))
    gainRage(s, f, owned, SKILLS["bbr.thickit1"].rage ?? 1, "Thick of It");
  say(s, "sys", s.lostControl ? "Your turn — lost in the surge: a plain weapon attack only." : "Your turn.");
  checkOver(s);
}

function foeTurn(s: CombatState, f: Fighter, owned: Owned, foe: FoeState, rng: Rng) {
  if (foe.attack <= -50) { say(s, "foe", `The ${foe.name} stands there.`); return; }   // dummies
  const armourNow = s.guardDown ? Math.floor(f.armour * (eff(owned, "bbr.berserker1", "armourFactor") ?? 0.5)) : f.armour;
  const roll = d20(rng, s.open ? "adv" : ""), atk = roll + foe.attack, crit = roll === 20;
  if ((rule("NaturalOneMisses") && roll === 1) || (!crit && atk < f.defence)) { say(s, "foe", `The ${foe.name} attacks: ${atk} vs Defence ${f.defence} — miss.`); return; }
  const dd = parseDice(foe.damage);
  const dmg = Math.max(rule("MinDamage"), rollN(rng, dd.n * (crit ? 2 : 1), dd.d) + dd.plus - armourNow);
  if (dmg <= 0) { say(s, "foe", `The ${foe.name} hits${crit ? " (crit)" : ""} but Armour ${armourNow} stops it.`); return; }
  s.cycle.took = true; s.cycle.struck = true; s.stats.taken += dmg;
  let held = 0;
  if (owned.has("bbr.hw1") && s.rage > 0) held = Math.min(dmg, Math.max(0, f.conMod) * (SKILLS["bbr.hw1"].conMultiplier ?? 2));
  s.held += held; s.hp -= dmg - held;
  say(s, "foe", `The ${foe.name} hits${crit ? " (crit)" : ""}: ${dmg} damage${held ? `, ${held} held back (holding ${s.held})` : ""} → ${s.hp} HP`);
  gainRage(s, f, owned, rule("RageOnTake"), "took damage");
  if (s.guardDown) gainRage(s, f, owned, eff(owned, "bbr.berserker1", "extraRagePerHit") ?? 0, "Berserker");
  if (!foe.hasHitYou && owned.has("bbr.grudge1")) gainRage(s, f, owned, eff(owned, "bbr.grudge1", "rage") ?? 1, `Grudge vs the ${foe.name}`);
  foe.hasHitYou = true;
}

/** Performs one turn of whoever is up. On your turn it only opens it; you then play cards and end it. */
export function step(prev: CombatState, f: Fighter, owned: Owned, rng: Rng): CombatState {
  if (prev.phase !== "foes") return prev;
  const s = structuredClone(prev);
  const cur = s.order[s.cursor];
  if (cur.key === YOU) { beginPlayerTurn(s, f, owned, rng); return s; }
  const foe = s.foes.find(x => x.key === cur.key);
  if (foe && foe.hpNow > 0) foeTurn(s, f, owned, foe, rng);
  checkOver(s);
  if (!s.result) advance(s);
  return s;
}

/** Ends your turn; the foes after you in the order act next. */
export function endTurn(prev: CombatState): CombatState {
  if (prev.phase !== "player") return prev;
  const s = structuredClone(prev);
  say(s, "sys", "You end your turn.");
  s.phase = "foes"; advance(s);
  return s;
}

// ── Cards ────────────────────────────────────────────────────

/** Every card that can appear in the drawers. "attack" is the plain weapon attack, always available. */
export const ATTACK = "attack";
export const cardSlot = (id: string): "active" | "side" | "misc" =>
  id === ATTACK ? "active" : SKILLS[id]?.action === "active" ? "active" : SKILLS[id]?.action === "side" ? "side" : "misc";

/** Can this card be played right now? */
export function canPlay(s: CombatState, owned: Owned, id: string, targetKey: string): { ok: boolean; why: string } {
  if (s.phase !== "player") return { ok: false, why: "Not your turn" };
  const slot = cardSlot(id);
  if (slot === "active" && s.used.active) return { ok: false, why: "Main action already used" };
  if (slot === "side" && s.used.side) return { ok: false, why: "Side action already used" };
  if (s.lostControl && id !== ATTACK) return { ok: false, why: "Lost in the surge" };
  if (id !== ATTACK && !owned.has(id)) return { ok: false, why: "Not unlocked" };
  const target = s.foes.find(x => x.key === targetKey && x.hpNow > 0);
  if ((id === ATTACK || id === "bbr.headlong1" || id === "bbr.unmake1") && !target) return { ok: false, why: "Pick a living target" };
  if (id === "bbr.headlong1" && s.playerTurns > 1) return { ok: false, why: "Only on your first turn" };
  if (id === "bbr.unmake1" && s.rage < 2) return { ok: false, why: "Needs 2 Rage" };
  if (id === "bbr.bitedown1" && s.rage < 2) return { ok: false, why: "Needs 2 Rage" };
  if (id === "bbr.dti1" && s.rage < (SKILLS["bbr.dti1"].cost ?? 2)) return { ok: false, why: `Needs ${SKILLS["bbr.dti1"].cost ?? 2} Rage` };
  if (id === "bbr.corpse" && !s.foes.some(x => x.hpNow <= 0 && !x.eaten)) return { ok: false, why: "No fallen enemy" };
  return { ok: true, why: "" };
}

export interface PlayOptions { pastRedDoublesRageDice: boolean; biteSpend: number; }

/** Plays one card from your hand. */
export function playCard(prev: CombatState, f: Fighter, owned: Owned, id: string, targetKey: string, rng: Rng, opt: PlayOptions): CombatState {
  if (!canPlay(prev, owned, id, targetKey).ok) return prev;
  const s = structuredClone(prev);
  const slot = cardSlot(id);
  if (slot === "active") s.used.active = true; else if (slot === "side") s.used.side = true;
  const G = (n: number, why: string) => gainRage(s, f, owned, n, why);

  if (id === "bbr.berserker1") {
    s.guardDown = true; say(s, "you", "Berserker: guard down until your next turn (Armour halved, extra Rage per hit).");
  } else if (id === "bbr.bitedown1") {
    const steps = Math.floor(Math.min(s.rage, Math.max(2, opt.biteSpend)) / 2);   // Rage is spent in pairs
    const per = parseDice(eff(owned, "bbr.bitedown1", "healPer2Rage"));
    const heal = rollN(rng, per.n * steps, per.d) + per.plus * steps;
    s.hp = Math.min(f.hpMax, s.hp + heal);
    say(s, "you", `Bite Down: spend ${steps * 2} Rage, heal ${heal} → ${s.hp} HP`);
    spendRage(s, f, owned, rng, steps * 2);
  } else if (id === "bbr.dti1") {
    const cost = SKILLS["bbr.dti1"].cost ?? 2; spendRage(s, f, owned, rng, cost);
    const failed = aliveFoes(s).filter(x => die(rng, 20) + x.composure < die(rng, 20) + f.intimidation).map(x => x.name);
    say(s, "you", `Draw Them In (−${cost} Rage): ${failed.length ? `${failed.join(", ")} must attack you` : "nobody failed Composure"}.`);
  } else if (id === "bbr.corpse") {
    const body = s.foes.find(x => x.hpNow <= 0 && !x.eaten)!;
    body.eaten = true;
    const heal = parseDice(SKILLS["bbr.corpse"].heal); const h = rollN(rng, heal.n, heal.d) + heal.plus;
    s.hp = Math.min(f.hpMax, s.hp + h); s.fel += SKILLS["bbr.corpse"].fel ?? 1; s.open = true;
    say(s, "you", `Corpse-Eater on the ${body.name}: +${h} HP → ${s.hp}, +${SKILLS["bbr.corpse"].fel ?? 1} fel (total ${s.fel}). You are open until your next turn.`);
    G(SKILLS["bbr.corpse"].rage ?? 2, "Corpse-Eater");
  } else {
    strike(s, f, owned, id, targetKey, rng, opt, G);
  }
  checkOver(s);
  return s;
}

function strike(s: CombatState, f: Fighter, owned: Owned, id: string, targetKey: string, rng: Rng, opt: PlayOptions, G: (n: number, why: string) => void) {
  const target = s.foes.find(x => x.key === targetKey)!;
  const rageAtSwing = s.rage;
  // dice split into "base" (weapon, Blooded, Headlong) and "bought" (Unmake, Red Mist) for Past the Red
  const base: Dice[] = [f.weapon], bought: Dice[] = [];
  let name = "Weapon attack";
  if (id === "bbr.headlong1") { name = "Headlong"; s.cycle.charged = true; const imp = parseDice(eff(owned, "bbr.headlong1", "impactDice")); if (imp.n) base.push(imp); }
  if (owned.has("bbr.blooded1") && rageAtSwing >= (SKILLS["bbr.blooded1"]?.atRage ?? 5)) base.push(parseDice(eff(owned, "bbr.blooded1", "bonusDice")));
  let spent = 0;
  if (id === "bbr.unmake1") {
    name = "Unmake"; spent = s.rage - (s.rage % 2);
    const per = parseDice(eff(owned, "bbr.unmake1", "dicePer2Rage"));
    bought.push({ n: per.n * (spent / 2), d: per.d, plus: 0 });
  }
  if (s.bank > 0) bought.push({ n: s.bank, d: 6, plus: 0 });

  const roll = d20(rng), atk = roll + f.attackBonus, crit = roll === 20;
  if ((rule("NaturalOneMisses") && roll === 1) || (!crit && atk < target.defence)) {
    say(s, "you", `${name} at the ${target.name}: ${roll}+${f.attackBonus}=${atk} vs Defence ${target.defence} — miss.`);
  } else {
    const ptr = owned.has("bbr.pastred1") && rageAtSwing >= (SKILLS["bbr.pastred1"].atRage ?? 10);
    const mult = (isBought: boolean) => (crit ? 2 : 1) * (ptr && (!isBought || opt.pastRedDoublesRageDice) ? 2 : 1);
    let sum = 0; const parts: string[] = [];
    for (const [list, isBought] of [[base, false], [bought, true]] as const) for (const x of list) {
      if (!x.n && !x.plus) continue;
      const m = mult(isBought), v = rollN(rng, x.n * m, x.d) + x.plus; sum += v; parts.push(`${x.n * m}d${x.d}${x.plus ? `+${x.plus}` : ""}=${v}`);
    }
    const dmg = Math.max(rule("MinDamage"), sum + f.ap - target.armour);
    target.hpNow -= dmg; s.stats.dealt += dmg;
    if (s.bank > 0) s.bank = 0;
    say(s, "you", `${name} at the ${target.name}: ${roll}+${f.attackBonus}=${atk} vs ${target.defence}${crit ? " — CRIT" : ""}${ptr ? " — Past the Red" : ""}. ${parts.join(" + ")} + AP ${f.ap} − Armour ${target.armour} = ${dmg} → ${Math.max(0, target.hpNow)} HP left`);
    if (dmg > 0) { s.cycle.dealt = true; G(rule("RageOnDeal"), "dealt damage"); }
    if (target.hpNow <= 0) { say(s, "you", `The ${target.name} falls.`); G(rule("RageOnKill"), "kill"); }
    if (id === "bbr.headlong1") G(SKILLS["bbr.headlong1"].rage ?? 1, "Headlong impact");
  }
  if (spent > 0) { say(s, "you", `Unmake spends all ${s.rage} Rage.`); spendRage(s, f, owned, rng, s.rage); }
}

/** Which passives / reactions are lit up right now (for the tray). */
export function passiveState(s: CombatState, owned: Owned, f: Fighter): Record<string, boolean> {
  return {
    "bbr.blooded1": s.rage >= (SKILLS["bbr.blooded1"]?.atRage ?? 5),
    "bbr.pastred1": owned.has("bbr.pastred1") && s.rage >= (SKILLS["bbr.pastred1"]?.atRage ?? 10),
    "bbr.hw1": s.rage > 0 || s.held > 0,
    "bbr.thickit1": aliveFoes(s).length >= (SKILLS["bbr.thickit1"]?.minFoes ?? 2),
    "bbr.redmist2": s.bank > 0,
    "bbr.unbroken": s.heldQueue.length > 0,
    "bbr.grudge1": s.foes.some(x => x.hpNow > 0 && !x.hasHitYou),
    "bbr.ironmind": s.rage >= 1 && f.rageMax > 0,
  };
}

// ── Autopilot and simulation (Dev mode) ──────────────────────

/** How the autopilot plays: simple, readable rules. */
export interface Policy {
  headlong: boolean; unmakeAt: number; berserker: boolean;
  biteBelowPct: number; biteSpend: number; corpseBelowPct: number;
}
export const DEFAULT_POLICY: Policy = { headlong: true, unmakeAt: 10, berserker: true, biteBelowPct: 40, biteSpend: 4, corpseBelowPct: 60 };

/** Plays your whole turn by the policy (side card first when it heals), then ends it. */
export function autoTurn(prev: CombatState, f: Fighter, owned: Owned, p: Policy, rng: Rng, opt: PlayOptions): CombatState {
  let s = prev;
  if (s.phase !== "player") return s;
  const target = () => s.foes.find(x => x.hpNow > 0)?.key ?? "";
  const ok = (id: string) => canPlay(s, owned, id, target()).ok;
  const hpPct = () => (s.hp / f.hpMax) * 100;
  const play = (id: string) => { s = playCard(s, f, owned, id, target(), rng, { ...opt, biteSpend: p.biteSpend }); };
  if (p.biteBelowPct && hpPct() < p.biteBelowPct && ok("bbr.bitedown1")) play("bbr.bitedown1");
  if (p.headlong && ok("bbr.headlong1")) play("bbr.headlong1");
  else if (p.corpseBelowPct && hpPct() < p.corpseBelowPct && ok("bbr.corpse")) play("bbr.corpse");
  else if (p.unmakeAt && s.rage >= p.unmakeAt && ok("bbr.unmake1")) play("bbr.unmake1");
  else if (ok(ATTACK)) play(ATTACK);
  if (p.berserker && ok("bbr.berserker1")) play("bbr.berserker1");
  return s.phase === "player" ? endTurn(s) : s;
}

export interface SimResult {
  fights: number; winRate: number; lossRate: number; drawRate: number;
  avgRounds: number; dmgPerTurn: number; avgHpLeft: number; avgPeakRage: number; surgesPerFight: number; sanityPerFight: number; felPerFight: number;
}
export function simulate(f: Fighter, foes: FoeDef[], owned: Owned, policy: Policy, pastRedDoublesRageDice: boolean, fights = 1000, seed = 1): SimResult {
  const rng = seeded(seed), opt = { pastRedDoublesRageDice, biteSpend: policy.biteSpend };
  let w = 0, l = 0, d = 0, rounds = 0, turns = 0, dealt = 0, hpLeft = 0, peak = 0, surges = 0, sanity = 0, fel = 0;
  for (let i = 0; i < fights; i++) {
    let s = rollInitiative(newFight(f, foes), f, rng);
    while (s.phase !== "over") s = s.phase === "player" ? autoTurn(s, f, owned, policy, rng, opt) : step(s, f, owned, rng);
    if (s.result === "win") { w++; hpLeft += Math.max(0, s.hp); } else if (s.result === "loss") l++; else d++;
    rounds += s.round; turns += s.playerTurns; dealt += s.stats.dealt; peak += s.stats.peakRage; surges += s.stats.surges; sanity += s.sanityLost; fel += s.fel;
  }
  return {
    fights, winRate: w / fights, lossRate: l / fights, drawRate: d / fights, avgRounds: rounds / fights,
    dmgPerTurn: dealt / Math.max(1, turns), avgHpLeft: w ? hpLeft / w : 0, avgPeakRage: peak / fights,
    surgesPerFight: surges / fights, sanityPerFight: sanity / fights, felPerFight: fel / fights,
  };
}
