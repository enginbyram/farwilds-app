/**
 * The map. Two layers:
 *  1. Background — aptitude sectors, rings, wedge lines, curved aptitude names (changes only with the workbook)
 *  2. Graph      — links and nodes (changes with selection / unlocks / route)
 * Node names are not drawn on the map — they appear in the hover tooltip. Pathway names are drawn
 * beside their outline. Nodes you can unlock next glow; so do the parent 2 nodes standing in the way.
 */
import { memo } from "react";
import {
  APTITUDE_LABEL_GAP, APTITUDE_LABEL_SIZE, CLUSTER_RADIUS, GLOW_BLUR, GLOW_GAP, NODE_BASE, NODE_PER_SIZE,
  PATHWAY_LABEL_GAP, PATHWAY_LABEL_SIZE, PATHWAY_PADDING,
} from "@/config/settings";
import { pairKey } from "@/data/cells";
import type { Route, TreeModel, TreeNode } from "@/data/types";
import { isForbidden } from "@/model/buildModel";
import { gemReady, ownedMembers, type NextSteps } from "@/model/character";
import { aptitudeColor, nodeColor } from "./colors";

const RAD = Math.PI / 180;
const polar = (deg: number, r: number) => [r * Math.sin(deg * RAD), -r * Math.cos(deg * RAD)] as const;
const nodeRadius = (n: TreeNode) => NODE_BASE + n.size * NODE_PER_SIZE;

function sectorPath(start: number, width: number, r0: number, r1: number) {
  const [x0, y0] = polar(start, r1), [x1, y1] = polar(start + width, r1);
  const [x2, y2] = polar(start + width, r0), [x3, y3] = polar(start, r0);
  const large = width > 180 ? 1 : 0;
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/**
 * An arc for text to follow. On the top half it runs clockwise (text sits outside the rim, upright).
 * On the bottom half it runs the other way, so the text still reads left to right.
 */
function labelArc(start: number, width: number, r: number) {
  const mid = ((start + width / 2) % 360 + 360) % 360;
  const bottom = mid > 90 && mid < 270;
  const large = width > 180 ? 1 : 0;
  if (!bottom) {
    const [x0, y0] = polar(start, r), [x1, y1] = polar(start + width, r);
    return `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  }
  const rb = r + APTITUDE_LABEL_SIZE * 0.8;   // baseline further out, letters point inward
  const [x0, y0] = polar(start + width, rb), [x1, y1] = polar(start, rb);
  return `M${x0},${y0}A${rb},${rb} 0 ${large} 0 ${x1},${y1}`;
}

// ── Layer 1 ──────────────────────────────────────────────────
export const Background = memo(function Background({ model, showGrid }: { model: TreeModel; showGrid: boolean }) {
  const rim = model.maxRadius + 40;
  const hub = Math.min(40, (model.ringRadius.get(1) ?? 100) / 2);
  const aptStarts = new Set([...model.aptitudes.values()].map(a => a.angleStart));
  const aptitudes = [...model.aptitudes.values()].filter(a => a.name !== "Centre");
  return (
    <g>
      {aptitudes.map(a => (
        <path key={a.name} d={sectorPath(a.angleStart, a.angleWidth, hub, rim)} fill={aptitudeColor(a.name)}
          style={{ fillOpacity: "var(--sector-opacity)" }} pointerEvents="none" />
      ))}
      {showGrid && (
        <g stroke="var(--line)" fill="none">
          {[...new Set(model.ringRadius.values())].filter(r => r > 0).map(r =>
            <circle key={`r${r}`} r={r} strokeDasharray="4 6" strokeWidth={1} />)}
          <circle r={rim} strokeWidth={1.2} />
          {[...model.classes.values()].filter(c => c.name !== "Centre").map(c => {
            const [x1, y1] = polar(c.wedgeStart, hub), [x2, y2] = polar(c.wedgeStart, rim);
            const major = aptStarts.has(c.wedgeStart);
            return <line key={c.name} x1={x1} y1={y1} x2={x2} y2={y2}
              strokeWidth={major ? 1.6 : 0.8} strokeDasharray={major ? undefined : "2 5"} />;
          })}
        </g>
      )}
      {/* Aptitude names follow the rim, centred on their sector */}
      <defs>
        {aptitudes.map(a => (
          <path key={a.name} id={`apt-arc-${a.name}`} d={labelArc(a.angleStart, a.angleWidth, rim + APTITUDE_LABEL_GAP)} />
        ))}
      </defs>
      {aptitudes.map(a => (
        <text key={a.name} className="aptitude-label" fontSize={APTITUDE_LABEL_SIZE} fill={aptitudeColor(a.name)}>
          <textPath href={`#apt-arc-${a.name}`} startOffset="50%" textAnchor="middle">{a.name.toUpperCase()}</textPath>
        </text>
      ))}
    </g>
  );
});

