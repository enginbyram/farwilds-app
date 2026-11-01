/** Hover lines for bonuses from gear and the tree. */
import { linesFor } from "@/features/rules/bonuses";
import type { External } from "@/features/rules/compute";
import type { HintLine } from "@/ui";

/** Each item or node that gives one of `targets`, or "Gear & passives +0" when none does. */
export function bonusLinesOrNone(ext: External, ...targets: string[]): HintLine[] {
  const l = linesFor(ext, ...targets);
  return l.length ? l : [["Gear & passives", "+0"]];
}
