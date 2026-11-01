/** Reading single numbers (params) from the rules. */
import type { Rules } from "./types";

/** A getter for every parameter: const p = paramGetter(rules); p("BandSize"). A missing key reads as 0. */
export const paramGetter = (rules: Rules) => {
  const m = new Map(rules.params.map(x => [x.key, x.value]));
  return (key: string) => m.get(key) ?? 0;
};

/** One parameter, with a fallback when it is missing: param(rules, "MaxLevel", 45). */
export const param = (rules: Rules, key: string, fallback: number) =>
  rules.params.find(x => x.key === key)?.value ?? fallback;
