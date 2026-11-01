/** Save, load and create characters: the tree build (useCharacter) and the sheet (useSheet) move together. */
import { downloadJson, slug } from "@/core/files";
import { plural } from "@/core/format";
import type { Computed } from "@/features/rules/compute";
import type { TreeModel } from "@/features/tree/types";
import { makeCharacterFile, parseCharacterFile } from "./characterFile";
import type { NewCharacter } from "./creator/CharacterCreator";
import type { Character } from "./state/useCharacter";
import type { SheetState } from "./state/useSheet";

export function useCharacterFiles({ ch, sh, model, source, computed, say, onReplaced }: {
  ch: Character; sh: SheetState; model: TreeModel; source: string; computed: Computed;
  say: (m: string) => void; onReplaced: () => void;
}) {
  return {
    save: () => {
      downloadJson(makeCharacterFile(ch.name, ch.className, sh.sheet, source, ch.unlockedIds, computed), `${slug(ch.name)}.farwilds.json`);
      say(`Saved ${ch.name}.`);
    },
    load: async (f: File) => {
      try {
        const file = parseCharacterFile(await f.text());
        const missing = file.tree.unlocked.filter(id => !model.byId.has(id)).length;
        ch.restore({ name: file.name, className: file.coreClass, unlocked: file.tree.unlocked });
        sh.setSheet(file.sheet);
        onReplaced();
        const notes = [
          !model.classes.has(file.coreClass) ? `class "${file.coreClass}" isn't in this workbook` : "",
          missing ? `${plural(missing, "node")} not in this workbook were skipped` : "",
        ].filter(Boolean);
        say(`Loaded ${file.name || f.name}${notes.length ? ` — ${notes.join("; ")}` : "."}`);
      } catch (e) {
        say(`Couldn't load "${f.name}": ${(e as Error).message}`);
      }
    },
    /** Replaces the current character with a new one from the Creator. False when the person says no. */
    create: (n: NewCharacter) => {
      if (ch.used > 0 && !window.confirm(`Replace ${ch.name}? Their ${ch.used} tree points will be cleared. Save them first if you want to keep them.`)) return false;
      ch.restore({ name: n.name, className: n.coreClass, unlocked: [] });
      sh.setSheet(n.sheet);
      onReplaced();
      say(`Created ${n.name}.`);
      return true;
    },
  };
}
