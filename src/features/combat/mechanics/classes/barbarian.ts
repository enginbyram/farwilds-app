/**
 * Barbarian (Fighter → Barbarian, pillars Carnage and Bulwark). Fights with Rage.
 * Each skill below is one behaviour (see ../types.ts for the hooks). Numbers are read from combat.json → skills;
 * eff() applies the "II" upgrades.
 */
import { die, parseDice, rollN } from "@/core/dice";
import { rule, SKILLS } from "../../data";
import { say, T } from "../../engine/log";
import { gainRage, spendRage } from "../../engine/rage";
import { aliveFoes, heal } from "../../engine/state";
import { eff, num } from "../skills";
import type { CombatState } from "../../engine/types";
import type { Behaviour, ClassMechanics } from "../types";

/** Barbarian skill ids (combat.json → skills). */
export const BBR = {
  headlong: "bbr.headlong1",
  unmake: "bbr.unmake1",
  blooded: "bbr.blooded1",
  berserker: "bbr.berserker1",
  pastTheRed: "bbr.pastred1",
  redMist: "bbr.redmist2",
  thickOfIt: "bbr.thickit1",
  biteDown: "bbr.bitedown1",
  grudge: "bbr.grudge1",
  drawThemIn: "bbr.dti1",
  heldWounds: "bbr.hw1",
  corpseEater: "bbr.corpse",
  ironMind: "bbr.ironmind",
  unbroken: "bbr.unbroken",
} as const;

const needsRage = (n: number) => (s: CombatState) => (s.rage < n ? `Needs ${n} Rage` : "");

// ── Carnage ──────────────────────────────────────────────────

/** Charge on your first turn: a strike that builds Rage on impact, and more if you are struck during the charge. */
const headlong: Behaviour = {
  targeted: true,
  canPlay: s => (s.playerTurns > 1 ? "Only on your first turn" : ""),
  prepareStrike: ({ s, owned }, plan) => {
    plan.name = "Headlong"; s.cycle.charged = true;
    const imp = parseDice(eff(owned, BBR.headlong, "impactDice"));
    if (imp.n) plan.base.push(imp);
  },
  afterHit: c => gainRage(c, num(BBR.headlong, "rage", 1), "Headlong impact"),
  settleCycle: c => { if (c.s.cycle.charged && c.s.cycle.struck) gainRage(c, num(BBR.headlong, "rageIfStruck", 1), "struck during the charge"); },
};

/** Spend all Rage (in pairs) for extra dice on one strike. */
const unmake: Behaviour = {
  targeted: true,
  canPlay: needsRage(2),
  prepareStrike: ({ s, owned }, plan) => {
    plan.name = "Unmake"; plan.spent = s.rage - (s.rage % 2);
    const per = parseDice(eff(owned, BBR.unmake, "dicePer2Rage"));
    plan.bought.push({ n: per.n * (plan.spent / 2), d: per.d, plus: 0 });
  },
  afterStrike: (c, plan) => {
    if (plan.spent <= 0) return;
    say(c.s, "you", `${T("skill", "Unmake")} spends ${T("rage", `all ${c.s.rage} Rage`)}`);
    spendRage(c, c.s.rage);
  },
};

/** At the Rage threshold, every strike deals extra dice. */
const blooded: Behaviour = {
  strikeDice: ({ owned }, plan) => {
    if (plan.rageAtSwing >= num(BBR.blooded, "atRage", 5)) plan.base.push(parseDice(eff(owned, BBR.blooded, "bonusDice")));
  },
  lit: s => s.rage >= num(BBR.blooded, "atRage", 5),
};

/** Side action: lower your guard until your next turn — Armour cut, more Rage per hit taken. */
const berserker: Behaviour = {
  play: ({ s, owned }) => {
    s.guardDown = true;
    const halved = (eff(owned, BBR.berserker, "armourFactor") ?? 1) < 1;
    say(s, "you", `${T("skill", "Berserker")} guard down until your next turn:${halved ? ` ${T("stat", "Armour halved")},` : ""} extra Rage per hit`);
  },
  incomingArmour: ({ s, f, owned }, armour) => (s.guardDown ? Math.floor(f.armour * (eff(owned, BBR.berserker, "armourFactor") ?? 1)) : armour),
  afterStruck: c => { if (c.s.guardDown) gainRage(c, eff(c.owned, BBR.berserker, "extraRagePerHit") ?? 0, "Berserker"); },
  chips: s => (s.guardDown ? [{ order: 4, text: "Guard down", title: "Berserker: Armour halved", warn: true }] : []),
};