// ── Layer 2 ──────────────────────────────────────────────────
interface GraphProps {
  model: TreeModel;
  owned: Set<TreeNode>;          // unlocked by the character (always includes the centre)
  selected: TreeNode | null;     // shown in the node card
  routePicks: TreeNode[];        // route mode: start / target
  route: Route | null;
  next: NextSteps;               // what glows (see model/character.ts → nextSteps)
  showNext: boolean;
  showPathwayNames: boolean;
  onPick: (n: TreeNode) => void;
  onHover: (n: TreeNode | null, e?: React.PointerEvent) => void;
}

export const Graph = memo(function Graph({ model, owned, selected, routePicks, route, next, showNext, showPathwayNames, onPick, onHover }: GraphProps) {
  const onRoute = route?.owned ?? new Set<TreeNode>();
  const routeEdges = new Set<string>();
  route?.steps.forEach(s => s.path.forEach((n, i) => { if (i) routeEdges.add(pairKey(s.path[i - 1].id, n.id)); }));
  // Nodes you could unlock next: touching something you own, following the cluster rules.
  const reachable = new Set<TreeNode>();
  const memberOpen = (m: TreeNode) => !m.clusterGem || m.clusterGem.clusterMode !== "one" || ownedMembers(m.clusterGem, owned).length === 0;
  owned.forEach(n => n.neighbours.forEach(nb => {
    if (!owned.has(nb) && (!nb.isClusterGem || gemReady(nb, owned)) && memberOpen(nb)) reachable.add(nb);
    // Owning a cluster's entrance opens its members (a "choose one" cluster closes once one is taken).
    if (nb.isClusterGem && !owned.has(nb) && n.clusterGem !== nb) nb.clusterMembers.forEach(m => { if (!owned.has(m) && memberOpen(m)) reachable.add(m); });
  }));
  // Dashed requirement lines: the selected / route nodes, plus (with glow on) every node waiting on its parent 2.
  const showReqFor = new Set([selected, ...routePicks].filter((n): n is TreeNode => !!n?.required));
  if (showNext) next.blockedBy.forEach((_, n) => showReqFor.add(n));
  const glowOf = (n: TreeNode): Glow => !showNext ? null
    : next.unlockable.has(n) ? "next" : next.requirements.has(n) ? "req" : null;

  return (
    <g>
      <defs>
        <filter id="node-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation={GLOW_BLUR} />
        </filter>
      </defs>
      {model.nodes.filter(n => n.isPathwayGem && n.pathway.length > 1).map(g =>
        <PathwayOutline key={`pw-${g.id}`} gem={g} showName={showPathwayNames} />)}
      <g>
        {model.links.map(l => {
          const hot = routeEdges.has(pairKey(l.a.id, l.b.id));
          const allocated = owned.has(l.a) && owned.has(l.b) && !l.a.isCentre && !l.b.isCentre;
          const col = l.parent ? nodeColor(l.parent) : allocated ? nodeColor(l.b) : "var(--muted)";
          return (
            <line key={pairKey(l.a.id, l.b.id)} className="edge"
              x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
              stroke={hot ? "var(--route)" : col}
              strokeWidth={hot ? 2.2 : allocated ? 1.8 : 0.9}
              strokeOpacity={hot || allocated ? 1 : l.parent ? 0.7 : 0.5}
              strokeDasharray={allocated || hot ? undefined : l.type === "locked" ? "5 4" : l.type === "gate" ? "1 4" : undefined} />
          );
        })}
        {model.nodes.filter(n => n.isClusterGem && n.clusterMembers.length).map(g => (
          <circle key={`cl-${g.id}`} className="cluster-ring" cx={g.x} cy={g.y} r={CLUSTER_RADIUS}
            fill="none" stroke={nodeColor(g)} strokeOpacity={0.35} strokeWidth={0.8} pointerEvents="none" />
        ))}
        {[...showReqFor].map(n => (
          <line key={`req-${n.id}`} x1={n.x} y1={n.y} x2={n.required!.x} y2={n.required!.y}
            stroke="var(--route)" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.8} pointerEvents="none" />
        ))}
      </g>
      <g>
        {model.nodes.map(n => n.isCentre
          ? <CentreNode key={n.id} n={n} />
          : <NodeShape key={n.id} n={n} glow={glowOf(n)}
              state={owned.has(n) ? "unlocked" : reachable.has(n) || next.unlockable.has(n) ? "reachable" : "locked"}
              onRoute={onRoute.has(n) || routePicks.includes(n)} selected={selected === n}
              onPick={onPick} onHover={onHover} />)}
      </g>
    </g>
  );
});

