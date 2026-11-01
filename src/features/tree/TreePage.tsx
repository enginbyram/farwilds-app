/**
 * The Tree page: the map and its sidebar (character, selected node, route mode).
 * Its own state — selection, route mode, map toggles — lives in useTreeView.ts. `sidebarTop` lets the app put a
 * card on top of the sidebar (the Level Up card while a level up is in progress).
 */
import type { Character } from "@/features/character/state/useCharacter";
import type { TreeModel } from "./types";
import type { NextSteps } from "./model/unlock";
import { MapView } from "./components/MapView";
import { CharacterCard } from "./components/sidebar/CharacterCard";
import { NodeCard } from "./components/sidebar/NodeCard";
import { RouteCard } from "./components/sidebar/RouteCard";
import type { TreeView } from "./useTreeView";

export function TreePage({ model, ch, next, view, classLocked, onFileDrop, sidebarTop }: {
  model: TreeModel; ch: Character; next: NextSteps; view: TreeView; classLocked: boolean;
  onFileDrop: (f: File) => void; sidebarTop?: React.ReactNode;
}) {
  const selected = view.selectedId ? model.byId.get(view.selectedId) ?? null : null;
  return (
    <div className="main">
      <MapView model={model} owned={ch.owned} selected={selected} next={next}
        routeMode={view.routeMode} routePicks={view.routePicks} route={view.route}
        toggles={view.toggles} setToggle={view.setToggle}
        onPick={view.pick} onFileDrop={onFileDrop} onExitRoute={view.stopRoute} />
      <aside className="sidebar">
        {sidebarTop}
        <CharacterCard model={model} ch={ch} classLocked={classLocked} />
        <NodeCard node={selected} ch={ch} next={next} />
        <div className="sidebar__spacer" />
        <RouteCard active={view.routeMode} picks={view.routePicks} route={view.route} onStart={view.startRoute} onStop={view.stopRoute} />
      </aside>
    </div>
  );
}
