/**
 * Unlock rules — pure logic, no UI.
 *
 * A node can be unlocked when:
 *   1. it isn't unlocked yet (the centre is always unlocked),
 *   2. it touches (shares a path with) a node you already own
 *      — for a cluster member, owning the node its gem hangs from (the entrance) also counts,
 *   3. its parent 2 (if any) is already unlocked,
 *   4. cluster rules (the gem's type sets the mode):
 *        all → the gem needs every member,
 *        one → only one member may be taken; the gem needs that one,
 *        any → members are unlimited; the gem needs at least one,
 *   5. you have enough points left.
 *
 * A node can be refunded when nothing you own depends on it:
 *   - everything else you own still connects back to your class start (or the centre) without it,
 *   - no owned node lists it as parent 2,
 *   - the cluster gem (if unlocked) would still have enough members without it.
 * Your class start and the centre are always owned. The start is paid for with the level-1 keystone point.
 */
import type { TreeNode } from "@/data/types";

export interface Verdict { ok: boolean; reason: string; }

/** A cluster is open once you own something next to its gem that isn't part of the cluster (its entrance). */
export function clusterOpen(gem: TreeNode, owned: Set<TreeNode>): boolean {
  return owned.has(gem) || gem.neighbours.some(nb => owned.has(nb) && nb.clusterGem !== gem);
}

/** How many members a gem needs before it can be unlocked. */
export const gemNeeds = (gem: TreeNode) => (gem.clusterMode === "all" ? gem.clusterMembers.length : 1);
export const ownedMembers = (gem: TreeNode, owned: Set<TreeNode>) => gem.clusterMembers.filter(m => owned.has(m));
export const gemReady = (gem: TreeNode, owned: Set<TreeNode>) => ownedMembers(gem, owned).length >= gemNeeds(gem);

/** Plain-language summary of a cluster rule, for the node card. */
export function clusterRuleText(n: TreeNode): string {
  const path = n.pathwayGem;
  if (path) {
    const step = path.pathway.indexOf(n) + 1, count = path.pathway.length;
    return n.isPathwayGem ? `Ends the ${count}-step pathway` : `Pathway to ${path.name} — step ${step} of ${count}`;
  }
  const gem = n.isClusterGem ? n : n.clusterGem;
  if (!gem) return "";
  const count = gem.clusterMembers.length;
  if (n.isClusterGem) {
    return gem.clusterMode === "all" ? `Needs all ${count} cluster nodes`
      : gem.clusterMode === "one" ? `Needs 1 of ${count} cluster nodes (choose one)`
      : `Needs at least 1 of ${count} cluster nodes`;
  }
  return gem.clusterMode === "one" ? `Part of ${gem.name} — choose one` : `Part of ${gem.name}`;
}

/**
 * Keystone points spent. The class start is unlocked automatically at level 1 and takes that
 * level's keystone point (Core Rulebook 2.2, 1 Nov): every character starts with one keystone on its tree.
 */
export function pointsUsed(owned: Set<TreeNode>, _start: TreeNode | null): number {
  let used = 0;
  owned.forEach(n => { if (!n.isCentre) used += n.points; });
  return used;
}

export function canUnlock(node: TreeNode, owned: Set<TreeNode>, pointsLeft: number): Verdict {
  if (node.isCentre) return { ok: false, reason: "The centre is always unlocked." };
  if (owned.has(node)) return { ok: false, reason: "Already unlocked." };
  if (node.isClusterGem) {
    const have = ownedMembers(node, owned).length, need = gemNeeds(node);
    if (have < need) return { ok: false, reason: node.clusterMode === "all"
      ? `Unlock the rest of the cluster first (${have}/${need}).`
      : "Unlock one of the cluster nodes first." };
  } else if (!node.neighbours.some(n => owned.has(n)) && !(node.clusterGem && clusterOpen(node.clusterGem, owned))) {
    return { ok: false, reason: "Not connected to anything you own yet." };
  }
  const gem = node.clusterGem;
  if (gem?.clusterMode === "one") {
    const chosen = ownedMembers(gem, owned)[0];
    if (chosen) return { ok: false, reason: `Only one can be chosen — you picked ${chosen.name}. Refund it to choose another.` };
  }
  if (node.required && !owned.has(node.required)) return { ok: false, reason: `Requires ${node.required.name} first.` };
  if (node.points > pointsLeft) return { ok: false, reason: `Needs ${node.points} point${node.points === 1 ? "" : "s"}, you have ${pointsLeft}.` };
  return { ok: true, reason: "" };
}

/**
 * What to do next — drives the glow on the map.
 *   unlockable   nodes you can unlock right now (every rule passes, points included)
 *   blockedBy    nodes that would be unlockable if their parent 2 were owned → that parent 2
 *   requirements those parent 2 nodes (glow in the requirement colour so you can find them)
 */
export interface NextSteps {
  unlockable: Set<TreeNode>;
  blockedBy: Map<TreeNode, TreeNode>;
  requirements: Map<TreeNode, TreeNode[]>;   // requirement → the nodes waiting for it
}

export function nextSteps(nodes: TreeNode[], owned: Set<TreeNode>, pointsLeft: number): NextSteps {
  const out: NextSteps = { unlockable: new Set(), blockedBy: new Map(), requirements: new Map() };
  for (const n of nodes) {
    if (n.isCentre || owned.has(n)) continue;
    if (canUnlock(n, owned, pointsLeft).ok) { out.unlockable.add(n); continue; }
    const req = n.required;
    if (!req || owned.has(req)) continue;
    // Pretend the requirement is owned (and paid for): would the node open then?
    if (canUnlock(n, new Set([...owned, req]), pointsLeft - req.points).ok) {
      out.blockedBy.set(n, req);
      out.requirements.set(req, [...(out.requirements.get(req) ?? []), n]);
    }
  }
  return out;
}

export function canRefund(node: TreeNode, owned: Set<TreeNode>, start: TreeNode | null): Verdict {
  if (!owned.has(node) || node.isCentre) return { ok: false, reason: "" };
  if (node === start) return { ok: false, reason: "Your class start can't be refunded." };
  const dependant = [...owned].find(n => n.required === node);
  if (dependant) return { ok: false, reason: `${dependant.name} requires it.` };
  const gem = node.clusterGem;
  if (gem && owned.has(gem) && ownedMembers(gem, owned).length - 1 < gemNeeds(gem))
    return { ok: false, reason: `Refund the cluster gem ${gem.name} first.` };
  // Is everything else still connected to the start / centre?
  const roots = [...owned].filter(n => n === start || n.isCentre);
  const seen = new Set<TreeNode>(roots);
  const queue = [...roots];
  const visit = (n: TreeNode) => { if (n !== node && owned.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); } };
  while (queue.length) {
    const cur = queue.pop()!;
    for (const nb of cur.neighbours) {
      visit(nb);
      // An open cluster (entered from outside) connects all of its members.
      if (nb.isClusterGem && (!owned.has(nb) || nb === node) && cur.clusterGem !== nb) nb.clusterMembers.forEach(visit);
    }
  }
  const stranded = [...owned].find(n => n !== node && !seen.has(n));
  if (stranded) return { ok: false, reason: `${stranded.name} would be cut off.` };
  return { ok: true, reason: "" };
}
