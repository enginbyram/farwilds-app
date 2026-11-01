/**
 * Rests (Rulebook 8.5). The sheet keeps what is used up since the last rest (`condition`); a rest gives it back.
 *
 *   Long rest  — at least 8 hours, once per 24 hours. All lost Hit Points return, Quick and Purequick refill,
 *                every card that recharges on a short or a long rest is ready again.
 *   Short rest — at least 1 hour. Purequick refills by half (rest counts as prayer); cards that recharge on a
 *                short rest are ready again. Hit Points and Quick come back only through food and drink, by
 *                their bonuses — not modelled yet, so a short rest leaves them as they are.
 *
 * Sanity is not restored by rest: the rulebook does not say it is.
 * Which cards recharge, and on which rest, is `recharge` in src/data/combat.json → skills.
 */
import { SKILLS } from "@/combat/engine";
import type { Condition } from "./types";

const ready = (uses: Record<string, number>, keep: (recharge?: string) => boolean) =>
  Object.fromEntries(Object.entries(uses).filter(([id]) => keep(SKILLS[id]?.recharge)));

export function longRest(c: Condition): Condition {
  return { ...c, hpLost: 0, quickSpent: 0, purequickSpent: 0, uses: ready(c.uses, r => !r || (r !== "short" && r !== "long")) };
}

export function shortRest(c: Condition, purequickMax: number | null): Condition {
  return {
    ...c,
    purequickSpent: Math.max(0, c.purequickSpent - Math.ceil((purequickMax ?? 0) / 2)),
    uses: ready(c.uses, r => r !== "short"),
  };
}
