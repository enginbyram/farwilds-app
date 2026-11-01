/**
 * Every skill's behaviour, looked up by id.
 *
 *   1. A class module (classes/*.ts) can give a skill its own behaviour.
 *   2. Otherwise a card gets a generic mechanic from its combat.json fields (generic.ts):
 *        grantActive / grantSide → more actions this turn;  heal → healing;  anything else → a strike.
 *
 * So a new healing or Action-Surge-like card needs only a line in combat.json. A new kind of mechanic
 * needs a behaviour in its class module. Add a class module to CLASS_MODULES below.
 */
import { SKILLS, SKILL_IDS } from "../data";
import { ATTACK, type Ctx } from "../engine/types";
import { barbarian } from "./classes/barbarian";
import { fighter } from "./classes/fighter";
import { ATTACK_BEHAVIOUR, genericFor } from "./generic";
import type { Behaviour, ClassMechanics } from "./types";

/** Every class with mechanics of its own. */
export const CLASS_MODULES: ClassMechanics[] = [fighter, barbarian];

const OWN: Record<string, Behaviour> = Object.assign({}, ...CLASS_MODULES.map(m => m.behaviours));

/** The class module a skill id belongs to (by its prefix). */
export const classOf = (id: string) => CLASS_MODULES.find(m => id.startsWith(m.prefix));

/** Does this skill spend Rage (so the fighter needs a Rage pool to use it)? */
export const usesRage = (id: string) => classOf(id)?.resource === "rage";

/** How a card plays: its own behaviour, else the generic mechanic its fields describe. */
export function cardBehaviour(id: string): Behaviour {
  if (id === ATTACK) return ATTACK_BEHAVIOUR;
  return OWN[id] ?? genericFor(SKILLS[id]);
}

/** Skills with a behaviour of their own (passive hooks, tray lights, chips), in combat.json order. */
export const BEHAVIOURS: [string, Behaviour][] = SKILL_IDS.filter(id => OWN[id]).map(id => [id, OWN[id]]);

type HookName = Exclude<{ [K in keyof Behaviour]-?: NonNullable<Behaviour[K]> extends (...a: never[]) => unknown ? K : never }[keyof Behaviour], undefined>;

/** Runs one hook for every owned skill that has it, in combat.json order. */
export function each<K extends HookName>(c: Ctx, hook: K, run: (h: NonNullable<Behaviour[K]>, name: string, id: string) => void) {
  for (const [id, b] of BEHAVIOURS) {
    const h = b[hook];
    if (h && c.owned.has(id)) run(h as NonNullable<Behaviour[K]>, SKILLS[id].name, id);
  }
}

/** Like each(), but stops at the first owned skill whose `run` returns something truthy, and returns that. */
export function first<K extends HookName, R>(c: Ctx, hook: K, run: (h: NonNullable<Behaviour[K]>, name: string, id: string) => R): R | undefined {
  for (const [id, b] of BEHAVIOURS) {
    const h = b[hook];
    if (!h || !c.owned.has(id)) continue;
    const r = run(h as NonNullable<Behaviour[K]>, SKILLS[id].name, id);
    if (r) return r;
  }
  return undefined;
}
