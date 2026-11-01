/**
 * The character rules in use. Starts from DEFAULT_RULES; Dev mode edits are kept in the browser.
 * When src/data/rules.json changes (its fingerprint `version` changes), the old saved copy is set aside (not deleted).
 */
import { useEffect, useState } from "react";
import { DEFAULT_RULES } from "@/rules/defaults";
import type { Rules } from "@/rules/types";

const KEY = "farwilds.rules";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function loadSaved(): Rules {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_RULES);
    const saved = JSON.parse(raw) as Rules;
    if (saved.version !== DEFAULT_RULES.version) {
      localStorage.setItem(`${KEY}.v${saved.version}.backup`, raw);
      return clone(DEFAULT_RULES);
    }
    return saved;
  } catch { return clone(DEFAULT_RULES); }
}

/** Checks a rules file just enough to refuse something that isn't one. */
export function parseRules(text: string): Rules {
  const r = JSON.parse(text) as Partial<Rules> & { format?: string; rules?: Rules };
  const rules = (r.format === "farwilds-rules" ? r.rules : r) as Rules;
  const need: (keyof Rules)[] = ["params", "attributes", "skills", "coreClasses", "ascendancies", "races", "wellTiers", "armour", "elements"];
  const missing = need.filter(k => !Array.isArray(rules?.[k]));
  if (missing.length) throw new Error(`not a rules file (missing ${missing.join(", ")})`);
  return { ...clone(DEFAULT_RULES), ...rules, version: DEFAULT_RULES.version };
}

export function useRules() {
  const [rules, setRules] = useState<Rules>(loadSaved);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(rules)); } catch { /* storage blocked */ }
  }, [rules]);
  return {
    rules,
    setRules,
    reset: () => setRules(clone(DEFAULT_RULES)),
    defaults: DEFAULT_RULES,
  };
}

export type RulesState = ReturnType<typeof useRules>;
