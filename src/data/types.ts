/**
 * ── The database (src/data/tree/*.json) ──────────────────────────
 * These interfaces describe what you type into the JSON files. Every field except the id is optional.
 */

/** One line in nodes/*.json — a point on the tree. */
export interface NodeDef {
  id: string;
  name?: string;
  type?: string;          // a key of world.json → nodeTypes
  parent?: string;        // the node it hangs from (draws the connection, sets the position)
  requires?: string;      // must be owned first — never a path, never moves the node
  class?: string;         // root nodes only; others inherit it from their parent
  ring?: number;
  slot?: number;          // order among siblings, clockwise
  angle?: number;         // place by hand (degrees clockwise from the top)
  depth?: number;         // band nodes: 0 = inner edge … 1 = outer edge
  cluster?: string;       // a key of clusters.json
  cost?: number;          // else nodeTypes[type].cost
  requirement?: string;   // free text shown in the node card
  wiki?: string;
  notes?: string;
}

/** One line in links.json — an extra connection that "parent" doesn't already draw. */
export interface LinkDef { from: string; to: string; type?: string; notes?: string; }

/** clusters.json — one entry per cluster_id. "name" is drawn beside pathways. */
export interface ClusterDef { name?: string; class?: string; ring?: number; template?: string; notes?: string; }

/** A bonus line: plain text, or an effect from world.json → effects with a value. */
export type BonusDef = string | { effect: string; value?: number | string; when?: string };

/** gems/*.json — the text of a node, keyed by node id. Works for any node, not only gems. */
export interface GemDef { description?: string; flavor?: string; bonuses?: BonusDef[]; }

export interface WorldDef {
  classes: Record<string, { aptitude?: string; wedgeStart?: number; wedgeWidth?: number; startNode?: string; notes?: string }>;
  aptitudes: Record<string, { order?: number; angleStart?: number; angleWidth?: number; gateNode?: string; opposite?: string; notes?: string }>;
  rings: Array<{ ring: number; name?: string; radius: number; role?: string }>;
  nodeTypes: Record<string, { shape?: string; size?: number; cost?: number; description?: string }>;
  ascendancies: Record<string, { name?: string; coreClass?: string; forbidden?: boolean; notes?: string }>;
  effects: Record<string, { name?: string; category?: string; unit?: string; description?: string; target?: string }>;
  builds: Array<{ id?: string; startClass?: string; first?: string; second?: string; targets?: string; notes?: string }>;
}

/** Everything the app reads, already merged from the separate files. */
export interface TreeData {
  nodes: Array<NodeDef & { file?: string }>;   // file = which nodes/*.json it came from
  links: LinkDef[];
  clusters: Record<string, ClusterDef>;
  gems: Record<string, GemDef & { file?: string }>;
  world: WorldDef;
  warnings?: string[];                          // problems found while merging files
}

// ── After layout ───────────────────────────────────────────────

export type Shape = "circle" | "diamond" | "hexagon";
export type ClusterMode = "all" | "one" | "any";

/** One point on the tree, after layout. Think of it as a C# class with public fields. */
export interface TreeNode {
  id: string;
  name: string;
  type: string;
  row: number;                 // order in the Nodes sheet
  className: string;           // resolved class (own, or inherited from parent 1)
  aptitude: string;
  ring: number;
  slot: number;
  angleOverride: number | null;
  points: number;              // cost to allocate
  requirementText: string;
  cluster: string;
  wikiPage: string;
  notes: string;
  description: string;         // gems/*.json → description
  flavor: string;              // gems/*.json → flavor (an in-world quote, shown in italics)
  bonuses: string[];           // gems/*.json → bonuses, already written out ("+2 Strength")
  bonusDefs: BonusDef[];       // the raw bonuses (gems/*.json) — rules/bonuses.ts adds them to the sheet
  sourceFile: string;          // the nodes/*.json file the node lives in

  parent: TreeNode | null;     // parent_id — the node it hangs from
  required: TreeNode | null;   // parent2_id — must be owned, never a path
  clusterMembers: TreeNode[];  // cluster gems only: the nodes around it that must be unlocked first
  clusterGem: TreeNode | null; // cluster members only: the gem in the middle of their cluster
  isCentre: boolean;
  onRing: boolean;             // sits on the ring line (centre, starts, ascendancies) — else in the band after it
  isClusterGem: boolean;
  clusterMode: ClusterMode | null; // cluster gems only: all = every member, one = pick one, any = at least one
  isPathwayGem: boolean;       // the capstone at the end of a serial pathway
  pathway: TreeNode[];         // pathway gems only: the chain in order, first node → the gem
  pathwayGem: TreeNode | null; // pathway nodes (gem included): the gem that ends their pathway
  pathwayName: string;         // pathway gems only: clusters.json → name (drawn beside the pathway)

  // layout (degrees clockwise from the top; map units)
  angle: number;
  sliceStart: number;
  sliceWidth: number;
  radius: number;
  x: number;
  y: number;

  size: number;
  shape: Shape;
  neighbours: TreeNode[];      // walkable connections
}

export interface TreeLink {
  a: TreeNode;
  b: TreeNode;
  type: string;                // "parent", "normal", "gate", "locked", …
  parent: TreeNode | null;     // set when the link is a parent connection (drawn in the parent's colour)
}

export interface ClassInfo { name: string; aptitude: string; wedgeStart: number; wedgeWidth: number; startNodeId: string; }
export interface AptitudeInfo { name: string; angleStart: number; angleWidth: number; gateNodeId: string; opposite: string; }
export interface AscendancyInfo { name: string; coreClass: string; forbidden: boolean; }
export interface BuildInfo { id: string; startClass: string; first: string; second: string; targets: string[]; notes: string; }

/** Everything the UI needs, built once per workbook. */
export interface TreeModel {
  nodes: TreeNode[];
  links: TreeLink[];
  byId: Map<string, TreeNode>;
  classes: Map<string, ClassInfo>;
  aptitudes: Map<string, AptitudeInfo>;
  ringRadius: Map<number, number>;
  maxRadius: number;
  ascendancies: Map<string, AscendancyInfo>;
  builds: BuildInfo[];
  clusters: Map<string, ClusterDef>;
  effects: WorldDef["effects"];   // world.json → effects, for the bonus pipeline
  warnings: string[];
}

export interface RouteStep {
  target: TreeNode;
  cost: number;
  path: TreeNode[];
  isRequirement: boolean;
  requiredBy: TreeNode | null;
}

export interface Route {
  ok: boolean;
  cost: number;
  steps: RouteStep[];
  owned: Set<TreeNode>;
  unreachable?: TreeNode;
}
