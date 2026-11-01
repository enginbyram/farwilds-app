/** The map panel: SVG wheel, zoom buttons, view options, tooltip, route-mode banner, drag-and-drop. */
import { useState } from "react";
import { ZOOM_BUTTON_FACTOR } from "@/config/settings";
import type { Route, TreeModel, TreeNode } from "@/data/types";
import { usePanZoom } from "@/hooks/usePanZoom";
import type { NextSteps } from "@/model/character";
import { aptitudeColor } from "./colors";
import { Background, Graph } from "./Wheel";

export interface ViewToggles { grid: boolean; next: boolean; pathwayNames: boolean; }

interface Props {
  model: TreeModel;
  owned: Set<TreeNode>;
  selected: TreeNode | null;
  routeMode: boolean;
  routePicks: TreeNode[];
  route: Route | null;
  next: NextSteps;
  toggles: ViewToggles;
  setToggle: (k: keyof ViewToggles, v: boolean) => void;
  onPick: (n: TreeNode) => void;
  onFileDrop: (f: File) => void;
  onExitRoute: () => void;
}

export function MapView(p: Props) {
  const fullWidth = (p.model.maxRadius + 90) * 2;
  const pz = usePanZoom(fullWidth);
  const [tip, setTip] = useState<{ n: TreeNode; x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const hover = (n: TreeNode | null, e?: React.PointerEvent) => {
    if (n && e) {
      const box = (e.currentTarget as Element).closest(".map")!.getBoundingClientRect();
      setTip({ n, x: e.clientX - box.left, y: e.clientY - box.top });
    } else setTip(null);
  };

  const aptitudes = [...p.model.aptitudes.keys()].filter(a => a !== "Centre");

  return (
    <div className={`map${dragOver ? " dragover" : ""}${p.routeMode ? " map--route" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) p.onFileDrop(f); }}>
      <svg ref={pz.svgRef} className={pz.panning ? "panning" : ""} role="img" aria-label="Skill tree"
        viewBox={`${pz.view.x} ${pz.view.y} ${pz.view.w} ${pz.view.w}`} {...pz.handlers}>
        <Background model={p.model} showGrid={p.toggles.grid} />
        <Graph model={p.model} owned={p.owned} selected={p.selected} routePicks={p.routePicks}
          route={p.route} next={p.next} showNext={p.toggles.next} showPathwayNames={p.toggles.pathwayNames}
          onPick={p.onPick} onHover={hover} />
      </svg>

      {p.routeMode && (
        <div className="route-banner">
          <span>Route mode — click a start node, then a target.</span>
          <button className="btn btn--small" onClick={p.onExitRoute}>Exit (Esc)</button>
        </div>
      )}

      <div className="zoom-controls">
        <button className="btn" aria-label="Zoom in" onClick={() => pz.zoomBy(1 / ZOOM_BUTTON_FACTOR)}>+</button>
        <button className="btn" aria-label="Zoom out" onClick={() => pz.zoomBy(ZOOM_BUTTON_FACTOR)}>−</button>
        <button className="btn" aria-label="Reset view" onClick={pz.reset}>⟲</button>
      </div>

      <div className="map-options">
        <div className="legend">
          {aptitudes.map(a => <span key={a}><i style={{ background: aptitudeColor(a) }} />{a}</span>)}
          <span><i style={{ background: "var(--forbidden)" }} />Forbidden</span>
        </div>
        <div className="toggles">
          <label><input type="checkbox" checked={p.toggles.grid} onChange={e => p.setToggle("grid", e.target.checked)} /> Rings &amp; wedges</label>
          <label><input type="checkbox" checked={p.toggles.pathwayNames} onChange={e => p.setToggle("pathwayNames", e.target.checked)} /> Pathway names</label>
          <label><input type="checkbox" checked={p.toggles.next} onChange={e => p.setToggle("next", e.target.checked)} /> Glow next steps</label>
        </div>
      </div>

      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.n.name}</b><br />{tip.n.type} · {tip.n.points} pt{tip.n.points === 1 ? "" : "s"}
          {p.owned.has(tip.n) && <> · unlocked</>}
          {p.next.unlockable.has(tip.n) && <div className="tooltip__next">Can unlock now</div>}
          {p.next.blockedBy.has(tip.n) && <div className="tooltip__req">Needs {p.next.blockedBy.get(tip.n)!.name} first</div>}
          {p.next.requirements.has(tip.n) && <div className="tooltip__req">Required for {p.next.requirements.get(tip.n)!.map(n => n.name).join(", ")}</div>}
          <div className="tooltip__id">{tip.n.id}</div>
        </div>
      )}
    </div>
  );
}
