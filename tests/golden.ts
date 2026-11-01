/**
 * Builds one big snapshot of what the app's logic produces: seeded fights (full logs), simulations,
 * character maths for every class, bonuses, money, wearing gear, the tree layout, unlock and route rules.
 * A refactor must leave this snapshot unchanged, byte for byte.
 */
import * as A from "./api";

type Fighter = A.Fighter;

const ALL_SKILLS = Object.keys(A.SKILLS);
const BARB = ALL_SKILLS.filter(id => id.startsWith("bbr."));
const FIGHTER = ALL_SKILLS.filter(id => id.startsWith("fig."));
const BASE_BARB = BARB.filter(id => !/2$/.test(id));

function fighter(over: Partial<Fighter> = {}): Fighter {
  return {
    name: "Tester", hpMax: 30, defence: 13, armour: 2, attackBonus: 5, ap: 3, initiative: 2,
    weapon: A.parseDice("1d12"), endurance: 3, intimidation: 2, conMod: 2, sanity: 12, rageMax: 10,
    weaponName: "Greataxe", damageType: "slashing", extraDamage: {}, level: 3, mainActions: 1, sideActions: 1,
    ...over,
  };
}

const FIGHTERS: Record<string, Fighter> = {
  plain: fighter(),
  tough: fighter({ hpMax: 60, armour: 5, endurance: 6, conMod: 4, level: 9 }),
  frail: fighter({ hpMax: 14, armour: 0, attackBonus: 2, ap: 1, endurance: 0, conMod: -1, rageMax: 10 }),
  cold: fighter({ damageType: "fire", extraDamage: { cold: 2, fire: 1 } }),
  twoMain: fighter({ mainActions: 2, sideActions: 2 }),
  noRage: fighter({ rageMax: 0 }),
};

const FOES: Record<string, A.FoeDef[]> = {
  bandits: [A.COMBAT.foes[0], A.COMBAT.foes[0]],
  mixed: [A.COMBAT.foes[0], A.COMBAT.foes[1], A.COMBAT.foes[2]],
  dummy: [A.COMBAT.foes[3]],
  veteran: [A.COMBAT.foes[2]],
};

const OWNED: Record<string, string[]> = {
  none: [], fighter: FIGHTER, barbBase: BASE_BARB, barbAll: BARB, all: ALL_SKILLS,
};

const ORDER = ["fig.secondw1", "fig.actions1", "bbr.bitedown1", "bbr.dti1", "bbr.corpse", "bbr.headlong1", "bbr.unmake1",
  A.ATTACK, A.ATTACK, A.ATTACK, "bbr.berserker1", "bbr.ironmind"];

/** A fight played by a fixed script (every card it can), recording verdicts and lit passives each turn. */
function scripted(f: Fighter, foes: A.FoeDef[], owned: Set<string>, seed: number, opt: A.PlayOptions, used: Record<string, number> = {}) {
  const rng = A.seeded(seed);
  let s = A.rollInitiative(A.newFight(f, foes, used), f, rng);
  const turns: unknown[] = [];
  let guard = 0;
  while (s.phase !== "over" && guard++ < 400) {
    if (s.phase === "player") {
      const target = () => s.foes.find(x => x.hpNow > 0)?.key ?? "";
      turns.push({
        verdicts: Object.fromEntries([A.ATTACK, ...ALL_SKILLS].map(id => [id, A.canPlay(s, owned, id, target())])),
        lit: A.passiveState(s, owned, f),
      });
      for (const id of ORDER) if (A.canPlay(s, owned, id, target()).ok) s = A.playCard(s, f, owned, id, target(), rng, opt);
      if (s.phase === "player") s = A.endTurn(s);
    } else s = A.step(s, f, owned, rng);
  }
  return { state: s, turns };
}

/** A fight played by the autopilot. */
function auto(f: Fighter, foes: A.FoeDef[], owned: Set<string>, seed: number, policy: A.Policy, opt: A.PlayOptions) {
  const rng = A.seeded(seed);
  let s = A.rollInitiative(A.newFight(f, foes), f, rng);
  let guard = 0;
  while (s.phase !== "over" && guard++ < 400) s = s.phase === "player" ? A.autoTurn(s, f, owned, policy, rng, opt) : A.step(s, f, owned, rng);
  return s;
}

