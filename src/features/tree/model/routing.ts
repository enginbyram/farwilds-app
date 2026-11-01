/**
 * Route costs.
 *
 * allocate(start, targets) answers: "starting from `start`, what is the cheapest set of
 * nodes I must buy to own every target — and every node they require (parent2_id)?"
 *
 * It works greedily: reach each target from everything already owned (owned nodes are free),
 * then add any requirement picked up on the way, and repeat until nothing is missing.
 * The starting node itself costs nothing.
 */
import type { Route, RouteStep, TreeNode } from "@/features/tree/types";

/** Cheapest path from any owned node to `target`. Dijkstra with node costs. */
export function reach(owned: Set<TreeNode>, target: TreeNode): { cost: number; path: TreeNode[] } | null {
  if (owned.has(target)) return { cost: 0, path: [target] };
  const dist = new Map<TreeNode, number>();
  const prev = new Map<TreeNode, TreeNode>();
  const done = new Set<TreeNode>();
  owned.forEach(n => dist.set(n, 0));

  for (;;) {
    let u: TreeNode | null = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) { best = d; u = n; }
    if (!u) return null;
    if (u === target) break;
    done.add(u);
    for (const v of u.neighbours) {
      // An unowned cluster gem is a free passage into its own cluster (its real cost is added in allocate).
      const nd = best + (owned.has(v) || v.isClusterGem ? 0 : v.points);
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); }
    }
  }
  const path = [target];
  while (!owned.has(path[0])) path.unshift(prev.get(path[0])!);
  return { cost: dist.get(target)!, path };
}

export function allocate(start: TreeNode, targets: TreeNode[]): Route {
  const owned = new Set<TreeNode>([start]);
  const steps: RouteStep[] = [];
  const queue = [...targets];
  let cost = 0;
  /** Members a gem still needs: all of them, or (choose one / open) the single cheapest one. */
  const membersNeeded = (gem: TreeNode): TreeNode[] => {
    if (gem.clusterMode === "all") return gem.clusterMembers;
    if (gem.clusterMembers.some(m => owned.has(m))) return [];
    const costed = gem.clusterMembers.map(m => ({ m, c: reach(owned, m)?.cost ?? Infinity })).sort((a, b) => a.c - b.c);
    return costed.length ? [costed[0].m] : [];
  };
  targets.forEach(t => { if (t.isClusterGem) membersNeeded(t).forEach(m => { if (!queue.includes(m)) queue.unshift(m); }); });

  const need = (r: TreeNode) => { if (!owned.has(r) && !queue.includes(r)) queue.push(r); };
  const addRequirementOf = (n: TreeNode) => {
    if (n.required) need(n.required);
    if (n.isClusterGem) membersNeeded(n).forEach(need);
  };
  addRequirementOf(start);

  for (let i = 0; i < queue.length; i++) {
    const target = queue[i];
    const r = reach(owned, target);
    if (!r) return { ok: false, cost, steps, owned, unreachable: target };
    if (r.path.length < 2) continue;
    // Walking through an unowned gem into its own cluster is free; going anywhere else through it unlocks it.
    const added = r.path.slice(1).filter((n, i, arr) => !(n.isClusterGem && !owned.has(n) && arr[i + 1]?.clusterGem === n));
    const stepCost = added.reduce((t, n) => t + n.points, 0);
    added.forEach(n => owned.add(n));
    cost += stepCost;
    const isRequirement = !targets.includes(target);
    steps.push({
      target, cost: stepCost, path: r.path, isRequirement,
      requiredBy: isRequirement ? [...owned, ...queue].find(n => n.required === target || (n.isClusterGem && n.clusterMembers.includes(target))) ?? null : null,
    });
    added.forEach(addRequirementOf);
  }
  return { ok: true, cost, steps, owned };
}
