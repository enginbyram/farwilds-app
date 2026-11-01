/**
 * The rules tables on the Dev panel, as data. To show a new rules table, add an entry here:
 * which table, its columns, and (optionally) what a new row looks like.
 */
import { ATTR_KEYS, zeroPoints, type Rules } from "@/features/rules/types";
import type { CellKind, Col, TableDef } from "./TableEditor";

/** One narrow number column per attribute: STR DEX CON … */
const attrCols = (prefix: string): Col[] => ATTR_KEYS.map(k => ({ path: `${prefix}.${k}`, label: k, kind: "number" as CellKind, width: 40 }));
/** The names in another table, for a dropdown. */
const names = (rules: () => Rules, k: "coreClasses" | "ascendancies" | "armour" | "aptitudes") => () =>
  (rules()[k] as { name: string }[]).map(x => x.name);

export function devTables(rules: () => Rules): TableDef[] {
  return [
    { title: "Parameters", table: "params", keyPath: "key", open: true, cols: [
      { path: "key", label: "Parameter", kind: "text", width: 110 },
      { path: "value", label: "Value", kind: "number", width: 62 },
      { path: "status", label: "Status", kind: "status", width: 84 },
      { path: "note", label: "Note", kind: "text", width: 220 },
    ] },
    { title: "Core classes", table: "coreClasses", keyPath: "name", cols: [
      { path: "name", label: "Class", kind: "text", width: 80 },
      { path: "aptitude", label: "Aptitude", kind: "select", options: names(rules, "aptitudes"), width: 84 },
      { path: "hitDie", label: "HD", kind: "number", width: 44 },
      ...attrCols("points"),
    ] },
    { title: "Ascendancies", table: "ascendancies", keyPath: "name",
      newRow: r => ({ name: "New", coreClass: r.coreClasses[0]?.name ?? "", forbidden: false, hitDie: 8, purequick: false, rage: false, fel: false, maxArmour: "Light", identity: "" }),
      cols: [
        { path: "name", label: "Ascendancy", kind: "text", width: 96 },
        { path: "coreClass", label: "Core", kind: "select", options: names(rules, "coreClasses"), width: 84 },
        { path: "hitDie", label: "HD", kind: "number", width: 44 },
        { path: "forbidden", label: "Forb.", kind: "bool" },
        { path: "purequick", label: "PQ", kind: "bool" },
        { path: "rage", label: "Rage", kind: "bool" },
        { path: "fel", label: "Fel", kind: "bool" },
        { path: "maxArmour", label: "Max armour", kind: "select", options: names(rules, "armour"), width: 76 },
      ] },
    { title: "Races", table: "races", keyPath: "name",
      newRow: () => ({ name: "New race", lineage: "", speed: null, points: zeroPoints(), note: "" }),
      cols: [
        { path: "name", label: "Race", kind: "text", width: 110 },
        { path: "lineage", label: "Lineage", kind: "text", width: 80 },
        { path: "speed", label: "Speed", kind: "nullnum", width: 52 },
        ...attrCols("points"),
      ] },
    { title: "Marks and powers", table: "marks", keyPath: "name",
      newRow: () => ({ name: "New power", kind: "Eye power", pole: "", points: zeroPoints(), freePoints: 0, note: "" }),
      cols: [
        { path: "name", label: "Name", kind: "text", width: 84 },
        { path: "kind", label: "Kind", kind: "text", width: 72 },
        { path: "freePoints", label: "Free pts", kind: "number", width: 44 },
        ...attrCols("points"),
      ] },
    { title: "Well tiers", table: "wellTiers", keyPath: "tier",
      newRow: () => ({ tier: "New", frequency: "", base: 0, growth: 0, ceiling: 0, playerStart: false, note: "" }),
      cols: [
        { path: "tier", label: "Tier", kind: "text", width: 70 },
        { path: "frequency", label: "Frequency", kind: "text", width: 80 },
        { path: "base", label: "Base", kind: "number" },
        { path: "growth", label: "Growth", kind: "number" },
        { path: "ceiling", label: "Ceiling", kind: "number" },
        { path: "playerStart", label: "Player start", kind: "bool" },
      ] },
    { title: "Armour weight", table: "armour", keyPath: "name", newRow: () => ({ name: "New", order: 0, value: 0 }), cols: [
      { path: "name", label: "Armour", kind: "text", width: 80 },
      { path: "order", label: "Order", kind: "number" },
      { path: "value", label: "Armour value", kind: "number" },
    ] },
    { title: "Elements", table: "elements", keyPath: "name", newRow: () => ({ name: "New", subArts: "" }), cols: [
      { path: "name", label: "Element", kind: "text", width: 80 },
      { path: "subArts", label: "Sub-arts (comma list)", kind: "text", width: 200 },
    ] },
    { title: "Combinations", table: "combinations", keyPath: "name",
      newRow: () => ({ name: "New", rootA: "", rootB: "", forbidden: false, description: "" }),
      cols: [
        { path: "name", label: "Combination", kind: "text", width: 100 },
        { path: "rootA", label: "Root A", kind: "select", options: names(rules, "ascendancies"), width: 96 },
        { path: "rootB", label: "Root B", kind: "select", options: names(rules, "ascendancies"), width: 96 },
        { path: "forbidden", label: "Forb.", kind: "bool" },
      ] },
    { title: "Skills", table: "skills", keyPath: "name", newRow: () => ({ name: "New skill", attribute: "STR" as const }), cols: [
      { path: "name", label: "Skill", kind: "text", width: 110 },
      { path: "attribute", label: "Attribute", kind: "select", options: () => [...ATTR_KEYS], width: 64 },
    ] },
  ] as TableDef[];
}
