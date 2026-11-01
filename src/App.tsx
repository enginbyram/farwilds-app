/**
 * App state lives here:
 *   data       — the JSON database (src/data/tree/), or an imported .xlsx while you're viewing one
 *   model      — the laid-out tree (rebuilt when the data changes)
 *   character  — name, class, unlocked nodes (see hooks/useCharacter.ts)
 *   next       — what you can unlock next (drives the glow)
 *   selected   — the node shown in the Node card (default mode)
 *   routeMode  — when on, map clicks pick a route start/target instead of selecting
 *   sheet/rules — the character sheet and the rules it is computed with (Character, Creator, Dev mode)
 *   levelUp    — a level up in progress: tree points = the new level until it is confirmed or cancelled
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DATABASE } from "@/data/loadTree";
import { loadFromFile } from "@/data/loadWorkbook";
import type { TreeData, TreeNode } from "@/data/types";
import { buildModel } from "@/model/buildModel";
import { nextSteps } from "@/model/character";
import { allocate } from "@/model/routing";
import { useCharacter } from "@/hooks/useCharacter";
import { Header, type Page } from "@/components/Header";
import { CharacterPage } from "@/components/CharacterPage";
import { CharacterCreator, type NewCharacter } from "@/components/CharacterCreator";
import { LevelUpCard, LevelUpScreen, type PendingLevelUp } from "@/components/LevelUp";
import { DevPanel } from "@/components/DevPanel";
import { CombatPage } from "@/components/CombatPage";
import { useRules } from "@/hooks/useRules";
import { useSheet } from "@/hooks/useSheet";
import { computeCharacter } from "@/rules/compute";
import { downloadJson, makeCharacterFile, parseCharacterFile, slug } from "@/data/characterFile";
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
  const rs = useRules();
  const sh = useSheet();
  const [levelUp, setLevelUp] = useState<PendingLevelUp | null>(() => {
    try { const raw = localStorage.getItem("levelUp"); return raw ? (JSON.parse(raw) as PendingLevelUp) : null; } catch { return null; }
  });
  useEffect(() => {
    try { if (levelUp) localStorage.setItem("levelUp", JSON.stringify(levelUp)); else localStorage.removeItem("levelUp"); } catch { /* storage blocked */ }
  }, [levelUp]);
  // Tree points = keystone points = level (the new level while a level up is in progress).
  const ch = useCharacter(model, source, levelUp ? levelUp.to : sh.sheet.level);

  // ── Character page ──
  const [page, setPage] = useState<Page>(() => {
    try { return (localStorage.getItem("page") as Page) || "tree"; } catch { return "tree"; }
  });
  const [devMode, setDevMode] = useState(() => {
    try { return localStorage.getItem("devMode") === "1"; } catch { return false; }
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { localStorage.setItem("page", page); localStorage.setItem("devMode", devMode ? "1" : "0"); } catch { /* storage blocked */ }
  }, [page, devMode]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(""), 4000); return () => clearTimeout(t); }, [message]);
  const computed = useMemo(() => computeCharacter(rs.rules, sh.sheet, ch.className), [rs.rules, sh.sheet, ch.className]);

  const saveCharacter = () => {
    downloadJson(makeCharacterFile(ch.name, ch.className, sh.sheet, source, ch.unlockedIds, computed), `${slug(ch.name)}.farwilds.json`);
    setMessage(`Saved ${ch.name}.`);
  };
  const startLevelUp = () => {
    if (!levelUp) setLevelUp({ from: sh.sheet.level, to: sh.sheet.level + 1, snapshot: ch.unlockedIds });
    setSelectedId(null); stopRoute();
    setPage("tree");
  };
  const cancelLevelUp = () => {
    if (levelUp) ch.restore({ name: ch.name, className: ch.className, unlocked: levelUp.snapshot });
    setLevelUp(null);
    setPage("character");
  };
  const confirmLevelUp = (next: typeof sh.sheet) => {
    sh.setSheet(next);
    setLevelUp(null);
    setPage("character");
    setMessage(`${ch.name} reached level ${next.level}.`);
  };
  const createCharacter = (n: NewCharacter) => {
    if (ch.used > 0 && !window.confirm(`Replace ${ch.name}? Their ${ch.used} tree points will be cleared. Save them first if you want to keep them.`)) return;
    ch.restore({ name: n.name, className: n.coreClass, unlocked: [] });
    sh.setSheet(n.sheet);
    setLevelUp(null);
    setPage("character");
    setMessage(`Created ${n.name}.`);
  };
  const loadCharacter = async (f: File) => {
    try {
      const file = parseCharacterFile(await f.text());
      const missing = file.tree.unlocked.filter(id => !model.byId.has(id)).length;
      ch.restore({ name: file.name, className: file.coreClass, unlocked: file.tree.unlocked });
      sh.setSheet(file.sheet);
      setLevelUp(null);
      const notes = [
        !model.classes.has(file.coreClass) ? `class "${file.coreClass}" isn't in this workbook` : "",
        missing ? `${missing} node${missing === 1 ? "" : "s"} not in this workbook were skipped` : "",
      ].filter(Boolean);
      setMessage(`Loaded ${file.name || f.name}${notes.length ? ` — ${notes.join("; ")}` : "."}`);
    } catch (e) {
      setMessage(`Couldn't load "${f.name}": ${(e as Error).message}`);
    }
  };
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

  const treeView = (
    <div className="main">
      <MapView model={model} owned={ch.owned} selected={selected} next={next}
        routeMode={routeMode} routePicks={routePicks} route={route}
        toggles={toggles} setToggle={(k, v) => setToggles(t => ({ ...t, [k]: v }))}
        onPick={pick} onFileDrop={openFile} onExitRoute={stopRoute} />
      <aside className="sidebar">
        {levelUp && <LevelUpCard pending={levelUp} ch={ch} onContinue={() => setPage("levelup")} onCancel={cancelLevelUp} />}
        <CharacterCard model={model} ch={ch} classLocked={!devMode} />
        <NodeCard node={selected} ch={ch} next={next} />
        <div className="sidebar__spacer" />
        <RouteCard active={routeMode} picks={routePicks} route={route}
          onStart={() => { setRouteMode(true); setRoutePicks([]); }} onStop={stopRoute} />
      </aside>
    </div>
  );

  return (
    <div className="app">
      <Header source={error || source} warnings={model.warnings} onFile={openFile} theme={theme}
        onBackToDatabase={imported ? () => { setImported(null); setSelectedId(null); setRoutePicks([]); } : null}
        onToggleTheme={() => setTheme(t => (t === "system" ? "light" : t === "light" ? "dark" : "system"))}
        page={page} onPage={setPage} onSaveCharacter={saveCharacter} onLoadCharacter={loadCharacter}
        devMode={devMode} onToggleDev={() => setDevMode(d => !d)} message={message} />
      {page === "tree" ? treeView : (
        <div className={`charmain${devMode && page !== "combat" ? " charmain--dev" : ""}`}>
          {devMode && page !== "combat" && <DevPanel rs={rs} />}
          <div className={`charmain__page${page === "combat" ? " charmain__page--full" : ""}`}>
            {page === "character" && <CharacterPage rules={rs.rules} sh={sh} ch={ch} c={computed} devMode={devMode}
                onCreate={() => setPage("creator")} onLevelUp={startLevelUp} />}
            {page === "creator" && <CharacterCreator key={rs.rules.version} rules={rs.rules} onCreate={createCharacter} onCancel={() => setPage("character")} />}
            {page === "combat" && <CombatPage key={`${ch.name}|${sh.sheet.level}|${ch.used}`} rules={rs.rules} c={computed} ch={ch} devMode={devMode} />}
            {page === "levelup" && (levelUp
              ? <LevelUpScreen rules={rs.rules} model={model} ch={ch} sheet={sh.sheet} pending={levelUp} onConfirm={confirmLevelUp} onCancel={cancelLevelUp} />
              : <p className="note">No level up in progress. Press Level up on the Character page to start one.</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