function combat() {
  const out: Record<string, unknown> = {};
  out.cardSlots = Object.fromEntries([A.ATTACK, ...ALL_SKILLS].map(id => [id, A.cardSlot(id)]));
  out.dice = ["1d6", "2d6+1", "d8", "3d4-2", "", "0", "5", "garbage"].map(d => A.parseDice(d));
  const fights: Record<string, unknown> = {};
  let seed = 11;
  for (const [fn, f] of Object.entries(FIGHTERS)) for (const [on, ids] of Object.entries(OWNED)) for (const [xn, foes] of Object.entries(FOES)) {
    if ((on === "none" || on === "fighter") && fn !== "plain" && fn !== "twoMain") continue;
    const owned = new Set(ids);
    const opt = { pastRedDoublesRageDice: seed % 2 === 0, biteSpend: 2 + (seed % 3) * 2 };
    fights[`${fn}/${on}/${xn}/scripted`] = scripted(f, foes, owned, seed++, opt);
    fights[`${fn}/${on}/${xn}/auto`] = auto(f, foes, owned, seed++, A.DEFAULT_POLICY, opt);
  }
  // Rest-limited cards already used, a fight starting below max HP, a downed start.
  fights["used-cards"] = scripted(FIGHTERS.plain, FOES.bandits, new Set(ALL_SKILLS), 901, { pastRedDoublesRageDice: false, biteSpend: 4 }, { "fig.secondw1": 1, "fig.actions1": 1 });
  fights["hurt-start"] = scripted({ ...FIGHTERS.plain, hpStart: 9 }, FOES.mixed, new Set(ALL_SKILLS), 902, { pastRedDoublesRageDice: true, biteSpend: 6 });
  out.fights = fights;

  const policies: Record<string, A.Policy> = {
    default: A.DEFAULT_POLICY,
    timid: { headlong: false, unmakeAt: 0, berserker: false, biteBelowPct: 80, biteSpend: 6, corpseBelowPct: 90 },
    reckless: { headlong: true, unmakeAt: 4, berserker: true, biteBelowPct: 0, biteSpend: 2, corpseBelowPct: 0 },
  };
  const sims: Record<string, unknown> = {};
  for (const [pn, p] of Object.entries(policies)) for (const [fn, f] of Object.entries(FIGHTERS)) for (const [xn, foes] of Object.entries(FOES)) for (const pr of [false, true]) {
    sims[`${pn}/${fn}/${xn}/${pr}`] = A.simulate(f, foes, new Set(ALL_SKILLS), p, pr, 60, 5);
  }
  sims["barb-only"] = A.simulate(FIGHTERS.tough, FOES.mixed, new Set(BASE_BARB), A.DEFAULT_POLICY, false, 200, 3);
  out.sims = sims;
  return out;
}

function character() {
  const rules = A.DEFAULT_RULES;
  const model = A.buildModel(A.DATABASE);
  const skills = rules.skills.map(k => k.name);
  const out: Record<string, unknown> = {};
  const catalog = A.CATALOG;
  const pick = (cat: string, n = 0) => catalog.filter(c => c.category === cat)[n];
  const gearSets: Record<string, Record<string, A.Item>> = {
    naked: {},
    armed: Object.fromEntries([
      ["mainhand", pick("weapon")], ["chest", pick("armour")], ["ranged", catalog.find(c => c.slot === "ranged")],
      ["head", catalog.find(c => c.slot === "head")], ["ring1", catalog.find(c => c.slot === "ring1" || c.slot === "ring2")],
    ].filter(([, c]) => c).map(([slot, c]) => [slot as string, { name: (c as A.CatalogItemLike).name, ref: (c as A.CatalogItemLike).id, kind: slot as string }])),
    bonusy: Object.fromEntries(catalog.filter(c => c.bonuses?.length && c.slot).slice(0, 6).map(c => [c.slot!, { name: c.name, ref: c.id, kind: c.slot }])),
  };
  const classNodes = (cls: string) => model.nodes.filter(n => n.className === cls || n.isCentre);
  for (const core of rules.coreClasses) {
    const ascs = rules.ascendancies.filter(a => a.coreClass === core.name);
    const others = rules.ascendancies.filter(a => a.coreClass !== core.name);
    for (const level of [1, 6, 11, 16, 26]) for (const [gn, eq] of Object.entries(gearSets)) {
      const sheet = A.normaliseSheet({
        ...A.DEFAULT_SHEET, race: rules.races[level % rules.races.length].name, mark: rules.marks[level % rules.marks.length].name, level,
        asc1: level >= 6 ? ascs[0]?.name ?? "" : "", asc2: level >= 11 ? others[level % others.length]?.name ?? "" : "",
        subdominant: level >= 16 ? "Water" : "None",
        points: { STR: 3, DEX: 2, CON: 4, ENC: 0, LOG: 1, WIS: 2, PRE: 0, RHE: 1, AUT: 5 },
        skillPoints: { Endurance: 2, Intimidation: 1 }, equipped: eq,
      });
      const owned = level === 1 ? [] : classNodes(core.name).slice(0, level * 2);
      const ext = A.collectBonuses(sheet, owned, model.effects, skills);
      out[`${core.name}/${level}/${gn}`] = { ext, c: A.computeCharacter(rules, sheet, core.name, ext) };
    }
  }
  out.bonusText = ["+2 STR", "+1 Armour", "+2 Armor Rating every 10 AR", "+2 bonus to attack rolls with thrown weapons", "+1 Main Action",
    "+1 cold damage while raging", "Heavy Armor available to use", "Light and Medium Armor and Shields available to use", "−1 DEX", "+3 Endurance", "nonsense", "+2 per 2 STR"]
    .map(t => A.parseBonusText(t, model.effects, skills));
  out.rest = [
    A.longRest({ hpLost: 5, quickSpent: 3, purequickSpent: 4, sanityLost: 2, uses: { "fig.secondw1": 1, "fig.actions1": 1, "bbr.dti1": 2 } }),
    A.shortRest({ hpLost: 5, quickSpent: 3, purequickSpent: 7, sanityLost: 2, uses: { "fig.secondw1": 1, "fig.actions1": 1, "bbr.dti1": 2 } }, 9),
    A.shortRest({ hpLost: 0, quickSpent: 0, purequickSpent: 2, sanityLost: 0, uses: {} }, null),
  ];
  out.normalise = [A.normaliseSheet(undefined), A.normaliseSheet({ ranks: { STR: "Main", DEX: "Side", CON: "Misc" }, level: 4, bag: [{ name: "x", qty: 2 }, { bad: 1 }], wealth: { gold: "3", silver: -2 } })];
  out.ascFromTree = ["Fighter", "Rogue", "Cleric"].map(cls => {
    const ids = model.nodes.filter(n => n.className === cls && /ascend/i.test(n.type)).map(n => n.id);
    return A.ascendanciesFromTree(rules, model, ids, 1, "");
  });
  return out;
}

