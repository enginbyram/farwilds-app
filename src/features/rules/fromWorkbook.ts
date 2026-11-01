/**
 * Reads rules from the "Data" sheet of the Character Builder workbook (.xlsx), so the workbook can stay
 * the place you edit numbers. Tables are found by their title in column A (e.g. "RACES  (…)"), headers on
 * the next row, rows until the first empty cell in column A. Tables that aren't found keep their current values.
 */
import * as XLSX from "xlsx";
import { ATTR_KEYS, type AttrPoints, type Rules, type Status } from "./types";

type Cell = string | number | boolean | null;
type Rec = Record<string, Cell>;

function findTables(rows: Cell[][]) {
  const tables = new Map<string, Rec[]>();
  for (let r = 0; r < rows.length - 1; r++) {
    const title = rows[r]?.[0];
    const header = rows[r + 1] ?? [];
    if (typeof title !== "string" || !header[0] || typeof header[0] !== "string") continue;
    const key = title.split("  ")[0].trim();
    if (key !== key.toUpperCase() || !/[A-Z]/.test(key)) continue;           // titles are capitals
    if (header[0] === header[0].toUpperCase()) continue; // the index at the top lists titles under titles
    const out: Rec[] = [];
    for (let i = r + 2; i < rows.length && rows[i]?.[0] !== null && rows[i]?.[0] !== undefined && rows[i]?.[0] !== ""; i++) {
      out.push(Object.fromEntries(header.map((h, j) => [String(h ?? ""), rows[i][j] ?? null]).filter(([h]) => h)));
    }
    if (!tables.has(key)) tables.set(key, out);
  }
  return tables;
}

const num = (v: Cell) => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: Cell) => (v === null || v === undefined ? "" : String(v));
const yes = (v: Cell) => str(v).toLowerCase() === "yes" || v === true;
const pts = (r: Rec) => Object.fromEntries(ATTR_KEYS.map(k => [k, num(r[k])])) as AttrPoints;

export async function rulesFromWorkbook(file: File, current: Rules): Promise<{ rules: Rules; found: string[] }> {
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const sheet = wb.Sheets.Data;
  if (!sheet) throw new Error("this workbook has no Data sheet");
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: true });
  const T = findTables(rows);
  const found: string[] = [];
  const next: Rules = { ...current };
  const take = <K extends keyof Rules>(title: string, key: K, map: (r: Rec) => Rules[K] extends (infer X)[] ? X : never) => {
    const t = T.get(title);
    if (!t?.length) return;
    (next[key] as unknown) = t.map(map);
    found.push(title.toLowerCase());
  };

  // Parameters: update values that exist in the workbook, keep the app-only ones (CreationPoints…).
  const params = T.get("PARAMETERS");
  if (params?.length) {
    const byKey = new Map(params.map(p => [str(p.Parameter), p]));
    next.params = current.params.map(p => {
      const w = byKey.get(p.key);
      return w ? { ...p, value: num(w.Value), status: (str(w.Status) || p.status) as Status, note: str(w.Note) || p.note } : p;
    });
    found.push("parameters");
  }
  take("CORE CLASSES", "coreClasses", r => ({ name: str(r.Class), aptitude: str(r.Aptitude), hitDie: num(r["Hit Die (d)"]), points: pts(r), identity: str(r.Identity) }));
  take("ASCENDANCIES", "ascendancies", r => ({
    name: str(r.Ascendancy), coreClass: str(r["Core class"]), forbidden: yes(r.Forbidden), hitDie: num(r["Hit Die (d)"]),
    purequick: yes(r.Purequick), rage: yes(r.Rage), fel: yes(r.Fel), maxArmour: str(r["Max armour"]), identity: str(r.Identity),
  }));
  take("COMBINATIONS", "combinations", r => ({ name: str(r.Combination), rootA: str(r["Root A"]), rootB: str(r["Root B"]), forbidden: yes(r.Forbidden), description: str(r.Description) }));
  const base = current.params.find(p => p.key === "BaseSpeed")?.value;
  take("RACES", "races", r => {
    const sp = r["Speed (m)"];
    return { name: str(r.Race), lineage: str(r.Lineage), speed: sp === null || num(sp) === base ? null : num(sp), points: pts(r), note: str(r.Note) };
  });
  take("MARKS", "marks", r => {
    const cur = current.marks.find(m => m.name === str(r.Mark));
    return { name: str(r.Mark), kind: str(r.Kind) || cur?.kind || "Mark", pole: str(r.Pole), points: pts(r),
      freePoints: r["Free points"] !== undefined ? num(r["Free points"]) : cur?.freePoints ?? 0, note: str(r.Note) || cur?.note || "" };
  });
  take("WELL TIERS", "wellTiers", r => ({
    tier: str(r.Tier), frequency: str(r.Frequency), base: num(r["Base pool"]), growth: num(r["Growth / level"]), ceiling: num(r.Ceiling),
    playerStart: current.wellTiers.find(w => w.tier === str(r.Tier))?.playerStart ?? false, note: str(r.Note),
  }));
  take("ARMOUR WEIGHT", "armour", r => ({ name: str(r.Armour), order: num(r.Order), value: num(r["Armour value"]) }));
  take("ELEMENTS", "elements", r => ({ name: str(r.Element), subArts: str(r["Sub-arts"]) }));
  take("SKILLS", "skills", r => {
    const attr = current.attributes.find(a => a.name === str(r.Attribute))?.short ?? "STR";
    return { name: str(r.Skill), attribute: attr };
  });
  if (!found.length) throw new Error("no rules tables found on the Data sheet");
  return { rules: next, found };
}
