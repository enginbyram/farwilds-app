import type { Character } from "@/features/character/state/useCharacter";
import type { SheetState } from "@/features/character/state/useSheet";
import type { Computed } from "@/features/rules/compute";
import type { Rules } from "@/features/rules/types";

/** What every part of the Character page reads: the rules, the sheet, the tree character and the computed numbers. */
export interface SheetProps { rules: Rules; sh: SheetState; ch: Character; c: Computed; }