function equipment() {
  const C = A.CATALOG;
  const out: Record<string, unknown> = {};
  out.money = [0, 1, 9, 10, 99, 100, 1234, 98765].map(cp => A.formatMoney(cp));
  out.pay = [
    A.pay({ gold: 2, silver: 0, copper: 0 }, 37), A.pay({ gold: 0, silver: 5, copper: 3 }, 37), A.pay({ gold: 1, silver: 1, copper: 1 }, 500),
    A.pay({ gold: 0, silver: 0, copper: 50 }, 7), A.pay({ gold: 3, silver: 9, copper: 9 }, 399),
  ];
  out.receive = [A.receive({ gold: 1, silver: 0, copper: 0 }, 1234), A.receive({}, 7)];
  let bag: A.Item[] = [];
  for (const c of C.slice(0, 40)) bag = A.addToBag(bag, c, 2);
  out.bag = bag;
  out.sell = bag.map(A.sellPrice);
  out.slots = bag.map(A.slotsFor);
  let s = { bag, equipped: {} as Record<string, A.Item> };
  const trail: unknown[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = s.bag.findIndex(b => A.slotsFor(b).length);
    if (idx < 0) break;
    const r = A.wear(s, idx, i % 3 === 0 ? "offhand" : undefined);
    if (r) s = r;
    trail.push(Object.keys(s.equipped).sort());
  }
  const two = C.find(c => c.properties?.some(p => p.toLowerCase() === "two-handed"));
  if (two) { s = { ...s, bag: A.addToBag(s.bag, two, 1) }; const r = A.wear(s, s.bag.length - 1); if (r) s = r; trail.push(Object.keys(s.equipped).sort()); }
  for (const slot of Object.keys(s.equipped).slice(0, 3)) { const r = A.unequip(s, slot); if (r) s = r; }
  out.trail = trail;
  out.final = s;
  out.weight = A.carriedWeight(s);
  out.weapons = A.equippedWeapons(s.equipped);
  return out;
}

function tree() {
  const model = A.buildModel(A.DATABASE);
  const out: Record<string, unknown> = {};
  out.warnings = model.warnings;
  out.nodes = model.nodes.map(n => ({
    id: n.id, x: +n.x.toFixed(4), y: +n.y.toFixed(4), angle: +n.angle.toFixed(4), ring: n.ring, r: +n.radius.toFixed(4),
    cls: n.className, apt: n.aptitude, pts: n.points, nb: n.neighbours.map(x => x.id), bonuses: n.bonuses,
  }));
  out.links = model.links.map(l => `${l.a.id}-${l.b.id}:${l.type}`);
  // Unlock everything reachable, greedily, for each class; record each verdict on the way.
  const runs: Record<string, unknown> = {};
  for (const cls of model.classes.values()) {
    const start = model.byId.get(cls.startNodeId);
    if (!start) continue;
    const owned = new Set(model.nodes.filter(n => n.isCentre));
    owned.add(start);
    const log: string[] = [];
    for (let i = 0; i < 25; i++) {
      const next = A.nextSteps(model.nodes, owned, 3);
      const pickN = [...next.unlockable].sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!pickN) break;
      log.push(`${pickN.id}:${A.canUnlock(pickN, owned, 3).ok}:${next.blockedBy.size}`);
      owned.add(pickN);
    }
    log.push(...[...owned].map(n => `${n.id}:${A.canRefund(n, owned, start).reason}`));
    runs[cls.name] = log;
    const far = model.nodes.filter(n => n.className === cls.name).slice(-3);
    runs[`${cls.name}/routes`] = far.map(t => { const r = A.allocate(start, [t]); return { ok: r.ok, cost: r.cost, steps: r.steps.map(x => x.path.map(p => p.id)) }; });
  }
  out.runs = runs;
  return out;
}

export function golden() {
  return { combat: combat(), character: character(), equipment: equipment(), tree: tree() };
}
