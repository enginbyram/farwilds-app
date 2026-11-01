/**
 * A skill's behaviour in a fight — the "class" every mechanic implements.
 *
 * The engine never names a skill. At fixed points of a fight it asks every skill the fighter owns
 * whether it wants to act (the hooks below). A skill implements only the hooks it needs.
 *
 *   As a CARD (Main / Side / Misc drawer):
 *     targeted      needs a living target
 *     canPlay       an extra rule ("Needs 2 Rage") — return the reason, or "" when fine
 *     play          what the card does. No `play` = it is a strike (a weapon attack, shaped by the hooks below)
 *     prepareStrike / afterHit / afterStrike   this card's own strike: its name and dice, what follows a hit, what follows the swing
 *     option        an input shown in its drawer (Bite Down: Rage to spend)
 *
 *   As a PASSIVE (runs for every owned skill, in combat.json order):
 *     settleCycle          your turn opens: look back at the foes' turns (before Rage decay and the surge check)
 *     startOfTurnDamage    your turn opens: delayed damage lands
 *     startOfTurn          your turn opens: everything else (gains)
 *     strikeDice           add dice to any strike
 *     strikeBoost          multiply the dice of a strike (and name itself in the log)
 *     onHit                any strike of yours hit (before Rage is gained for it)
 *     incomingArmour       change your Armour against a foe's hit
 *     holdDamage           hold back part of a hit (returns how much)
 *     afterStruck          a foe hit you (after the Rage for taking damage)
 *     rageOverflow         Rage went past the cap
 *     surgeLoss            Sanity lost on a failed surge
 *     rageEmpty            Rage fell to 0 with held damage: return true when this skill dealt with it
 *
 *   For the screen:
 *     lit      whether its symbol in the passives tray is lit right now
 *     chips    small status labels under your gauges
 *
 * Numbers come from combat.json → skills (read them with eff(), which applies upgrades such as "Headlong II").
 */
import type { Dice } from "@/core/dice";
import type { CombatState, Ctx, FoeState, Fighter, Owned, PlayOptions } from "../engine/types";

/** The PlayOptions a card's drawer input can set (numbers only). */
export type NumericOption = { [K in keyof PlayOptions]: PlayOptions[K] extends number ? K : never }[keyof PlayOptions];

/** A card being played. */
export interface CardCtx extends Ctx { id: string; targetKey: string; opt: PlayOptions; }

/** A strike being put together: its name and dice before they are rolled. "bought" dice (paid with Rage) are kept apart for Past the Red. */
export interface StrikePlan { name: string; base: Dice[]; bought: Dice[]; spent: number; rageAtSwing: number; }

/** A dice multiplier with the name the log shows: Past the Red. */
export interface StrikeBoost { label: string; times: (bought: boolean) => number; }

/** A small status label under your gauges. `order` sets its place among the others. */
export interface Chip { order: number; text: string; title?: string; warn?: boolean; }

export interface Behaviour {
  // ── Card ──
  targeted?: boolean;
  canPlay?: (s: CombatState, owned: Owned) => string;
  play?: (c: CardCtx) => void;
  prepareStrike?: (c: CardCtx, plan: StrikePlan) => void;
  afterHit?: (c: CardCtx) => void;
  afterStrike?: (c: CardCtx, plan: StrikePlan) => void;
  option?: { key: NumericOption; label: string; suffix: string; min: number; step: number };

  // ── Passive ──
  settleCycle?: (c: Ctx) => void;
  startOfTurnDamage?: (c: Ctx) => void;
  startOfTurn?: (c: Ctx) => void;
  strikeDice?: (c: Ctx, plan: StrikePlan) => void;
  strikeBoost?: (c: Ctx & { opt: PlayOptions }, plan: StrikePlan) => StrikeBoost | null;
  onHit?: (c: Ctx) => void;
  incomingArmour?: (c: Ctx, armour: number) => number;
  holdDamage?: (c: Ctx, dmg: number) => number;
  afterStruck?: (c: Ctx, foe: FoeState) => void;
  rageOverflow?: (c: Ctx, over: number) => void;
  surgeLoss?: (c: Ctx, overflow: number, banked: number) => number;
  rageEmpty?: (c: Ctx) => boolean;

  // ── Screen ──
  lit?: (s: CombatState, owned: Owned, f: Fighter) => boolean;
  chips?: (s: CombatState) => Chip[];
}

/**
 * One class's (or pathway's) mechanics in one file: which skills it owns (by id prefix), the resource it
 * fights with, and a behaviour per skill id. Add a class: write a module like classes/barbarian.ts and list
 * it in registry.ts.
 */
export interface ClassMechanics {
  name: string;
  prefix: string;              // skill ids that start with this belong to the class ("bbr.")
  resource?: "rage";           // the pool its skills spend
  behaviours: Record<string, Behaviour>;
}
