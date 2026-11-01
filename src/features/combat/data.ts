/**
 * Combat data: src/data/combat.json — rules (how a turn resolves), skills (what each tree node does in a
 * fight, keyed by node id), test weapons and foe presets. Change a NUMBER in the JSON; change HOW a skill
 * works in mechanics/.
 */
import raw from "@/data/combat.json";

/** Where a skill sits: a card in a drawer (active = Main, side, misc), always on (passive), a reaction, or an upgrade of another skill. */
export type Action = "active" | "side" | "misc" | "passive" | "reaction" | "upgrade";

/** One skill in combat.json → skills. Every field but name/action/pillar/text is optional and read by its mechanic. */
export interface SkillDef {
  name: string; action: Action; pillar: string; text: string; upgrades?: string;
  rage?: number; rageIfStruck?: number; impactDice?: string; dicePer2Rage?: string; atRage?: number;
  bonusDice?: string; extraRagePerHit?: number; armourFactor?: number; bankDice?: string; bankMax?: number;
  minFoes?: number; healPer2Rage?: string; cost?: number; conMultiplier?: number; heal?: string; fel?: number; turns?: number;
  /** Action economy: playing the card gives this many more Main / Side actions this turn (Action Surge). */
  grantActive?: number; grantSide?: number;
  /** Times the card can be played in one fight. */
  perFight?: number;
  /** Times the card can be played between rests, and which rest makes it ready again ("short": short or long). */
  uses?: number; recharge?: "short" | "long";
  /** Healing cards: HP = heal dice + healPerLevel × level. */
  healPerLevel?: number;
}
export interface WeaponDef { name: string; dice: string; ap: number; damageType?: string; note?: string; }
export interface FoeDef { name: string; hp: number; defence: number; armour: number; attack: number; damage: string; composure: number; note?: string; }
export interface RuleRow { key: string; value: number; status: string; note: string; }

type Data = { rules: RuleRow[]; skills: Record<string, SkillDef>; weapons: WeaponDef[]; foes: FoeDef[] };
export const COMBAT = raw as unknown as Data;
export const SKILLS = COMBAT.skills;
/** Every skill id, in the order of combat.json. */
export const SKILL_IDS = Object.keys(SKILLS);
/** A combat rule's number (combat.json → rules); a missing key reads as 0. */
export const rule = (k: string) => COMBAT.rules.find(r => r.key === k)?.value ?? 0;
