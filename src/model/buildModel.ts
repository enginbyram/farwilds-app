/**
 * Turns raw workbook rows into a laid-out tree.
 *
 * Layout rules (same as the Excel README):
 *  - Root nodes (no parent): class + ring + slot → a share of the class wedge.
 *  - Derived nodes: a share of parent_id's slice, one ring further out (unless ring is typed).
 *  - parent2_id is a requirement only: it never moves the node and is never a path.
 *  - Nodes on the same ring are pushed apart so nothing overlaps.
 */
import {
  BAND_NODE_SPACE, CENTRE_TYPES, CLUSTER_CLEARANCE, CLUSTER_GEM_SIZE, CLUSTER_GEM_TYPES, CLUSTER_RADIUS, FORBIDDEN_TYPES, MIN_NODE_SPACING, NON_PATH_LINK_TYPES, ON_RING_TYPES, PATHWAY_GEM_TYPES, RADIUS_SCALE,
} from "@/config/settings";
import { number, normAngle, pairKey, text } from "@/data/cells";
import type {
  AptitudeInfo, AscendancyInfo, BonusDef, BuildInfo, ClassInfo, ClusterDef, Shape, TreeData, TreeLink, TreeModel, TreeNode, WorldDef,
} from "@/data/types";

interface Pending extends TreeNode {
  parentId: string;
  requiredId: string;
  typedClass: string;
  typedRing: string;
  rawCost: string;
  rawDepth: string;
  bandDepth: number;
  placed: boolean;
}

