/**
 * What the Tree page is showing: the selected node, route mode (two picks → cheapest route) and the map toggles.
 * Esc leaves route mode.
 */
import { useCallback, useMemo, useState } from "react";
import { useKeydown } from "@/hooks/useKeydown";
import type { ViewToggles } from "./components/MapView";
import { allocate } from "./model/routing";
import type { TreeNode } from "./types";

export function useTreeView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePicks, setRoutePicks] = useState<TreeNode[]>([]);
  const [toggles, setToggles] = useState<ViewToggles>({ grid: true, next: true, pathwayNames: true });

  const route = useMemo(() => {
    if (!routeMode || routePicks.length < 2) return null;
    const r = allocate(routePicks[0], [routePicks[1]]);
    return r.ok ? r : null;
  }, [routeMode, routePicks]);

  const stopRoute = useCallback(() => { setRouteMode(false); setRoutePicks([]); }, []);
  useKeydown("Escape", stopRoute);

  const pick = useCallback((n: TreeNode) => {
    if (n.isCentre) return;  // the hub is not selectable
    setSelectedId(n.id);  // the Node card always follows the last click
    if (routeMode) setRoutePicks(p => (p.length >= 2 ? [n] : [...p, n]));
  }, [routeMode]);

  return {
    selectedId, routeMode, routePicks, route, toggles, pick, stopRoute,
    startRoute: () => { setRouteMode(true); setRoutePicks([]); },
    setToggle: (k: keyof ViewToggles, v: boolean) => setToggles(t => ({ ...t, [k]: v })),
    /** Clears the selection and route picks (new data source, or a level up starting). */
    clear: () => { setSelectedId(null); setRoutePicks([]); },
  };
}

export type TreeView = ReturnType<typeof useTreeView>;
