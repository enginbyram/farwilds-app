/**
 * Legacy import: an old skill-tree workbook (.xlsx) → TreeData, so it can still be viewed.
 * The JSON files in src/data/tree/ are the real database; to move a workbook into them for good,
 * run tools/xlsx_to_json.py (see README).
 * Sheets the workbook doesn't have (or leaves empty) come from the built-in database.
 */
import * as XLSX from "xlsx";
import type { BonusDef, TreeData } from "../types";
import { number, text } from "@/core/cells";

type Row = Record<string, unknown>;
const opt = (v: unknown) => (text(v) === "" ? undefined : text(v));
const optNum = (v: unknown) => (text(v) === "" ? undefined : number(v, 0));

export function parseWorkbook(bytes: ArrayBuffer, base: TreeData): TreeData {
  const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
  if (!wb.Sheets.Nodes) throw new Error("This file has no Nodes sheet.");
  const sheet = (name: string): Row[] =>
    wb.Sheets[name] ? XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: "" }).filter(r => text(Object.values(r)[0]) !== "") : [];

  const nodes: TreeData["nodes"] = sheet("Nodes").filter(r => text(r.node_id)).map(r => ({
    id: text(r.node_id), name: opt(r.name), type: opt(r.type), parent: opt(r.parent_id), requires: opt(r.parent2_id),
    class: opt(r.class), ring: optNum(r.ring), slot: optNum(r.slot), angle: optNum(r.angle_override), depth: optNum(r.depth),
    cluster: opt(r.cluster_id), cost: optNum(r.cost), requirement: opt(r.requirement), wiki: opt(r.wiki_page), notes: opt(r.notes),
    file: "workbook",
  }));

  const links = sheet("Links").filter(r => text(r.from_id) && text(r.to_id))
    .map(r => ({ from: text(r.from_id), to: text(r.to_id), type: opt(r.link_type) }));

  const clusters: TreeData["clusters"] = {};
  sheet("Clusters").forEach(r => { if (text(r.cluster_id)) clusters[text(r.cluster_id)] = { name: opt(r.theme), template: opt(r.template) }; });

  // Gem text: the Nodes "description" column + NodeEffects rows.
  const gems: TreeData["gems"] = {};
  const gem = (id: string) => (gems[id] ??= { bonuses: [], file: "workbook" });
  sheet("Nodes").forEach(r => { if (text(r.description)) gem(text(r.node_id)).description = text(r.description); });
  sheet("NodeEffects").forEach(r => {
    if (!text(r.node_id)) return;
    const b: BonusDef = { effect: text(r.effect_id), value: opt(r.value) };
    gem(text(r.node_id)).bonuses!.push(b);
  });

  const keyed = <T,>(rows: Row[], key: string, map: (r: Row) => T) =>
    rows.length ? Object.fromEntries(rows.filter(r => text(r[key])).map(r => [text(r[key]), map(r)])) : undefined;
  const w = base.world;
  const world: TreeData["world"] = {
    classes: keyed(sheet("Classes"), "class", r => ({ aptitude: opt(r.aptitude), wedgeStart: optNum(r.wedge_start), wedgeWidth: optNum(r.wedge_width), startNode: opt(r.start_node_id) })) ?? w.classes,
    aptitudes: keyed(sheet("Aptitudes"), "aptitude", r => ({ angleStart: optNum(r.angle_start), angleWidth: optNum(r.angle_width), gateNode: opt(r.gate_node_id), opposite: opt(r.opposite) })) ?? w.aptitudes,
    rings: sheet("Rings").length ? sheet("Rings").map(r => ({ ring: number(r.ring, 0), radius: number(r.radius, 0), name: opt(r.name) })) : w.rings,
    nodeTypes: keyed(sheet("NodeTypes"), "type", r => ({ shape: opt(r.shape), size: optNum(r.size), cost: optNum(r.default_cost) })) ?? w.nodeTypes,
    ascendancies: keyed(sheet("Ascendancies"), "asc_id", r => ({ name: opt(r.name), coreClass: opt(r.core_class), forbidden: text(r.forbidden) === "yes" })) ?? w.ascendancies,
    effects: keyed(sheet("Effects"), "effect_id", r => ({ name: opt(r.name), unit: opt(r.unit) })) ?? w.effects,
    builds: w.builds,
  };

  return { nodes, links, clusters: Object.keys(clusters).length ? clusters : base.clusters, gems, world, warnings: [] };
}

export async function loadFromFile(file: File, base: TreeData): Promise<TreeData> {
  return parseWorkbook(await file.arrayBuffer(), base);
}