export function buildModel(data: TreeData): TreeModel {
  const warnings: string[] = [...(data.warnings ?? [])];
  const W = data.world;

  // ── Lookups ────────────────────────────────────────────────
  const classes = new Map<string, ClassInfo>();
  for (const [name, c] of Object.entries(W.classes ?? {})) {
    classes.set(name, {
      name, aptitude: text(c.aptitude), wedgeStart: number(c.wedgeStart, 0),
      wedgeWidth: number(c.wedgeWidth, 40), startNodeId: text(c.startNode),
    });
  }
  const aptitudes = new Map<string, AptitudeInfo>();
  for (const [name, a] of Object.entries(W.aptitudes ?? {})) {
    aptitudes.set(name, {
      name, angleStart: number(a.angleStart, 0), angleWidth: number(a.angleWidth, 90),
      gateNodeId: text(a.gateNode), opposite: text(a.opposite),
    });
  }
  const ringRadius = new Map<number, number>();
  for (const r of W.rings ?? []) if (text(r.ring) !== "") ringRadius.set(number(r.ring, 0), number(r.radius, 0) * RADIUS_SCALE);
  const nodeTypes = new Map(Object.entries(W.nodeTypes ?? {}));
  const clusterDefs = new Map<string, ClusterDef>(Object.entries(data.clusters ?? {}));
  const gems = data.gems ?? {};

  // ── Nodes ──────────────────────────────────────────────────
  const nodes: Pending[] = data.nodes.filter(r => text(r.id)).map((r, row) => ({
    id: text(r.id), name: text(r.name) || text(r.id), type: text(r.type) || "small", row,
    className: "", aptitude: "?", ring: 0, slot: number(r.slot, 1),
    angleOverride: text(r.angle) === "" ? null : number(r.angle, 0),
    points: 1, requirementText: text(r.requirement), cluster: text(r.cluster),
    wikiPage: text(r.wiki), notes: text(r.notes), sourceFile: text(r.file),
    description: text(gems[text(r.id)]?.description), flavor: text(gems[text(r.id)]?.flavor),
    bonuses: (gems[text(r.id)]?.bonuses ?? []).map(b => formatBonus(b, W, text(r.id), warnings)),
    bonusDefs: gems[text(r.id)]?.bonuses ?? [],
    parent: null, required: null,
    angle: 0, sliceStart: 0, sliceWidth: 0, radius: 0, x: 0, y: 0,
    size: 1, shape: "circle", neighbours: [], clusterMembers: [], clusterGem: null,
    isCentre: CENTRE_TYPES.includes(text(r.type).toLowerCase()), isClusterGem: text(r.type).toLowerCase() in CLUSTER_GEM_TYPES,
    clusterMode: CLUSTER_GEM_TYPES[text(r.type).toLowerCase()] ?? null,
    isPathwayGem: PATHWAY_GEM_TYPES.includes(text(r.type).toLowerCase()), pathway: [], pathwayGem: null, pathwayName: "",
    parentId: text(r.parent), requiredId: text(r.requires),
    typedClass: text(r.class), typedRing: text(r.ring), rawCost: text(r.cost), rawDepth: text(r.depth), bandDepth: 0, placed: false,
    onRing: ON_RING_TYPES.some(t => text(r.type).toLowerCase().includes(t)),
  }));

  const byId = new Map<string, Pending>();
  for (const n of nodes) {
    if (byId.has(n.id)) warnings.push(`Duplicate node id: ${n.id}`);
    byId.set(n.id, n);
  }

  // Resolve parents (with loop protection)
  for (const n of nodes) {
    for (const [field, id] of [["parent", n.parentId], ["required", n.requiredId]] as const) {
      if (!id) continue;
      const p = byId.get(id);
      if (!p) warnings.push(`${n.id}: ${field === "parent" ? "parent_id" : "parent2_id"} ${id} doesn't exist`);
      else if (p === n) warnings.push(`${n.id} is its own parent`);
      else n[field] = p;
    }
  }
  const state = new Map<Pending, 1 | 2>();
  const resolve = (n: Pending): void => {
    if (state.get(n) === 2) return;
    state.set(n, 1);
    const p = n.parent as Pending | null;
    if (p) {
      if (state.get(p) === 1) { warnings.push(`Parent loop between ${n.id} and ${p.id}`); n.parent = null; }
      else resolve(p);
    }
    const parent = n.parent as Pending | null;
    n.className = n.typedClass || parent?.className || "";
    // On-ring nodes step out one ring from their parent; band nodes stay in the band after the parent's ring.
    n.ring = n.typedRing !== "" ? number(n.typedRing, 0) : parent ? (n.onRing ? parent.ring + 1 : parent.ring) : 0;
    // Position inside the band: 0 for the first band node, +1 for each band node chained after it.
    n.bandDepth = !n.onRing && parent && !parent.onRing && parent.ring === n.ring ? (parent as Pending).bandDepth + 1 : 0;
    state.set(n, 2);
  };
  nodes.forEach(resolve);

  // ── Clusters: a gem and the nodes that share its cluster_id ──
  for (const gem of nodes.filter(n => n.isClusterGem)) {
    if (!gem.cluster) { warnings.push(`${gem.id}: cluster gem without a cluster_id`); continue; }
    gem.clusterMembers = nodes.filter(n => n !== gem && n.cluster === gem.cluster && !n.isClusterGem)
      .sort((a, b) => a.slot - b.slot || a.row - b.row);
    if (!gem.clusterMembers.length) warnings.push(`${gem.id}: cluster "${gem.cluster}" has no other nodes`);
    gem.clusterMembers.forEach(m => { m.clusterGem = gem; });
  }
  const inCluster = (n: Pending) => !!n.clusterGem;

  // ── Pathways: a gem and the chain of same-cluster nodes leading up to it ──
  for (const gem of nodes.filter(n => n.isPathwayGem)) {
    if (!gem.cluster) { warnings.push(`${gem.id}: pathway gem without a cluster_id`); continue; }
    const chain: TreeNode[] = [gem];
    for (let p = gem.parent; p && p.cluster === gem.cluster && !p.isPathwayGem; p = p.parent) chain.unshift(p);
    if (chain.length < 2) warnings.push(`${gem.id}: pathway "${gem.cluster}" has no nodes before the gem (its parent needs the same cluster_id)`);
    gem.pathway = chain;
    gem.pathwayName = text(clusterDefs.get(gem.cluster)?.name) || gem.name;
    chain.forEach(m => { m.pathwayGem = gem; });
    const stray = nodes.filter(n => n.cluster === gem.cluster && !chain.includes(n));
    if (stray.length) warnings.push(`Pathway "${gem.cluster}": ${stray.map(n => n.id).join(", ")} share its cluster_id but aren't on the chain to ${gem.id}`);
  }

  // ── Sibling groups & slot checks ───────────────────────────
  const groupKey = (n: Pending) => `${n.parent ? `p|${n.parent.id}` : `r|${n.className}|${n.ring}`}|${n.onRing ? "ring" : "band"}`;
  const groups = new Map<string, Pending[]>();
  for (const n of nodes) {
    if (n.angleOverride !== null || inCluster(n)) continue;   // cluster members are arranged around their gem
    const k = groupKey(n);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(n);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.slot - b.slot || a.row - b.row);
    const used = new Map<number, number>();
    g.forEach(n => used.set(n.slot, (used.get(n.slot) ?? 0) + 1));
    const where = g[0].parent ? `Children of ${g[0].parent.name}` : `${g[0].className} ring ${g[0].ring}`;
    for (const [slot, count] of used)
      if (count > 1) warnings.push(`${where}: slot ${slot} used ${count} times. Spread out by row order; give them slots 1–${g.length}.`);
  }

  // ── Placement ──────────────────────────────────────────────
  const place = (n: Pending): void => {
    if (n.placed) return;
    n.placed = true;
    if (n.parent) place(n.parent as Pending);
    if (n.angleOverride !== null) {
      n.angle = normAngle(n.angleOverride); n.sliceStart = n.angle - 5; n.sliceWidth = 10; return;
    }
    const siblings = groups.get(groupKey(n))!;
    const i = siblings.indexOf(n);
    if (n.parent) {
      const w = n.parent.sliceWidth / siblings.length;
      n.sliceStart = n.parent.sliceStart + i * w; n.sliceWidth = w;
    } else {
      const c = classes.get(n.className);
      if (!c) { warnings.push(`${n.id}: unknown class "${n.className}"`); n.sliceStart = -5; n.sliceWidth = 10; }
      else { const w = c.wedgeWidth / siblings.length; n.sliceStart = c.wedgeStart + i * w; n.sliceWidth = w; }
    }
    n.angle = normAngle(n.sliceStart + n.sliceWidth / 2);
  };

  /** Half the room a node needs around it: a cluster gem needs its whole cluster plus clearance. */
  const hasCluster = (n: TreeNode) => n.isClusterGem && n.clusterMembers.length > 0;
  const halfWidth = (n: TreeNode) => (hasCluster(n) ? CLUSTER_RADIUS + CLUSTER_CLEARANCE : MIN_NODE_SPACING / 2);

  /** Push nodes on one ring apart until neighbours have room (clusters get more). */
  const relax = (list: Pending[], radius: number): void => {
    if (list.length < 2 || radius <= 0) return;
    const deg = (units: number) => (units / radius) * (180 / Math.PI);
    const total = list.reduce((t, n) => t + 2 * deg(halfWidth(n)), 0);
    const squeeze = Math.min(1, 324 / total);   // never ask for more than 90% of the circle
    const gapOf = (a: Pending, b: Pending) => deg(halfWidth(a) + halfWidth(b)) * squeeze;
    for (let it = 0; it < 120; it++) {
      list.sort((a, b) => a.angle - b.angle);
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i], b = list[(i + 1) % list.length];
        let d = b.angle - a.angle;
        if (i === list.length - 1) d += 360;
        const gap = gapOf(a, b);
        if (d < gap - 1e-6) {
          const push = (gap - d) / 2;
          if (a.angleOverride === null) { a.angle = normAngle(a.angle - push); a.sliceStart -= push; }
          if (b.angleOverride === null) { b.angle = normAngle(b.angle + push); b.sliceStart += push; }
          moved = true;
        }
      }
      if (!moved) break;
    }
  };


  // ── Radius: on the ring line, or inside the band after it ──
  const ringR = (k: number) => ringRadius.get(k);
  // Each band node claims room along its chain; a cluster gem claims room for its whole cluster.
  // A position is split into cluster room (kept as-is when possible) and ordinary room (stretched or
  // squeezed so the busiest chain fills its band).
  const bandHalf = (n: TreeNode) => (hasCluster(n) ? CLUSTER_RADIUS + CLUSTER_CLEARANCE : BAND_NODE_SPACE / 2);
  type Pos = { c: number; f: number };
  const add = (p: Pos, n: TreeNode): Pos => (hasCluster(n) ? { c: p.c + bandHalf(n), f: p.f } : { c: p.c, f: p.f + bandHalf(n) });
  const bandPos = new Map<Pending, Pos>();
  const posOf = (n: Pending): Pos => {
    if (bandPos.has(n)) return bandPos.get(n)!;
    const p = n.parent as Pending | null;
    const inChain = n.bandDepth > 0 && p && !inCluster(p);
    const pos = add(inChain ? add(posOf(p!), p!) : { c: 0, f: BAND_NODE_SPACE / 2 }, n);
    bandPos.set(n, pos);
    return pos;
  };
  const bandWidth = (ring: number) => {
    const r0 = ringR(ring) ?? 0;
    return (ringR(ring + 1) ?? r0 + (r0 - (ringR(ring - 1) ?? 0) || 100 * RADIUS_SCALE)) - r0;
  };
  // Per ring: kc scales cluster room, kf scales ordinary room.
  const bandScale = new Map<number, { kc: number; kf: number }>();
  const crowded = new Map<number, string>();
  for (const n of nodes) {
    if (n.onRing || inCluster(n) || n.rawDepth !== "") continue;
    const after = add(posOf(n), n);
    const end = { c: after.c, f: after.f + BAND_NODE_SPACE / 2 };   // + room before the next ring
    const w = bandWidth(n.ring);
    let { kc, kf } = bandScale.get(n.ring) ?? { kc: 1, kf: Infinity };
    kf = Math.min(kf, (w - end.c * kc) / end.f);
    if (kf < 0.6) {   // not enough room even for clusters: squeeze everything evenly
      crowded.set(n.ring, `Ring ${n.ring} band is crowded at ${n.name} (needs ${Math.round(end.c + end.f)}, has ${Math.round(w)}). Raise RADIUS_SCALE or the ring radii.`);
      kc = kf = Math.min(kc, w / (end.c + end.f));
    }
    bandScale.set(n.ring, { kc, kf });
  }
  for (const n of nodes) {
    if (inCluster(n)) continue;   // arranged around their gem below
    const r0 = ringR(n.ring);
    if (r0 === undefined) { warnings.push(`${n.id}: unknown ring ${n.ring}`); n.radius = 0; continue; }
    if (n.onRing) { n.radius = r0; continue; }
    const w = bandWidth(n.ring);
    if (n.rawDepth !== "") { n.radius = r0 + w * Math.min(1, Math.max(0, number(n.rawDepth, 0.5))); continue; }
    const { kc, kf } = bandScale.get(n.ring)!, p = posOf(n);
    n.radius = r0 + p.c * kc + p.f * kf;
  }
  warnings.push(...crowded.values());

  // Place outward, one circle (same radius) at a time, then push neighbours apart on that circle.
  const circles = new Map<number, Pending[]>();
  for (const n of nodes) {
    if (inCluster(n)) continue;
    const k = Math.round(n.radius * 10) / 10; if (!circles.has(k)) circles.set(k, []); circles.get(k)!.push(n);
  }
  // Keep nodes on different circles out of each other's cluster space (sideways nudge along their circle).
  const placedSoFar: Pending[] = [];
  const clearOf = (mover: Pending, fixed: Pending) => {
    if (mover.angleOverride !== null || mover.parent === fixed || fixed.parent === mover) return;
    const need = halfWidth(mover) + halfWidth(fixed);
    const r1 = mover.radius, r2 = fixed.radius;
    if (Math.abs(r1 - r2) >= need || r1 <= 0 || r2 <= 0) return;
    const minGap = Math.acos(Math.min(1, Math.max(-1, (r1 * r1 + r2 * r2 - need * need) / (2 * r1 * r2)))) * (180 / Math.PI);
    let d = ((mover.angle - fixed.angle + 540) % 360) - 180;
    if (Math.abs(d) >= minGap) return;
    const shift = (d >= 0 ? 1 : -1) * minGap - d;
    mover.angle = normAngle(mover.angle + shift); mover.sliceStart += shift;
  };
  for (const [radius, list] of [...circles].sort((a, b) => a[0] - b[0])) {
    list.forEach(place);
    relax(list, radius);
    for (const n of list) for (const o of placedSoFar)
      if (hasCluster(o) && !hasCluster(n)) clearOf(n, o); else if (hasCluster(n)) clearOf(n, o);
    placedSoFar.push(...list);
  }
  // Cluster members borrow their gem's slice (only matters if they have children).
  for (const n of nodes) if (n.clusterGem) { n.sliceStart = n.clusterGem.sliceStart; n.sliceWidth = n.clusterGem.sliceWidth; n.angle = n.clusterGem.angle; n.radius = n.clusterGem.radius; n.placed = true; }

  // ── Per-node finishing ─────────────────────────────────────
  for (const n of nodes) {
    n.aptitude = classes.get(n.className)?.aptitude ?? "?";
    const rad = (n.angle * Math.PI) / 180;
    n.x = n.radius * Math.sin(rad);
    n.y = -n.radius * Math.cos(rad);
    const t = nodeTypes.get(n.type);
    n.size = t ? number(t.size, 1) : n.isClusterGem ? CLUSTER_GEM_SIZE : 1;
    const shape = text(t?.shape).toLowerCase();
    n.shape = (shape === "diamond" || shape === "hexagon" ? shape : "circle") as Shape;
    n.points = n.rawCost !== "" ? number(n.rawCost, 1) : t ? number(t.cost, 1) : 1;
  }

  // ── Clusters: members in a ring around their gem ───────────
  // Slot 1 faces the node the gem hangs from (the cluster's entrance), the rest follow clockwise.
  for (const gem of nodes.filter(n => n.isClusterGem && n.clusterMembers.length)) {
    const anchor = gem.parent;
    const toAnchor = anchor ? Math.atan2(anchor.x - gem.x, -(anchor.y - gem.y)) : Math.atan2(-gem.x, gem.y);
    gem.clusterMembers.forEach((m, i) => {
      const a = toAnchor + (i * 2 * Math.PI) / gem.clusterMembers.length;
      m.x = gem.x + CLUSTER_RADIUS * Math.sin(a);
      m.y = gem.y - CLUSTER_RADIUS * Math.cos(a);
      m.radius = Math.hypot(m.x, m.y);
      m.angle = normAngle((Math.atan2(m.x, -m.y) * 180) / Math.PI);
    });
  }

  // ── Links ──────────────────────────────────────────────────
  const links: TreeLink[] = [];
  const linkByPair = new Map<string, TreeLink & { fromSheet: boolean }>();
  const requiredPairs = new Set(nodes.filter(n => n.required).map(n => pairKey(n.id, n.required!.id)));
  const addLink = (a: TreeNode, b: TreeNode, type: string, fromSheet: boolean) => {
    const k = pairKey(a.id, b.id);
    const existing = linkByPair.get(k);
    if (existing) {
      if (fromSheet && existing.fromSheet) warnings.push(`Duplicate link ${a.id} – ${b.id}`);
      if (fromSheet) { existing.type = type; existing.fromSheet = true; }
      return;
    }
    const l = { a, b, type, fromSheet, parent: type === "parent" ? a : null };
    linkByPair.set(k, l); links.push(l);
    a.neighbours.push(b); b.neighbours.push(a);
  };
  for (const n of nodes) if (n.parent) addLink(n.parent, n, "parent", false);
  /** If `top` is an ancestor of `low` two or more steps up, the nodes in between; else null. */
  const shortcut = (top: TreeNode, low: TreeNode): TreeNode[] | null => {
    const between: TreeNode[] = [];
    for (let p = low.parent; p; p = p.parent) {
      if (p === top) return between.length ? between.reverse() : null;
      between.push(p);
      if (between.length > 50) break;
    }
    return null;
  };
  for (const r of data.links ?? []) {
    const a = text(r.from), b = text(r.to);
    if (!a && !b) continue;
    const na = byId.get(a), nb = byId.get(b);
    if (!na || !nb) { warnings.push(`Link ${a || "?"} → ${b || "?"}: missing node`); continue; }
    const type = text(r.type) || "normal";
    if (NON_PATH_LINK_TYPES.includes(type.toLowerCase())) continue;
    if (requiredPairs.has(pairKey(a, b))) continue;
    if (a === b) { warnings.push(`Self-link on ${a}`); continue; }
    // A link from a node to its own grand-child (or further) jumps over the chain in between.
    const skipped = shortcut(na, nb) ?? shortcut(nb, na);
    if (skipped) warnings.push(`Link ${a} → ${b} is a shortcut: it skips ${skipped.map(n => n.id).join(", ")}. Delete the Links row if it's left over.`);
    addLink(na, nb, type, true);
  }
  const orphans = nodes.filter(n => n.neighbours.length === 0);
  if (orphans.length)
    warnings.push(`${orphans.length} unlinked: ${orphans.slice(0, 6).map(n => n.id).join(", ")}${orphans.length > 6 ? "…" : ""}`);

  // ── Gem texts, clusters, ascendancies, builds ───────────────
  for (const [id, g] of Object.entries(gems))
    if (!byId.has(id)) warnings.push(`Gem text for "${id}" (${g.file ?? "gems"}) has no node with that id`);
  for (const n of nodes)
    if (n.cluster && !clusterDefs.has(n.cluster)) clusterDefs.set(n.cluster, {});   // used but not described: fine
  const ascendancies = new Map<string, AscendancyInfo>();
  for (const a of Object.values(W.ascendancies ?? {})) {
    const name = text(a.name);
    if (name) ascendancies.set(name, { name, coreClass: text(a.coreClass), forbidden: a.forbidden === true });
  }
  const builds: BuildInfo[] = (W.builds ?? []).filter(r => text(r.id)).map(r => ({
    id: text(r.id), startClass: text(r.startClass), first: text(r.first),
    second: text(r.second), notes: text(r.notes),
    targets: text(r.targets).split(",").map(s => s.trim()).filter(Boolean),
  }));

  return {
    nodes, links, byId, classes, aptitudes, ringRadius,
    maxRadius: Math.max(100, ...ringRadius.values()),
    ascendancies, builds, clusters: clusterDefs, effects: W.effects ?? {}, warnings,
  };
}


export const isForbidden = (n: TreeNode) => FORBIDDEN_TYPES.includes(n.type.toLowerCase());

/** A gems/*.json bonus → one readable line: "+2 Strength while Raging", "+5% Rage gain", or the text as typed. */
function formatBonus(b: BonusDef, world: WorldDef, nodeId: string, warnings: string[]): string {
  if (typeof b === "string") return b;
  const id = text(b?.effect);
  const def = world.effects?.[id];
  if (!def && !/^skill:/i.test(id)) warnings.push(`${nodeId}: bonus effect "${id}" isn't in world.json → effects`);
  const name = text(def?.name) || id.replace(/^skill:/i, "");
  const v = text(b.value);
  const value = v === "" ? "" : /^[+\-−]/.test(v) ? v : `+${v}`;
  const unit = v !== "" && text(def?.unit) === "%" ? "%" : "";
  const per = b.per ? `per ${b.step ?? 1} ${text(world.effects?.[b.per]?.name) || b.per.replace(/^\w+:/, "")}` : "";
  return [value + unit, name, per, text(b.when)].filter(Boolean).join(" ");
}
