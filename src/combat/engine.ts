/**
 * Combat engine — pure functions, no UI. One call to `playTurn` resolves one round:
 *   1. start of turn (Thick of It, Unbroken instalments)
 *   2. your Side card and Active card (in the order you choose)
 *   3. every living foe attacks you (Held Wounds, Berserker, Grudge, Rage from damage taken)
 *   4. end of turn (Rage decay, Rage hitting 0 releases Held Wounds)
 *
 * Numbers live in src/data/combat.json (rules + skills); character stats come from the Character page.
 * Change a NUMBER in the JSON; change HOW something works here.
 */
import raw from "@/data/combat.json";

// ── Data ─────────────────────────────────────────────────────

export type Action = "active" | "side" | "passive" | "reaction" | "upgrade";
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

const rule = (k: string) => COMBAT.rules.find(r => r.key === k)?.value ?? 0;

// ── Dice ─────────────────────────────────────────────────────

/** "2d6+1" → { n: 2, d: 6, plus: 1 }. "" or "0" → nothing. */
export interface Dice { n: number; d: number; plus: number; }
export function parseDice(s: string | undefined): Dice {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(s ?? "");
  if (!m) { const flat = Number(s); return { n: 0, d: 0, plus: Number.isFinite(flat) ? flat : 0 }; }
  return { n: m[1] ? Number(m[1]) : 1, d: Number(m[2]), plus: m[3] ? Number(m[3].replace(/\s/g, "")) : 0 };
}
export const diceText = (x: Dice) => (x.n ? `${x.n}d${x.d}` : "") + (x.plus ? `${x.plus > 0 && x.n ? "+" : ""}${x.plus}` : x.n ? "" : "0");

export type Rng = () => number;
/** Seeded random numbers (mulberry32), so a simulation can be repeated exactly. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const die = (rng: Rng, d: number) => 1 + Math.floor(rng() * d);
const rollN = (rng: Rng, n: number, d: number) => { let t = 0; for (let i = 0; i < n; i++) t += die(rng, d); return t; };
const d20 = (rng: Rng, mode: "adv" | "dis" | "" = "") => {
  const a = die(rng, rule("AttackDie") || 20); if (!mode) return a;
  const b = die(rng, rule("AttackDie") || 20); return mode === "adv" ? Math.max(a, b) : Math.min(a, b);
};

// ── Setup ────────────────────────────────────────────────────

/** Everything the fight needs from the character sheet plus the Combat page's gear choices. */
export interface Fighter {
  name: string; hpMax: number; defence: number; armour: number; attackBonus: number; ap: number;
  weapon: Dice; endurance: number; intimidation: number; conMod: number; sanity: number; rageMax: number;
}

/** Which skills the fighter has: node ids from the tree (or the Combat page's test toggles). */
export type Owned = Set<string>;

/** The effective value of a skill field, taking upgrades (Level 2 nodes) into account. */
function eff<K extends keyof SkillDef>(owned: Owned, id: string, key: K): SkillDef[K] | undefined {
  if (!owned.has(id)) return undefined;
  let v = SKILLS[id]?.[key];
  for (const [uid, s] of Object.entries(SKILLS)) if (s.upgrades === id && owned.has(uid) && s[key] !== undefined) v = s[key];
  return v;
}

export interface FoeState extends FoeDef { id: number; hpNow: number; hasHitYou: boolean; eaten: boolean; }
export interface CombatState {
  turn: number; hp: number; rage: number; held: number; heldQueue: number[]; bank: number;
  guardDown: boolean;   // Berserker until your next turn
  open: boolean;        // Corpse-Eater: foes have advantage until your next turn
  lostControl: boolean; // failed surge: next turn only a weapon attack, no Side card
  fel: number; sanityLost: number; foes: FoeState[];
  log: LogLine[]; result: "" | "win" | "loss" | "draw";
  stats: { dealt: number; taken: number; peakRage: number; surges: number };
}
export interface LogLine { turn: number; who: "you" | "foe" | "sys"; text: string; }

export function startFight(f: Fighter, foes: FoeDef[]): CombatState {
  return {
    turn: 0, hp: f.hpMax, rage: 0, held: 0, heldQueue: [], bank: 0, guardDown: false, open: false, lostControl: false,
    fel: 0, sanityLost: 0, log: [],
    foes: foes.map((x, i) => ({ ...x, id: i, hpNow: x.hp, hasHitYou: false, eaten: false })),
    result: "", stats: { dealt: 0, taken: 0, peakRage: 0, surges: 0 },
  };
}