/**
 * A thin capsule around a pathway's chain. Drawn as a wide stroke along the chain with a narrower
 * stroke cut out of it (a mask), so it follows bends and works on any background.
 */
function PathwayOutline({ gem, showName }: { gem: TreeNode; showName: boolean }) {
  const pts = gem.pathway;
  const d = pts.map((n, i) => `${i ? "L" : "M"}${n.x},${n.y}`).join("");
  const pad = PATHWAY_PADDING, line = 0.8;
  const xs = pts.map(n => n.x), ys = pts.map(n => n.y);
  const x0 = Math.min(...xs) - pad - 2, y0 = Math.min(...ys) - pad - 2;
  const w = Math.max(...xs) - x0 + pad + 2, h = Math.max(...ys) - y0 + pad + 2;
  const id = `pathway-mask-${gem.id}`;
  return (
    <g className="pathway-outline" pointerEvents="none">
      <mask id={id} maskUnits="userSpaceOnUse" x={x0} y={y0} width={w} height={h}>
        <path d={d} fill="none" stroke="white" strokeWidth={pad * 2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="black" strokeWidth={pad * 2 - line * 2} strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <path d={d} fill="none" stroke={nodeColor(gem)} strokeOpacity={0.55} strokeWidth={pad * 2}
        strokeLinecap="round" strokeLinejoin="round" mask={`url(#${id})`} />
      {showName && <PathwayName gem={gem} />}
    </g>
  );
}

/**
 * The pathway's name (clusters.json → name), written alongside its outline, reading along the chain.
 * It sits on the side facing away from the pathway's neighbours: if the chain leaves its entrance node
 * anticlockwise of the parent, the name goes on the anticlockwise side, and the other way round.
 * The text is flipped when needed so it is never upside down.
 */
function PathwayName({ gem }: { gem: TreeNode }) {
  const first = gem.pathway[0], last = gem.pathway[gem.pathway.length - 1];
  let ux = last.x - first.x, uy = last.y - first.y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len; uy /= len;
  const mx = (first.x + last.x) / 2, my = (first.y + last.y) / 2;
  // Clockwise direction around the wheel at the midpoint.
  const theta = Math.atan2(mx, -my);
  const cw = { x: Math.cos(theta), y: Math.sin(theta) };
  let nx = -uy, ny = ux;                          // one of the two sides of the chain
  if (nx * cw.x + ny * cw.y < 0) { nx = -nx; ny = -ny; }   // now (nx, ny) points clockwise
  const anchor = first.parent;
  const drift = anchor ? ((first.angle - anchor.angle + 540) % 360) - 180 : 0;
  const side = drift < -0.5 ? -1 : 1;             // anticlockwise of the parent → label anticlockwise
  const off = PATHWAY_PADDING + PATHWAY_LABEL_GAP + PATHWAY_LABEL_SIZE * 0.5;
  const x = mx + nx * side * off, y = my + ny * side * off;
  let rot = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (rot > 90) rot -= 180; else if (rot < -90) rot += 180;
  return (
    <text className="pathway-label" x={x} y={y} fontSize={PATHWAY_LABEL_SIZE} fill={nodeColor(gem)}
      textAnchor="middle" dominantBaseline="central" transform={`rotate(${rot} ${x} ${y})`}>
      {gem.pathwayName.toUpperCase()}
    </text>
  );
}

/** The hub: always owned, not interactive. */
function CentreNode({ n }: { n: TreeNode }) {
  const s = nodeRadius(n);
  return <circle className="centre-node" cx={n.x} cy={n.y} r={s} fill={nodeColor(n)} stroke={nodeColor(n)} strokeWidth={1.1} pointerEvents="none" />;
}

type NodeState = "unlocked" | "reachable" | "locked";
type Glow = "next" | "req" | null;

/**
 * Locked nodes are outline only (empty fill). Unlocked nodes are filled.
 * Locked nodes you can't reach yet are dimmed (--locked-opacity).
 * Cluster gems get an inner ring.
 */
function NodeShape({ n, state, glow, onRoute, selected, onPick, onHover }: {
  n: TreeNode; state: NodeState; glow: Glow; onRoute: boolean; selected: boolean;
  onPick: (n: TreeNode) => void; onHover: GraphProps["onHover"];
}) {
  const s = nodeRadius(n);
  const col = nodeColor(n);
  const common = {
    className: "shape",
    fill: state === "unlocked" ? col : "transparent",   // transparent (not "none") keeps the inside clickable
    stroke: onRoute ? "var(--route)" : col,
    strokeWidth: onRoute ? 1.8 : 1.1,
  };
  let shape: JSX.Element;
  if (n.shape === "diamond") {
    const d = s + 1;
    shape = <polygon {...common} points={`${n.x},${n.y - d} ${n.x + d},${n.y} ${n.x},${n.y + d} ${n.x - d},${n.y}`} />;
  } else if (n.shape === "hexagon") {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${n.x + s * Math.cos(a)},${n.y + s * Math.sin(a)}`;
    }).join(" ");
    shape = <polygon {...common} points={pts} />;
  } else {
    shape = <circle {...common} cx={n.x} cy={n.y} r={s} />;
  }
  return (
    <g className={`node node--${state}${glow ? ` node--glow-${glow}` : ""}`} tabIndex={0} role="button" aria-label={n.name} data-id={n.id}
      onClick={e => { e.stopPropagation(); onPick(n); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(n); } }}
      onPointerEnter={e => onHover(n, e)} onPointerLeave={() => onHover(null)} onFocus={() => onHover(n)}>
      {/* Glow: a blurred halo (pulses) + a crisp ring. Next = node colour, requirement = route colour, dashed. */}
      {glow && (
        <g className={`glow glow--${glow}`} pointerEvents="none">
          <circle className="glow__halo" cx={n.x} cy={n.y} r={s + GLOW_GAP} fill="none"
            stroke={glow === "next" ? col : "var(--route)"} strokeWidth={3} filter="url(#node-glow)" />
          <circle cx={n.x} cy={n.y} r={s + GLOW_GAP} fill="none" stroke={glow === "next" ? col : "var(--route)"}
            strokeWidth={0.7} strokeDasharray={glow === "req" ? "2 1.5" : undefined} />
        </g>
      )}
      {shape}
      {/* Cluster mark: all = inner ring, one = small inner dot, any = dashed inner ring; pathway gem = large inner dot */}
      {n.clusterMode === "one" &&
        <circle cx={n.x} cy={n.y} r={s * 0.3} fill={state === "unlocked" ? "var(--panel)" : col} pointerEvents="none" />}
      {n.isPathwayGem &&
        <circle cx={n.x} cy={n.y} r={s * 0.5} fill={state === "unlocked" ? "var(--panel)" : col} pointerEvents="none" />}
      {(n.clusterMode === "all" || n.clusterMode === "any") &&
        <circle cx={n.x} cy={n.y} r={s * 0.5} fill="none" stroke={state === "unlocked" ? "var(--panel)" : col} strokeWidth={0.9}
          strokeDasharray={n.clusterMode === "any" ? "1 1" : undefined} pointerEvents="none" />}
      {(n.type === "keystone" || isForbidden(n)) &&
        <circle cx={n.x} cy={n.y} r={s + 2.5} fill="none" stroke={col} strokeWidth={0.6} />}
      {selected &&
        <circle className="selection-ring" cx={n.x} cy={n.y} r={s + 4.5} fill="none" stroke="var(--ink)" strokeWidth={0.9} />}
    </g>
  );
}
