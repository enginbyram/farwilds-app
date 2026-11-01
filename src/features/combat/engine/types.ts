/** The shapes the combat engine works with. */
import type { Dice, Rng } from "@/core/dice";
import type { FoeDef } from "../data";

/** Everything the fight needs from the character sheet plus the chosen gear (built by fighter.ts). */
export interface Fighter {
  name: string; hpMax: number; defence: number; armour: number; attackBonus: number; ap: number; initiative: number;
  weapon: Dice; endurance: number; intimidation: number; conMod: number; sanity: number; rageMax: number;
  weaponName?: string;
  hpStart?: number;                       // HP when the fight starts (the sheet's current HP); hpMax if absent
  mainActions?: number; sideActions?: number;   // per turn (1 each unless a node gives more: "+1 Main Action")
  level?: number;
  damageType?: string;                    // of the weapon: slashing, piercing… (physical types are cut by Armour)
  extraDamage?: Record<string, number>;   // flat extra damage by type from gear and the tree ("cold" → 1), lands past Armour
}

/** Which skills the fighter has: node ids from the tree (or Dev mode's test toggles). */
export type Owned = Set<string>;

export interface FoeState extends FoeDef { id: number; key: string; hpNow: number; hasHitYou: boolean; eaten: boolean; }
/** tie: the reroll that broke a tie between foes (PC beats NPC on a tie; NPCs reroll until different). */
export interface InitRoll { key: string; name: string; roll: number; bonus: number; total: number; side: "you" | "foe"; tie?: number; }
/** kind "line" is a normal entry; "turn" and "round" are centred dividers. */
export interface LogLine { round: number; who: "you" | "foe" | "sys"; text: string; kind?: "line" | "turn" | "round"; }
export type Phase = "setup" | "player" | "foes" | "over";

export interface CombatState {
  phase: Phase; round: number; order: InitRoll[]; cursor: number; playerTurns: number;
  used: { active: boolean; side: boolean };
  extra: { active: number; side: number };   // more actions this turn, from cards like Action Surge
  uses: Record<string, number>;              // how often each card was played this fight (perFight limits)
  hp: number; rage: number;
  held: number;          // damage held back (Held Wounds); lands when Rage hits 0
  heldQueue: number[];   // held damage landing in parts, one per turn (Unbroken)
  bank: number;          // dice banked for your next hit (Red Mist)
  guardDown: boolean;    // your Armour is lowered until your next turn (Berserker)
  open: boolean;         // foes attack you with advantage until your next turn (Corpse-Eater)
  lostControl: boolean;  // failed surge: this turn only a weapon attack, no Side card
  fel: number; sanityLost: number; foes: FoeState[];
  cycle: { dealt: boolean; took: boolean; overflow: number; banked: number; charged: boolean; struck: boolean };
  log: LogLine[]; result: "" | "win" | "loss" | "draw";
  stats: { dealt: number; taken: number; peakRage: number; surges: number };
}

/** Choices made in the moment (Dev tools and drawer inputs). */
export interface PlayOptions { pastRedDoublesRageDice: boolean; biteSpend: number; }

/** What every engine step works on. */
export interface Ctx { s: CombatState; f: Fighter; owned: Owned; rng: Rng; }

/** The id of your own entry in the turn order. */
export const YOU = "you";
/** The plain weapon attack: always in the Main drawer. */
export const ATTACK = "attack";
/** Physical damage types: Armour reduces these and only these (Rulebook 9.6). */
export const PHYSICAL = ["bludgeoning", "piercing", "slashing"];