// ── Choices ──────────────────────────────────────────────────

export type ActiveChoice = "attack" | "bbr.headlong1" | "bbr.unmake1" | "bbr.corpse";
export type SideChoice = "" | "bbr.berserker1" | "bbr.bitedown1" | "bbr.dti1";
export interface TurnChoice { active: ActiveChoice; side: SideChoice; sideFirst: boolean; biteSpend: number; }

/** What can be played this turn, with a reason when something can't. */
export function options(s: CombatState, owned: Owned) {
  const fallen = s.foes.some(x => x.hpNow <= 0 && !x.eaten);
  const active: { id: ActiveChoice; ok: boolean; why: string }[] = [
    { id: "attack", ok: true, why: "" },
    { id: "bbr.headlong1", ok: owned.has("bbr.headlong1") && s.turn === 0 && !s.lostControl, why: s.turn > 0 ? "only on the first turn" : "" },
    { id: "bbr.unmake1", ok: owned.has("bbr.unmake1") && s.rage >= 2 && !s.lostControl, why: s.rage < 2 ? "needs 2 Rage" : "" },
    { id: "bbr.corpse", ok: owned.has("bbr.corpse") && fallen && !s.lostControl, why: fallen ? "" : "no fallen enemy" },
  ];
  const side: { id: SideChoice; ok: boolean; why: string }[] = [
    { id: "", ok: true, why: "" },
    { id: "bbr.berserker1", ok: owned.has("bbr.berserker1") && !s.lostControl, why: "" },
    { id: "bbr.bitedown1", ok: owned.has("bbr.bitedown1") && s.rage >= 2 && !s.lostControl, why: s.rage < 2 ? "needs 2 Rage" : "" },
    { id: "bbr.dti1", ok: owned.has("bbr.dti1") && s.rage >= (SKILLS["bbr.dti1"]?.cost ?? 2) && !s.lostControl, why: "needs 2 Rage" },
  ];
  return { active: active.filter(a => owned.has(a.id) || a.id === "attack"), side: side.filter(a => owned.has(a.id) || a.id === "") };
}

// ── The turn ─────────────────────────────────────────────────

export interface Options { pastRedDoublesRageDice: boolean; }

