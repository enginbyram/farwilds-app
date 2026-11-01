/**
 * ──────────────────────────────────────────────────────────────
 *  SETTINGS — the knobs you are most likely to want to change.
 *  Colours live in src/styles/tokens.css, not here.
 * ──────────────────────────────────────────────────────────────
 */

/** Map an aptitude name (Aptitudes sheet) to a CSS colour variable in tokens.css. */
export const APTITUDE_COLOR: Record<string, string> = {
  Body: "--apt-body",
  Wisdom: "--apt-wisdom",
  Charisma: "--apt-charisma",
  Intellect: "--apt-intellect",
  Centre: "--apt-centre",
};

/** Node types drawn in the "forbidden" colour regardless of aptitude. */
export const FORBIDDEN_TYPES = ["forbidden"];

/** The hub. Always owned, never clickable, no name shown. */
export const CENTRE_TYPES = ["centre", "center"];

/**
 * Cluster gems: the nodes sharing its cluster_id are arranged in a ring around it.
 * Owning the node the gem hangs from (its parent) opens the cluster. The gem's TYPE decides the rule
 * (type name → rule below); unlocking the gem is what lets you move on past the cluster.
 * CLUSTER_GEM_SIZE is used when NodeTypes has no row for the type.
 */
export const CLUSTER_GEM_TYPES: Record<string, "all" | "one" | "any"> = {
  "cluster gem": "all",          // unlock every member, then the gem
  "choice cluster gem": "one",   // pick exactly one member, then the gem (the others lock)
  "open cluster gem": "any",     // take as many members as you like; the gem opens after the first
};
export const CLUSTER_GEM_SIZE = 3;

/**
 * Pathway gems: a SERIAL cluster. The nodes sharing its cluster_id form an ordinary chain
 * (parent → child → … → the gem), laid out like any band chain, and the map draws a thin
 * outline around the whole chain so it reads as one pathway. The chain itself enforces the order;
 * the gem at the end is the capstone.
 */
export const PATHWAY_GEM_TYPES = ["pathway gem"];
/** Distance (map units) from a pathway's node centres to its outline. */
export const PATHWAY_PADDING = 9;
/** Pathway names (clusters.json → name) beside the outline: text size and gap from the outline (map units). */
export const PATHWAY_LABEL_SIZE = 7.5;
export const PATHWAY_LABEL_GAP = 2.5;

/** Glow around nodes you can unlock next (and the parent 2 nodes in the way): gap from the node edge, blur. */
export const GLOW_GAP = 2.2;
export const GLOW_BLUR = 1.6;
/** Distance (map units) from a cluster gem to the ring of nodes around it. */
export const CLUSTER_RADIUS = 30;
/** Empty space kept between a cluster's ring and any node that isn't part of it. */
export const CLUSTER_CLEARANCE = 18;
/**
 * Room each ordinary band node claims along a chain (map units, before the band is stretched to fit).
 * A cluster gem claims CLUSTER_RADIUS + CLUSTER_CLEARANCE instead, so the chain makes room for the cluster.
 */
export const BAND_NODE_SPACE = 24;

/**
 * Which node types sit ON a ring line (matched as part of the type name, case-insensitive).
 * Every other type sits in the BAND between its ring and the next ring:
 *   ring 1 passive → between ring 1 and ring 2, ring 2 passive → between ring 2 and ring 3, …
 * Several band nodes in a chain (passive → passive) are spread evenly across the band;
 * an optional Nodes column "depth" (0 = inner edge, 1 = outer edge) places one by hand.
 */
export const ON_RING_TYPES = ["centre", "center", "start", "ascend"];

/**
 * Wheel size. Every ring radius from the Rings sheet is multiplied by this.
 * Nodes keep their size, so a bigger number = more room between nodes.
 */
export const RADIUS_SCALE = 2;

/** Node size on the map: radius = NODE_BASE + size × NODE_PER_SIZE (size comes from NodeTypes). */
export const NODE_BASE = 1.5;
export const NODE_PER_SIZE = 1.6;

/** Minimum distance (map units) between neighbouring nodes on the same ring. Bigger = more air. */
export const MIN_NODE_SPACING = 16;

/** Zoom. */
export const MAX_ZOOM = 14;        // how far you can zoom in (× the full view)
export const ZOOM_BUTTON_FACTOR = 1.5;

/** Aptitude names, written along the outside of the rim (map units). */
export const APTITUDE_LABEL_SIZE = 30;
export const APTITUDE_LABEL_GAP = 18;   // distance outside the rim

/** Character defaults. Tree points = the character's level (1 keystone point per level; the class start is free). */
export const DEFAULT_CHARACTER_NAME = "Unnamed sage";

/**
 * Colour scheme of the Character page, per core class: [light theme, dark theme].
 * Add a class here when you add one to the rules; unknown classes fall back to --brass.
 */
export const CLASS_THEME: Record<string, [string, string]> = {
  Fighter:   ["#a3392b", "#e4705f"],   // iron red
  Rogue:     ["#2f6b5e", "#5cc2ab"],   // slate green
  Arcanist:  ["#4b45a8", "#9e97f2"],   // indigo
  Artificer: ["#8a5a24", "#d9a15e"],   // bronze
  Cleric:    ["#3d6fa8", "#86b6ee"],   // holy blue
  Druid:     ["#4c7a26", "#94cc5e"],   // leaf
  Ranger:    ["#6e6524", "#c9bd62"],   // olive
  Bard:      ["#a53d78", "#ea84bd"],   // magenta
  Witch:     ["#6c2f80", "#c287db"],   // nightshade
};

/** Link types from the Links sheet that are NOT paths (never walkable, never drawn). */
export const NON_PATH_LINK_TYPES = ["requirement"];
