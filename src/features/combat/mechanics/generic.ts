/**
 * Generic card mechanics, chosen by a skill's fields in combat.json — no code needed for a new card of these kinds.
 *
 *   grantActive / grantSide   "+1 Main action this turn" (Action Surge)
 *   heal (+ healPerLevel)     heal dice + healPerLevel × level (Second Wind)
 *   anything else             a strike: the weapon attack, with whatever the passives add
 */
import { parseDice, roll } from "@/core/dice";
import type { SkillDef } from "../data";
import { say, T } from "../engine/log";
import { heal } from "../engine/state";
import type { Behaviour } from "./types";

/** The plain weapon attack. */
export const ATTACK_BEHAVIOUR: Behaviour = { targeted: true };

/** More actions this turn. */
export const grantActions = (def: SkillDef): Behaviour => ({
  play: ({ s }) => {
    s.extra.active += def.grantActive ?? 0; s.extra.side += def.grantSide ?? 0;
    const what = [def.grantActive && `+${def.grantActive} Main`, def.grantSide && `+${def.grantSide} Side`].filter(Boolean).join(", ");
    say(s, "you", `${T("skill", def.name)} ${T("stat", `${what} action this turn`)}`);
  },
});

/** Healing: heal dice + healPerLevel × your level. */
export const healCard = (def: SkillDef): Behaviour => ({
  play: ({ s, f, rng }) => {
    const h = roll(rng, parseDice(def.heal)) + (def.healPerLevel ?? 0) * (f.level ?? 1);
    heal(s, f, h);
    say(s, "you", `${T("skill", def.name)} ${T("heal", `+${h} HP`)} → ${T("stat", `${s.hp} HP`)}`);
  },
});

/** The behaviour a card's fields describe. */
export function genericFor(def: SkillDef | undefined): Behaviour {
  if (!def) return {};
  if (def.grantActive || def.grantSide) return grantActions(def);
  if (def.heal) return healCard(def);
  return {};
}