export function playTurn(prev: CombatState, f: Fighter, owned: Owned, choice: TurnChoice, rng: Rng, opt: Options): CombatState {
  if (prev.result) return prev;
  const s: CombatState = structuredClone(prev);
  s.turn += 1;
  const T = s.turn;
  const log = (who: LogLine["who"], text: string) => s.log.push({ turn: T, who, text });
  let dealtThisTurn = false, tookThisTurn = false, overflow = 0, bankedThisTurn = 0;
  const lostControl = s.lostControl;
  s.lostControl = false; s.guardDown = false; s.open = false;
  const alive = () => s.foes.filter(x => x.hpNow > 0);

  // Rage gain with the cap: anything past RageMax is overflow (Red Mist bank + surge check).
  const gainRage = (n: number, why: string) => {
    if (n <= 0 || f.rageMax <= 0) return;
    const before = s.rage;
    s.rage = Math.min(f.rageMax, s.rage + n);
    const over = before + n - f.rageMax;
    log("you", `+${n} Rage (${why}) → ${s.rage}`);
    if (over > 0) {
      overflow += over;   // checked once, at the end of the turn
      if (owned.has("bbr.redmist2")) {
        const max = SKILLS["bbr.redmist2"].bankMax ?? 3;
        const banked = Math.min(over, max - s.bank); s.bank += banked; bankedThisTurn += banked;
        if (banked > 0) log("you", `Red Mist banks ${banked} → ${s.bank}d6 on your next hit`);
      }
    }
    s.stats.peakRage = Math.max(s.stats.peakRage, s.rage);
  };

  // Rage reaching 0 releases Held Wounds (Unbroken can spread them out).
  const releaseHeld = () => {
    if (s.held <= 0) return;
    if (owned.has("bbr.unbroken")) {
      const roll = die(rng, 20), total = roll + f.endurance, dc = rule("UnbrokenDC");
      if (total >= dc) {
        const n = SKILLS["bbr.unbroken"].turns ?? 3, part = Math.ceil(s.held / n);
        s.heldQueue.push(...Array.from({ length: n }, (_, i) => Math.min(part, s.held - part * i)).filter(x => x > 0));
        log("you", `Unbroken: Endurance ${total} vs ${dc} — ${s.held} held damage lands over ${n} turns.`);
        s.held = 0; return;
      }
      log("you", `Unbroken: Endurance ${total} vs ${dc} — failed.`);
    }
    s.hp -= s.held; log("you", `Rage hits 0: ${s.held} held damage lands at once → ${s.hp} HP`);
    s.held = 0;
  };
  const spendRage = (n: number) => { const was = s.rage; s.rage = Math.max(0, s.rage - n); if (was > 0 && s.rage === 0) releaseHeld(); };

  // ── 1. Start of turn ──
  if (s.heldQueue.length) { const part = s.heldQueue.shift()!; s.hp -= part; log("you", `Unbroken: ${part} held damage lands → ${s.hp} HP`); }
  if (owned.has("bbr.thickit1") && T > 1 && alive().length >= (SKILLS["bbr.thickit1"].minFoes ?? 2)) gainRage(SKILLS["bbr.thickit1"].rage ?? 1, "Thick of It");
  if (lostControl) log("sys", "You are lost in the surge: a plain weapon attack, no Side card.");

  // ── 2. Your cards ──
  const active: ActiveChoice = lostControl ? "attack" : choice.active;
  const side: SideChoice = lostControl ? "" : choice.side;

  const doSide = () => {
    if (side === "bbr.berserker1") {
      s.guardDown = true; log("you", "Berserker: guard down until your next turn (Armour halved, extra Rage per hit).");
    } else if (side === "bbr.bitedown1") {
      const steps = Math.floor(Math.min(s.rage, Math.max(2, choice.biteSpend)) / 2);   // Rage is spent in pairs
      const per = parseDice(eff(owned, "bbr.bitedown1", "healPer2Rage"));
      const heal = rollN(rng, per.n * steps, per.d) + per.plus * steps;
      s.hp = Math.min(f.hpMax, s.hp + heal);
      log("you", `Bite Down: spend ${steps * 2} Rage, heal ${heal} → ${s.hp} HP`);
      spendRage(steps * 2);
    } else if (side === "bbr.dti1") {
      const cost = SKILLS["bbr.dti1"].cost ?? 2; spendRage(cost);
      const failed = alive().filter(x => { const r = die(rng, 20); return r + x.composure < die(rng, 20) + f.intimidation; }).map(x => x.name);
      log("you", `Draw Them In (−${cost} Rage): ${failed.length ? `${failed.join(", ")} must attack you` : "nobody failed Composure"}.`);
    }
  };

  const doActive = () => {
    if (active === "bbr.corpse") {
      const body = s.foes.find(x => x.hpNow <= 0 && !x.eaten)!;
      body.eaten = true;
      const heal = parseDice(SKILLS["bbr.corpse"].heal); const h = rollN(rng, heal.n, heal.d) + heal.plus;
      s.hp = Math.min(f.hpMax, s.hp + h); s.fel += SKILLS["bbr.corpse"].fel ?? 1; s.open = true;
      log("you", `Corpse-Eater on the ${body.name}: +${h} HP → ${s.hp}, +${SKILLS["bbr.corpse"].fel ?? 1} fel (total ${s.fel}). You are open.`);
      gainRage(SKILLS["bbr.corpse"].rage ?? 2, "Corpse-Eater");
      return;
    }
    const target = alive()[0]; if (!target) return;
    const rageAtSwing = s.rage;
    // dice of this strike, split into "base" (weapon, Blooded, Headlong) and "bought" (Unmake, Red Mist)
    const base: Dice[] = [f.weapon], bought: Dice[] = [];
    let name = "Weapon attack";
    if (active === "bbr.headlong1") { name = "Headlong"; const imp = parseDice(eff(owned, "bbr.headlong1", "impactDice")); if (imp.n) base.push(imp); }
    const blAt = SKILLS["bbr.blooded1"]?.atRage ?? 5;
    if (owned.has("bbr.blooded1") && rageAtSwing >= blAt) base.push(parseDice(eff(owned, "bbr.blooded1", "bonusDice")));
    let spent = 0;
    if (active === "bbr.unmake1") {
      name = "Unmake"; spent = s.rage - (s.rage % 2);
      const per = parseDice(eff(owned, "bbr.unmake1", "dicePer2Rage"));
      bought.push({ n: per.n * (spent / 2), d: per.d, plus: 0 });
    }
    if (s.bank > 0) { bought.push({ n: s.bank, d: 6, plus: 0 }); }

    const roll = d20(rng), atk = roll + f.attackBonus, crit = roll === 20;
    const miss = (rule("NaturalOneMisses") && roll === 1) || (!crit && atk < target.defence);
    if (miss) {
      log("you", `${name} at the ${target.name}: ${roll}+${f.attackBonus}=${atk} vs ${target.defence} — miss.`);
    } else {
      const ptr = owned.has("bbr.pastred1") && rageAtSwing >= (SKILLS["bbr.pastred1"].atRage ?? 10);
      const mult = (bought: boolean) => (crit ? 2 : 1) * (ptr && (!bought || opt.pastRedDoublesRageDice) ? 2 : 1);
      let sum = 0; const parts: string[] = [];
      for (const [list, isBought] of [[base, false], [bought, true]] as const) for (const x of list) {
        if (!x.n && !x.plus) continue;
        const m = mult(isBought), v = rollN(rng, x.n * m, x.d) + x.plus; sum += v; parts.push(`${x.n * m}d${x.d}${x.plus ? `+${x.plus}` : ""}=${v}`);
      }
      const raw = sum + f.ap, dmg = Math.max(rule("MinDamage"), raw - target.armour);
      target.hpNow -= dmg; s.stats.dealt += dmg;
      if (s.bank > 0) { log("you", `Red Mist spends ${s.bank}d6.`); s.bank = 0; }
      log("you", `${name} at the ${target.name}: ${roll}+${f.attackBonus}=${atk} vs ${target.defence}${crit ? " — CRIT" : ""}${ptr ? " — Past the Red" : ""}. ${parts.join(" + ")} + AP ${f.ap} − Armour ${target.armour} = ${dmg} → ${Math.max(0, target.hpNow)} HP left`);
      if (dmg > 0) { dealtThisTurn = true; gainRage(rule("RageOnDeal"), "dealt damage"); }
      if (target.hpNow <= 0) { log("you", `The ${target.name} falls.`); gainRage(rule("RageOnKill"), "kill"); }
      if (active === "bbr.headlong1") gainRage(SKILLS["bbr.headlong1"].rage ?? 1, "Headlong impact");
    }
    if (spent > 0) { log("you", `Unmake spends ${spent} Rage.`); spendRage(s.rage); }
  };

  if (choice.sideFirst) { doSide(); doActive(); } else { doActive(); doSide(); }

  if (!alive().length) { s.result = "win"; log("sys", `Won in ${T} turn${T === 1 ? "" : "s"}.`); return s; }

  // ── 3. Foes attack ──
  const armourNow = s.guardDown ? Math.floor(f.armour * (eff(owned, "bbr.berserker1", "armourFactor") ?? 0.5)) : f.armour;
  let struck = false;
  for (const foe of alive()) {
    if (foe.attack <= -50) continue;   // dummies
    const roll = d20(rng, s.open ? "adv" : ""), atk = roll + foe.attack, crit = roll === 20;
    if ((rule("NaturalOneMisses") && roll === 1) || (!crit && atk < f.defence)) { log("foe", `The ${foe.name} attacks: ${atk} vs ${f.defence} — miss.`); continue; }
    const dd = parseDice(foe.damage);
    const dmg = Math.max(rule("MinDamage"), rollN(rng, dd.n * (crit ? 2 : 1), dd.d) + dd.plus - armourNow);
    if (dmg <= 0) { log("foe", `The ${foe.name} hits${crit ? " (crit)" : ""} but Armour ${armourNow} stops it.`); continue; }
    struck = true; tookThisTurn = true; s.stats.taken += dmg;
    let held = 0;
    if (owned.has("bbr.hw1") && s.rage > 0) held = Math.min(dmg, Math.max(0, f.conMod) * (SKILLS["bbr.hw1"].conMultiplier ?? 2));
    s.held += held; s.hp -= dmg - held;
    log("foe", `The ${foe.name} hits${crit ? " (crit)" : ""}: ${dmg} damage${held ? `, ${held} held back (holding ${s.held})` : ""} → ${s.hp} HP`);
    gainRage(rule("RageOnTake"), "took damage");
    if (s.guardDown) gainRage(eff(owned, "bbr.berserker1", "extraRagePerHit") ?? 0, "Berserker");
    if (!foe.hasHitYou && owned.has("bbr.grudge1")) gainRage(eff(owned, "bbr.grudge1", "rage") ?? 1, `Grudge vs the ${foe.name}`);
    foe.hasHitYou = true;
  }
  if (active === "bbr.headlong1" && struck) gainRage(SKILLS["bbr.headlong1"].rageIfStruck ?? 1, "struck during the charge");

  // ── 4. End of turn ──
  // Surge: one Endurance check per turn for all Rage gained past the cap this turn.
  if (overflow > 0) {
    s.stats.surges += 1;
    const roll = die(rng, 20), total = roll + f.endurance, dc = rule("SurgeDC");
    if (total >= dc) log("you", `Surge: ${overflow} Rage past the cap this turn. Endurance ${roll}+${f.endurance}=${total} vs ${dc} — held.`);
    else {
      const loss = owned.has("bbr.redmist2") ? Math.max(1, bankedThisTurn) : overflow;
      s.lostControl = true; s.sanityLost += loss;
      log("you", `Surge: ${overflow} Rage past the cap this turn. Endurance ${roll}+${f.endurance}=${total} vs ${dc} — FAILED: you lose control next turn, −${loss} Sanity.`);
    }
  }
  if (!dealtThisTurn && !tookThisTurn && s.rage > 0) { log("you", `No blood this turn: −${rule("RageDecay")} Rage.`); spendRage(rule("RageDecay")); }
  if (s.hp <= 0) { s.result = "loss"; log("sys", `You fall on turn ${T}.`); }
  else if (T >= rule("MaxTurns")) { s.result = "draw"; log("sys", `Still standing after ${T} turns — draw.`); }
  return s;
}

