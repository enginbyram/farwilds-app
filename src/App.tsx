/**
 * App state lives here:
 *   data       — the JSON database (src/data/tree/), or an imported .xlsx while you're viewing one
 *   model      — the laid-out tree (rebuilt when the data changes)
 *   character  — name, class, unlocked nodes (see hooks/useCharacter.ts)
 *   next       — what you can unlock next (drives the glow)
 *   selected   — the node shown in the Node card (default mode)
 *   routeMode  — when on, map clicks pick a route start/target instead of selecting
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DATABASE } from "@/data/loadTree";
import { loadFromFile } from "@/data/loadWorkbook";
import type { TreeData, TreeNode } from "@/data/types";
import { buildModel } from "@/model/buildModel";
import { nextSteps } from "@/model/character";
import { allocate } from "@/model/routing";
import { useCharacter } from "@/hooks/useCharacter";
import { Header } from "@/components/Header";
import { MapView, type ViewToggles } from "@/components/MapView";
import { CharacterCard, NodeCard, RouteCard } from "@/components/Panels";

type Theme = "system" | "light" | "dark";
const DATABASE_NAME = "JSON database";

export default function App() {
  // DATABASE is re-read by Vite whenever a JSON file is saved, so editing a file redraws the tree.
  const [imported, setImported] = useState<{ data: TreeData; name: string } | null>(null);
  const data = imported?.data ?? DATABASE;
  const source = imported?.name ?? DATABASE_NAME;
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePicks, setRoutePicks] = useState<TreeNode[]>([]);
  const [toggles, setToggles] = useState<ViewToggles>({ grid: true, next: true, pathwayNames: true });
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem("theme") as Theme) || "system"; } catch { return "system"; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch { /* storage blocked: fine */ }
  }, [theme]);

  const model = useMemo(() => buildModel(data), [data]);
  const ch = useCharacter(model, source);
  const next = useMemo(() => nextSteps(model.nodes, ch.owned, ch.left), [model, ch.owned, ch.left]);
  const selected = selectedId ? model.byId.get(selectedId) ?? null : null;

  const route = useMemo(() => {
    if (!routeMode || routePicks.length < 2) return null;
    const r = allocate(routePicks[0], [routePicks[1]]);
    return r.ok ? r : null;
  }, [routeMode, routePicks]);

  const stopRoute = useCallback(() => { setRouteMode(false); setRoutePicks([]); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stopRoute(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopRoute]);

  const openFile = useCallback(async (f: File) => {
    try {
      setImported({ data: await loadFromFile(f, DATABASE), name: f.name });
      setError(""); setSelectedId(null); setRoutePicks([]);
    } catch (e) {
      setError(`Couldn't read "${f.name}": ${(e as Error).message}`);
    }
  }, []);

  const pick = useCallback((n: TreeNode) => {
    if (n.isCentre) return;  // the hub is not selectable
    setSelectedId(n.id);  // the Node card always follows the last click
    if (routeMode) setRoutePicks(p => (p.length >= 2 ? [n] : [...p, n]));
  }, [routeMode]);

  return (
    <div className="app">
      <Header source={error || source} warnings={model.warnings} onFile={openFile} theme={theme}
        onBackToDatabase={imported ? () => { setImported(null); setSelectedId(null); setRoutePicks([]); } : null}
        onToggleTheme={() => setTheme(t => (t === "system" ? "light" : t === "light" ? "dark" : "system"))} />
      <div className="main">
        <MapView model={model} owned={ch.owned} selected={selected} next={next}
          routeMode={routeMode} routePicks={routePicks} route={route}
          toggles={toggles} setToggle={(k, v) => setToggles(t => ({ ...t, [k]: v }))}
          onPick={pick} onFileDrop={openFile} onExitRoute={stopRoute} />
        <aside className="sidebar">
          <CharacterCard model={model} ch={ch} />
          <NodeCard node={selected} ch={ch} next={next} />
          <div className="sidebar__spacer" />
          <RouteCard active={routeMode} picks={routePicks} route={route}
            onStart={() => { setRouteMode(true); setRoutePicks([]); }} onStop={stopRoute} />
        </aside>
      </div>
    </div>
  );
}
