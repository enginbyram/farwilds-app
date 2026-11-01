/**
 * A level up in progress, kept in the browser so a reload doesn't lose it.
 * While it runs, tree points = the new level; Cancel puts the tree back as it was.
 */
import { optionalCodec, usePersistentState } from "@/hooks/usePersistentState";
import type { Character } from "@/features/character/state/useCharacter";
import type { PendingLevelUp } from "./types";

export function useLevelUp() {
  const [pending, setPending] = usePersistentState<PendingLevelUp | null>("levelUp", null, optionalCodec<PendingLevelUp>());
  return {
    pending,
    /** Starts one (or keeps the one already running). */
    start: (level: number, ch: Pick<Character, "unlockedIds">) => { if (!pending) setPending({ from: level, to: level + 1, snapshot: ch.unlockedIds }); },
    /** Refunds the nodes taken since it started. */
    cancel: (ch: Pick<Character, "restore" | "name" | "className">) => {
      if (pending) ch.restore({ name: ch.name, className: ch.className, unlocked: pending.snapshot });
      setPending(null);
    },
    /** Ends it without touching the tree (confirmed, or replaced by a new or loaded character). */
    clear: () => setPending(null),
  };
}
