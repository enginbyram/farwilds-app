/**
 * Combat log. T(kind, text) wraps a value as ⟦kind|text⟧, which the log draws as a coloured pill.
 * Kinds: you, foe, skill, roll, hit, miss, crit, dmg, heal, rage, check, fail, stat.
 */
import type { CombatState, LogLine } from "./types";

export const T = (kind: string, text: string | number) => `⟦${kind}|${text}⟧`;

/** Adds a normal log line in the current round. */
export const say = (s: CombatState, who: LogLine["who"], text: string) => s.log.push({ round: s.round, who, text });

/** Adds a centred divider ("Round 2", "Your turn ends"). */
export const divider = (s: CombatState, kind: "turn" | "round", text: string, round = s.round) =>
  s.log.push({ round, who: "sys", text, kind });
