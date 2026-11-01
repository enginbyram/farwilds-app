/** Map layer 2 — links and nodes. Changes with selection, unlocks and route. Nodes you can unlock next glow. */
import { memo } from "react";
import { CLUSTER_RADIUS, GLOW_BLUR } from "@/config/settings";
import { pairKey } from "@/core/cells";
import type { Route, TreeModel, TreeNode } from "@/features/tree/types";
import { gemReady, ownedMembers, type NextSteps } from "@/features/tree/model/unlock";
import { nodeColor } from "../colors";
import { PathwayOutline } from "./Pathway";
import { CentreNode, NodeShape, type Glow } from "./NodeShape";

interface GraphProps {
  model: TreeModel;
  owned: Set<TreeNode>;          // unlocked by the character (always includes the centre)
  selected: TreeNode | null;     // shown in the node card
  routePicks: TreeNode[];        // route mode: start / target
  route: Route | null;
  next: NextSteps;               // what glows (see features/tree/model/unlock.ts → nextSteps)
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
