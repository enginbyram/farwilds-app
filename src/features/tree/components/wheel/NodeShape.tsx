/** One node on the map (circle, diamond or hexagon), and the centre hub. */
import { GLOW_GAP } from "@/config/settings";
import { isForbidden } from "@/features/tree/model/buildModel";
import type { TreeNode } from "@/features/tree/types";
import { nodeColor } from "../colors";
import { nodeRadius } from "./geometry";

export function CentreNode({ n }: { n: TreeNode }) {
  const s = nodeRadius(n);
  return <circle className="centre-node" cx={n.x} cy={n.y} r={s} fill={nodeColor(n)} stroke={nodeColor(n)} strokeWidth={1.1} pointerEvents="none" />;
}

type NodeState = "unlocked" | "reachable" | "locked";
export type Glow = "next" | "req" | null;

/**
 * Locked nodes are outline only (empty fill). Unlocked nodes are filled.
 * Locked nodes you can't reach yet are dimmed (--locked-opacity).
 * Cluster gems get an inner ring.
 */
export function NodeShape({ n, state, glow, onRoute, selected, onPick, onHover }: {
  n: TreeNode; state: NodeState; glow: Glow; onRoute: boolean; selected: boolean;
  onPick: (n: TreeNode) => void; onHover: (n: TreeNode | null, e?: React.PointerEvent) => void;
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
