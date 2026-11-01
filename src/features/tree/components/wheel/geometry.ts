/** Map geometry: angles (degrees clockwise from the top) and radii → SVG coordinates and paths. */
import { APTITUDE_LABEL_SIZE, NODE_BASE, NODE_PER_SIZE } from "@/config/settings";
import type { TreeNode } from "@/features/tree/types";

const RAD = Math.PI / 180;
export const polar = (deg: number, r: number) => [r * Math.sin(deg * RAD), -r * Math.cos(deg * RAD)] as const;
export const nodeRadius = (n: TreeNode) => NODE_BASE + n.size * NODE_PER_SIZE;

export function sectorPath(start: number, width: number, r0: number, r1: number) {
  const [x0, y0] = polar(start, r1), [x1, y1] = polar(start + width, r1);
  const [x2, y2] = polar(start + width, r0), [x3, y3] = polar(start, r0);
  const large = width > 180 ? 1 : 0;
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/**
 * An arc for text to follow. On the top half it runs clockwise (text sits outside the rim, upright).
 * On the bottom half it runs the other way, so the text still reads left to right.
 */
export function labelArc(start: number, width: number, r: number) {
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
