/**
 * The character rules in use. Starts from DEFAULT_RULES; Dev mode edits are kept in the browser.
 * When src/data/rules.json changes (its fingerprint `version` changes), the old saved copy is set aside (not deleted).
 */
import { useEffect, useState } from "react";
import { clone } from "@/core/objects";
import { readStoredText, writeStored, writeStoredText } from "@/core/storage";
import { DEFAULT_RULES } from "./defaults";
import type { Rules } from "./types";

const KEY = "farwilds.rules";

function loadSaved(): Rules {
  try {
    const raw = readStoredText(KEY);
    if (!raw) return clone(DEFAULT_RULES);
    const saved = JSON.parse(raw) as Rules;
    if (saved.version !== DEFAULT_RULES.version) {
      writeStoredText(`${KEY}.v${saved.version}.backup`, raw);
      return clone(DEFAULT_RULES);
    }
    return saved;
  } catch { return clone(DEFAULT_RULES); }
}

export function useRules() {
  const [rules, setRules] = useState<Rules>(loadSaved);
  useEffect(() => { writeStored(KEY, rules); }, [rules]);
  return {
    rules,
    setRules,
    reset: () => setRules(clone(DEFAULT_RULES)),
    defaults: DEFAULT_RULES,
  };
}

export type RulesState = ReturnType<typeof useRules>;