// ── Autopilot and simulation ─────────────────────────────────

/** How the autopilot plays: simple, readable rules you can change on the Combat page. */
export interface Policy {
  headlong: boolean;       // open with Headlong when owned
  unmakeAt: number;        // Unmake once Rage reaches this (0 = never)
  berserker: boolean;      // Berserker every turn when owned
  biteBelowPct: number;    // Bite Down when HP is under this % (0 = never)
  biteSpend: number;       // Rage spent per Bite Down
  corpseBelowPct: number;  // Corpse-Eater when HP is under this % and a body lies there
}
export const DEFAULT_POLICY: Policy = { headlong: true, unmakeAt: 10, berserker: true, biteBelowPct: 40, biteSpend: 4, corpseBelowPct: 60 };

export function autoChoice(s: CombatState, f: Fighter, owned: Owned, p: Policy): TurnChoice {
  const o = options(s, owned), can = (id: string) => [...o.active, ...o.side].some(x => x.id === id && x.ok);
  const hpPct = (s.hp / f.hpMax) * 100;
  let active: ActiveChoice = "attack", side: SideChoice = "";
  if (p.headlong && can("bbr.headlong1")) active = "bbr.headlong1";
  else if (p.corpseBelowPct && hpPct < p.corpseBelowPct && can("bbr.corpse")) active = "bbr.corpse";
  else if (p.unmakeAt && s.rage >= p.unmakeAt && can("bbr.unmake1")) active = "bbr.unmake1";
  if (p.biteBelowPct && hpPct < p.biteBelowPct && can("bbr.bitedown1")) side = "bbr.bitedown1";
  else if (p.berserker && can("bbr.berserker1")) side = "bbr.berserker1";
  return { active, side, sideFirst: side === "bbr.bitedown1", biteSpend: p.biteSpend };
}

