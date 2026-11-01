/** What the combat screen shows about the state: lit passives and status chips. */
import { BEHAVIOURS } from "../mechanics/registry";
import type { Chip } from "../mechanics/types";
import type { CombatState, Fighter, Owned } from "./types";

/** Which passives / reactions are lit up right now (for the tray), by skill id. */
export function passiveState(s: CombatState, owned: Owned, f: Fighter): Record<string, boolean> {
  return Object.fromEntries(BEHAVIOURS.filter(([, b]) => b.lit).map(([id, b]) => [id, b.lit!(s, owned, f)]));
}

/** Status labels under your gauges: from the skills, plus losing control, fel and Sanity lost. */
export function statusChips(s: CombatState): Chip[] {
  const chips: Chip[] = BEHAVIOURS.flatMap(([, b]) => b.chips?.(s) ?? []);
  if (s.lostControl) chips.push({ order: 6, text: "Lost in the surge", warn: true });
  if (s.fel > 0) chips.push({ order: 7, text: `Fel ${s.fel}`, title: "Fel taken in" });
  if (s.sanityLost > 0) chips.push({ order: 8, text: `Sanity −${s.sanityLost}`, title: "Sanity lost this fight" });
  return chips.sort((a, b) => a.order - b.order);
}