/** At full Rage, damage dice are doubled (the dice bought with Rage too, when Dev mode says so). */
const pastTheRed: Behaviour = {
  strikeBoost: ({ opt }, plan) => (plan.rageAtSwing >= num(BBR.pastTheRed, "atRage", 10)
    ? { label: SKILLS[BBR.pastTheRed].name, times: bought => (!bought || opt.pastRedDoublesRageDice ? 2 : 1) }
    : null),
  lit: (s, owned) => owned.has(BBR.pastTheRed) && s.rage >= num(BBR.pastTheRed, "atRage", 10),
};

/** Rage past the cap is banked as dice on your next hit; a failed surge then costs the banked amount. */
const bankDice = () => parseDice(SKILLS[BBR.redMist]?.bankDice || "1d6");
const redMist: Behaviour = {
  rageOverflow: ({ s }, over) => {
    const max = num(BBR.redMist, "bankMax", 3);
    const banked = Math.min(over, max - s.bank); s.bank += banked; s.cycle.banked += banked;
    const d = bankDice();
    if (banked > 0) say(s, "you", `${T("skill", "Red Mist")} banks ${T("rage", banked)} → ${T("stat", `${s.bank * d.n}d${d.d}`)} on your next hit`);
  },
  surgeLoss: (_c, _overflow, banked) => Math.max(1, banked),
  strikeDice: ({ s }, plan) => { if (s.bank > 0) { const d = bankDice(); plan.bought.push({ n: s.bank * d.n, d: d.d, plus: 0 }); } },
  onHit: ({ s }) => { if (s.bank > 0) s.bank = 0; },
  lit: s => s.bank > 0,
  chips: s => (s.bank > 0 ? [{ order: 3, text: `Red Mist ${s.bank}d${bankDice().d}`, title: "Red Mist bank: added to your next hit" }] : []),
};

// ── Bulwark ──────────────────────────────────────────────────

/** Rage each turn while enough foes stand. */
const thickOfIt: Behaviour = {
  startOfTurn: c => {
    if (c.s.playerTurns > 1 && aliveFoes(c.s).length >= num(BBR.thickOfIt, "minFoes", 2)) gainRage(c, num(BBR.thickOfIt, "rage", 1), "Thick of It");
  },
  lit: s => aliveFoes(s).length >= num(BBR.thickOfIt, "minFoes", 2),
};

/** Side action: spend Rage in pairs to heal. */
const biteDown: Behaviour = {
  canPlay: needsRage(2),
  option: { key: "biteSpend", label: "Bite Down spends", suffix: "Rage", min: 2, step: 2 },
  play: c => {
    const { s, f, owned, rng, opt } = c;
    const steps = Math.floor(Math.min(s.rage, Math.max(2, opt.biteSpend)) / 2);   // Rage is spent in pairs
    const per = parseDice(eff(owned, BBR.biteDown, "healPer2Rage"));
    const h = rollN(rng, per.n * steps, per.d) + per.plus * steps;
    heal(s, f, h);
    say(s, "you", `${T("skill", "Bite Down")} spends ${T("rage", `${steps * 2} Rage`)} ${T("heal", `+${h} HP`)} → ${T("stat", `${s.hp} HP`)}`);
    spendRage(c, steps * 2);
  },
};

/** Every hit a foe lands builds extra Rage. */
const grudge: Behaviour = {
  afterStruck: (c, foe) => gainRage(c, eff(c.owned, BBR.grudge, "rage") ?? 1, `Grudge vs the ${foe.name}`),   // every hit (node text, 1 Nov)
  lit: s => s.foes.some(x => x.hpNow > 0),
};

/** Side action: spend Rage on a shout; foes that fail Composure must attack you. */
const drawThemIn: Behaviour = {
  canPlay: s => needsRage(num(BBR.drawThemIn, "cost", 2))(s),
  play: c => {
    const { s, f, rng } = c;
    const cost = num(BBR.drawThemIn, "cost", 2); spendRage(c, cost);
    const failed = aliveFoes(s).filter(x => die(rng, 20) + x.composure < die(rng, 20) + f.intimidation).map(x => x.name);
    say(s, "you", `${T("skill", "Draw Them In")} ${T("rage", `−${cost} Rage`)} ${failed.length ? `${failed.map(n => T("foe", n)).join(" ")} must attack you` : "nobody failed Composure"}`);
  },
};