export interface SimResult {
  fights: number; winRate: number; lossRate: number; drawRate: number;
  avgTurns: number; dmgPerTurn: number; avgHpLeft: number; avgPeakRage: number; surgesPerFight: number; sanityPerFight: number; felPerFight: number;
}
export function simulate(f: Fighter, foes: FoeDef[], owned: Owned, policy: Policy, opt: Options, fights = 1000, seed = 1): SimResult {
  const rng = seeded(seed);
  let w = 0, l = 0, d = 0, turns = 0, dealt = 0, hpLeft = 0, peak = 0, surges = 0, sanity = 0, fel = 0;
  for (let i = 0; i < fights; i++) {
    let s = startFight(f, foes);
    while (!s.result) s = playTurn(s, f, owned, autoChoice(s, f, owned, policy), rng, opt);
    if (s.result === "win") { w++; hpLeft += Math.max(0, s.hp); } else if (s.result === "loss") l++; else d++;
    turns += s.turn; dealt += s.stats.dealt; peak += s.stats.peakRage; surges += s.stats.surges; sanity += s.sanityLost; fel += s.fel;
  }
  return {
    fights, winRate: w / fights, lossRate: l / fights, drawRate: d / fights, avgTurns: turns / fights,
    dmgPerTurn: dealt / Math.max(1, turns), avgHpLeft: w ? hpLeft / w : 0, avgPeakRage: peak / fights,
    surgesPerFight: surges / fights, sanityPerFight: sanity / fights, felPerFight: fel / fights,
  };
}
