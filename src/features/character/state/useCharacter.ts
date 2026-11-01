/**
 * The character being built: name, class, and the set of unlocked node ids.
 * Points to spend on the tree = keystone points = the character level (passed in as `total`).
 * The class start is always owned and uses the level-1 point, so a new character has 0 points left.
 * Saved in the browser (localStorage) per workbook, so a reload keeps your build.
 */
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CHARACTER_NAME } from "@/config/settings";
import { readStored, writeStored } from "@/core/storage";
import type { TreeModel, TreeNode } from "@/features/tree/types";
import { canRefund, canUnlock, pointsUsed } from "@/features/tree/model/unlock";

interface Saved { name: string; className: string; unlocked: string[]; }

const load = (key: string) => readStored<Saved | null>(key, null);

export function useCharacter(model: TreeModel, workbookKey: string, total: number) {
  const storageKey = `farwilds.character.${workbookKey}`;
  const firstClass = [...model.classes.values()].find(c => c.name !== "Centre")?.name ?? "";
  const [name, setName] = useState(DEFAULT_CHARACTER_NAME);
  const [className, setClassName] = useState(firstClass);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  // Which save the state above came from. Nothing is written until it has been loaded,
  // so a fresh (empty) state can never overwrite a saved build.
  const [loadedKey, setLoadedKey] = useState("");

  // Load when the data source changes (JSON database / an imported workbook).
  useEffect(() => {
    const saved = load(storageKey);
    setName(saved?.name ?? DEFAULT_CHARACTER_NAME);
    setClassName(saved && model.classes.has(saved.className) ? saved.className : firstClass);
    setUnlockedIds(saved?.unlocked ?? []);
    setLoadedKey(storageKey);
    // Only on a new source — editing the JSON rebuilds the model but keeps the build you have.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    writeStored(storageKey, { name, className, unlocked: unlockedIds });
  }, [loadedKey, storageKey, name, className, unlockedIds]);

  const start: TreeNode | null = model.byId.get(model.classes.get(className)?.startNodeId ?? "") ?? null;
  const owned = useMemo(() => {
    const s = new Set<TreeNode>(model.nodes.filter(n => n.isCentre));  // the centre is always owned
    if (start) s.add(start);
    unlockedIds.forEach(id => { const n = model.byId.get(id); if (n) s.add(n); });
    return s;
  }, [model, start, unlockedIds]);

  const used = pointsUsed(owned, start);
  const left = total - used;

  return {
    name, setName, className, start, owned, used, total, left, unlockedIds,
    /** Loads a saved character as-is (class and nodes together, so the class change doesn't wipe the nodes). */
    restore: (r: { name: string; className: string; unlocked: string[] }) => {
      setName(r.name || DEFAULT_CHARACTER_NAME);
      if (model.classes.has(r.className)) setClassName(r.className);
      setUnlockedIds(r.unlocked.filter(id => model.byId.has(id)));
    },
    setClassName: (c: string) => { setClassName(c); setUnlockedIds([]); },  // new class = fresh build
    reset: () => setUnlockedIds([]),
    unlockVerdict: (n: TreeNode) => canUnlock(n, owned, left),
    refundVerdict: (n: TreeNode) => canRefund(n, owned, start),
    unlock: (n: TreeNode) => { if (canUnlock(n, owned, left).ok) setUnlockedIds(ids => [...ids, n.id]); },
    refund: (n: TreeNode) => { if (canRefund(n, owned, start).ok) setUnlockedIds(ids => ids.filter(id => id !== n.id)); },
  };
}

export type Character = ReturnType<typeof useCharacter>;
