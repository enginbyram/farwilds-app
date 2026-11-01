/** A pathway (serial cluster): the thin outline around its chain, and its name beside it. */
import { PATHWAY_LABEL_GAP, PATHWAY_LABEL_SIZE, PATHWAY_PADDING } from "@/config/settings";
import type { TreeNode } from "@/features/tree/types";
import { nodeColor } from "../colors";

export function PathwayOutline({ gem, showName }: { gem: TreeNode; showName: boolean }) {
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
