/**
 * Reads the JSON database in src/data/tree/ and merges it into one TreeData.
 *
 *   nodes/*.json   every file in the folder is read (sorted by name) — add a file, it's picked up
 *   gems/*.json    same: node id → description, flavor, bonuses
 *   links.json, clusters.json, world.json
 *
 * While `npm run dev` runs, saving any of these files redraws the tree instantly.
 */
import type { ClusterDef, GemDef, LinkDef, NodeDef, TreeData, WorldDef } from "./types";
import links from "./tree/links.json";
import clusters from "./tree/clusters.json";
import world from "./tree/world.json";

const nodeFiles = import.meta.glob<NodeDef[]>("./tree/nodes/*.json", { eager: true, import: "default" });
const gemFiles = import.meta.glob<Record<string, GemDef>>("./tree/gems/*.json", { eager: true, import: "default" });

const shortName = (path: string) => path.replace("./tree/", "");
const sorted = <T,>(files: Record<string, T>) => Object.entries(files).sort(([a], [b]) => a.localeCompare(b));

function load(): TreeData {
  const warnings: string[] = [];

  const nodes: TreeData["nodes"] = [];
  for (const [path, list] of sorted(nodeFiles)) {
    if (!Array.isArray(list)) { warnings.push(`${shortName(path)} should be a list [ … ] of nodes`); continue; }
    list.forEach(n => nodes.push({ ...n, id: String(n.id), file: shortName(path) }));
  }

  const gems: TreeData["gems"] = {};
  for (const [path, entries] of sorted(gemFiles)) {
    for (const [id, gem] of Object.entries(entries ?? {})) {
      if (id.startsWith("_")) continue;   // "_comment": … at the top level is allowed
      if (gems[id]) warnings.push(`Gem text for ${id} is in both ${gems[id].file} and ${shortName(path)} — the second one wins`);
      gems[id] = { ...gem, file: shortName(path) };
    }
  }

  return {
    nodes, gems, warnings,
    links: links as LinkDef[],
    clusters: clusters as Record<string, ClusterDef>,
    world: world as unknown as WorldDef,
  };
}

/** The built-in database. Re-evaluated by Vite whenever a JSON file changes. */
export const DATABASE: TreeData = load();