/** While raging, hold back part of each hit; it lands when Rage hits 0. */
const heldWounds: Behaviour = {
  holdDamage: ({ s, f }, dmg) => (s.rage > 0 ? Math.min(dmg, Math.max(0, f.conMod) * num(BBR.heldWounds, "conMultiplier", 2)) : 0),
  lit: s => s.rage > 0 || s.held > 0,
  chips: s => (s.held > 0 ? [{ order: 1, text: `Held ${s.held}`, title: "Held Wounds: lands when Rage hits 0" }] : []),
};

/** Main action: eat a fallen foe — heal, gain Rage, take in fel, and stand open until your next turn. */
const corpseEater: Behaviour = {
  canPlay: s => (!s.foes.some(x => x.hpNow <= 0 && !x.eaten) ? "No fallen enemy" : ""),
  play: c => {
    const { s, f, rng } = c;
    const body = s.foes.find(x => x.hpNow <= 0 && !x.eaten)!;
    body.eaten = true;
    const d = parseDice(SKILLS[BBR.corpseEater].heal); const h = rollN(rng, d.n, d.d) + d.plus;
    const fel = num(BBR.corpseEater, "fel", 1);
    heal(s, f, h); s.fel += fel; s.open = true;
    say(s, "you", `${T("skill", "Corpse-Eater")} on ${T("foe", body.name)} ${T("heal", `+${h} HP`)} → ${T("stat", `${s.hp} HP`)} ${T("fail", `+${fel} fel`)} (total ${s.fel}); you are open until your next turn`);
    gainRage(c, num(BBR.corpseEater, "rage", 2), "Corpse-Eater");
  },
  chips: s => (s.open ? [{ order: 5, text: "Open", title: "Corpse-Eater: foes attack with advantage", warn: true }] : []),
};

/** Reaction (not modelled yet): spend Rage for advantage against a spell. */
const ironMind: Behaviour = {
  lit: (s, _owned, f) => s.rage >= 1 && f.rageMax > 0,
};

/** When Rage hits 0, an Endurance check spreads the held damage over several turns. */
const unbroken: Behaviour = {
  rageEmpty: ({ s, f, rng }) => {
    const roll = die(rng, 20), total = roll + f.endurance, dc = rule("UnbrokenDC");
    if (total >= dc) {
      const n = num(BBR.unbroken, "turns", 3), part = Math.ceil(s.held / n);
      s.heldQueue.push(...Array.from({ length: n }, (_, i) => Math.min(part, s.held - part * i)).filter(x => x > 0));
      say(s, "you", `${T("skill", "Unbroken")} ${T("roll", `Endurance ${total} vs ${dc}`)} ${T("check", "held")} ${T("dmg", s.held)} lands over ${n} turns`);
      s.held = 0;
      return true;
    }
    say(s, "you", `${T("skill", "Unbroken")} ${T("roll", `Endurance ${total} vs ${dc}`)} ${T("fail", "failed")}`);
    return false;
  },
  startOfTurnDamage: ({ s }) => {
    if (!s.heldQueue.length) return;
    const part = s.heldQueue.shift()!; s.hp -= part;
    say(s, "you", `${T("skill", "Unbroken")} ${T("dmg", `${part} dmg`)} held damage lands → ${T("stat", `${s.hp} HP`)}`);
  },
  lit: s => s.heldQueue.length > 0,
  chips: s => (s.heldQueue.length > 0 ? [{ order: 2, text: `Queued ${s.heldQueue.join("+")}`, title: "Unbroken instalments" }] : []),
};

export const barbarian: ClassMechanics = {
  name: "Barbarian",
  prefix: "bbr.",
  resource: "rage",
  behaviours: {
    [BBR.headlong]: headlong, [BBR.unmake]: unmake, [BBR.blooded]: blooded, [BBR.berserker]: berserker,
    [BBR.pastTheRed]: pastTheRed, [BBR.redMist]: redMist, [BBR.thickOfIt]: thickOfIt, [BBR.biteDown]: biteDown,
    [BBR.grudge]: grudge, [BBR.drawThemIn]: drawThemIn, [BBR.heldWounds]: heldWounds, [BBR.corpseEater]: corpseEater,
    [BBR.ironMind]: ironMind, [BBR.unbroken]: unbroken,
  },
};
