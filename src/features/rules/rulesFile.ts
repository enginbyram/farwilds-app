/**
 * Rules files (.json): what Dev mode → Export rules writes and Import rules reads.
 *   { "format": "farwilds-rules", "savedAt": "…", "rules": { params, coreClasses, races, … } }
 * A bare rules object (no wrapper) is accepted too.
 */
import { clone } from "@/core/objects";
import { DEFAULT_RULES } from "./defaults";
import type { Rules } from "./types";

export const RULES_FORMAT = "farwilds-rules";

export const rulesFile = (rules: Rules) => ({ format: RULES_FORMAT, savedAt: new Date().toISOString(), rules });

/** Checks a rules file just enough to refuse something that isn't one. Missing tables come from the defaults. */
export function parseRules(text: string): Rules {
  const r = JSON.parse(text) as Partial<Rules> & { format?: string; rules?: Rules };
  const rules = (r.format === RULES_FORMAT ? r.rules : r) as Rules;
  const need: (keyof Rules)[] = ["params", "attributes", "skills", "coreClasses", "ascendancies", "races", "wellTiers", "armour", "elements"];
  const missing = need.filter(k => !Array.isArray(rules?.[k]));
  if (missing.length) throw new Error(`not a rules file (missing ${missing.join(", ")})`);
  return { ...clone(DEFAULT_RULES), ...rules, version: DEFAULT_RULES.version };
}
