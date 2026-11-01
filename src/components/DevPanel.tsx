/**
 * Dev mode sidebar — edit every rules table live. Changes apply at once and are kept in the browser.
 * Cells that differ from the defaults (src/data/rules.json) are highlighted.
 * To make a change permanent: Export rules, then copy the tables into src/data/rules.json.
 */
import { useRef, useState } from "react";
import type { RulesState } from "@/hooks/useRules";
import { parseRules } from "@/hooks/useRules";
import { downloadJson, rulesFile } from "@/data/characterFile";
import { derivedLevels } from "@/rules/compute";
import { rulesFromWorkbook } from "@/rules/fromWorkbook";
import { ATTR_KEYS, type Rules } from "@/rules/types";

type Kind = "number" | "text" | "bool" | "select" | "nullnum" | "status";
interface Col { path: string; label: string; kind: Kind; options?: () => string[]; width?: number; }

const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], o);
function set<T>(o: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const obj = o as Record<string, unknown>;
  return { ...obj, [head]: rest.length ? set(obj[head], rest.join("."), value) : value } as T;
}

function Cell({ col, value, changed, onChange }: { col: Col; value: unknown; changed: boolean; onChange: (v: unknown) => void }) {
  const cls = `in in--dev${changed ? " in--changed" : ""}`;
  const style = { width: col.width ?? (col.kind === "text" ? 120 : 52) };
  switch (col.kind) {
    case "bool":
      return <input type="checkbox" className={changed ? "in--changed" : ""} checked={!!value} onChange={e => onChange(e.target.checked)} aria-label={col.label} />;
    case "select":
    case "status": {
      const opts = col.kind === "status" ? ["Settled", "Proposed", "Open"] : col.options?.() ?? [];
      return (
        <select className={cls} style={style} value={String(value ?? "")} onChange={e => onChange(e.target.value)} aria-label={col.label}>
          {!opts.includes(String(value ?? "")) && <option value={String(value ?? "")}>{String(value ?? "")}</option>}
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case "nullnum":
      return <input type="number" className={cls} style={style} placeholder="base" aria-label={col.label}
        value={value === null || value === undefined ? "" : Number(value)}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "number":
      return <input type="number" className={cls} style={style} aria-label={col.label} value={Number(value ?? 0)}
        onChange={e => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />;
    default:
      return <input className={cls} style={style} aria-label={col.label} value={String(value ?? "")} onChange={e => onChange(e.target.value)} />;
  }
}

/** One editable table. `keyPath` matches a row to its default row (by name), for change highlighting. */
function TableEditor<K extends keyof Rules>({ title, table, cols, keyPath, rs, newRow, open }: {
  title: string; table: K; cols: Col[]; keyPath: string; rs: RulesState; newRow?: () => Rules[K] extends (infer R)[] ? R : never; open?: boolean;
}) {
  const rows = rs.rules[table] as unknown as Record<string, unknown>[];
  const defaults = rs.defaults[table] as unknown as Record<string, unknown>[];
  const changedCount = rows.reduce((t, r) => {
    const d = defaults.find(x => get(x, keyPath) === get(r, keyPath));
    return t + (d ? cols.filter(c => JSON.stringify(get(r, c.path)) !== JSON.stringify(get(d, c.path))).length : 1);
  }, 0) + Math.max(0, defaults.length - rows.length);
  const setRows = (next: Record<string, unknown>[]) => rs.setRules(r => ({ ...r, [table]: next }));

  return (
    <details className="dev__section" open={open}>
      <summary>{title} <span className="mono">{rows.length}</span>{changedCount > 0 && <span className="dev__badge">{changedCount} changed</span>}</summary>
      <div className="table-wrap">
        <table className="tbl tbl--dev">
          <thead><tr>{cols.map(c => <th key={c.path}>{c.label}</th>)}{newRow && <th />}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const d = defaults.find(x => get(x, keyPath) === get(r, keyPath));
              return (
                <tr key={i}>
                  {cols.map(c => (
                    <td key={c.path}>
                      <Cell col={c} value={get(r, c.path)} changed={!d || JSON.stringify(get(r, c.path)) !== JSON.stringify(get(d, c.path))}
                        onChange={v => setRows(rows.map((x, j) => (j === i ? set(x, c.path, v) : x)))} />
                    </td>
                  ))}
                  {newRow && <td><button className="btn btn--small btn--ghost" title="Delete row"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {newRow && <button className="btn btn--small" onClick={() => setRows([...rows, newRow() as unknown as Record<string, unknown>])}>+ Add row</button>}
    </details>
  );
}

const zero = () => Object.fromEntries(ATTR_KEYS.map(k => [k, 0])) as Record<(typeof ATTR_KEYS)[number], number>;
const attrCols = (prefix: string): Col[] => ATTR_KEYS.map(k => ({ path: `${prefix}.${k}`, label: k, kind: "number" as Kind, width: 40 }));

export function DevPanel({ rs }: { rs: RulesState }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const lv = derivedLevels(rs.rules);
  const r = rs.rules;
  const names = (k: "coreClasses" | "ascendancies" | "armour" | "aptitudes") => () => (r[k] as { name: string }[]).map(x => x.name);

  const importRules = async (f: File) => {
    try { rs.setRules(parseRules(await f.text())); setMsg(`Loaded rules from ${f.name}.`); }
    catch (e) { setMsg(`Couldn't read ${f.name}: ${(e as Error).message}`); }
  };

  const importWorkbook = async (f: File) => {
    try { const { rules, found } = await rulesFromWorkbook(f, rs.rules); rs.setRules(rules); setMsg(`From ${f.name}: ${found.join(", ")}.`); }
    catch (e) { setMsg(`Couldn't read ${f.name}: ${(e as Error).message}`); }
  };

  return (
    <aside className="dev">
      <div className="dev__head">
        <h2>Dev mode · rules</h2>
        <p className="note">Edits apply live and stay in this browser. Highlighted = differs from the defaults.</p>
        <div className="dev__actions">
          <button className="btn btn--small" onClick={() => downloadJson(rulesFile(r), "farwilds-rules.json")}>Export rules</button>
          <button className="btn btn--small" onClick={() => fileRef.current?.click()}>Import rules</button>
          <button className="btn btn--small" title="Read the Data sheet of the Character Builder workbook" onClick={() => xlsxRef.current?.click()}>From workbook (.xlsx)</button>
          <button className="btn btn--small btn--ghost" onClick={() => { if (window.confirm("Reset every rule to the defaults?")) { rs.reset(); setMsg("Rules reset to defaults."); } }}>Reset</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) importRules(f); e.target.value = ""; }} />
          <input ref={xlsxRef} type="file" accept=".xlsx" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) importWorkbook(f); e.target.value = ""; }} />
        </div>
        {msg && <p className="note">{msg}</p>}
      </div>

      <details className="dev__section" open>
        <summary>Derived <span className="mono">read-only</span></summary>
        <dl className="facts">
          <dt>AscILevel</dt><dd>{lv.ascILevel} <span className="mono">(BandSize + 1)</span></dd>
          <dt>AscIILevel</dt><dd>{lv.ascIILevel} <span className="mono">(2 × BandSize + 1)</span></dd>
          <dt>ExpertiseStart</dt><dd>{lv.expertiseStart}</dd>
        </dl>
      </details>

      <TableEditor title="Parameters" table="params" keyPath="key" rs={rs} open cols={[
        { path: "key", label: "Parameter", kind: "text", width: 110 },
        { path: "value", label: "Value", kind: "number", width: 62 },
        { path: "status", label: "Status", kind: "status", width: 84 },
        { path: "note", label: "Note", kind: "text", width: 220 },
      ]} />
      <TableEditor title="Core classes" table="coreClasses" keyPath="name" rs={rs} cols={[
        { path: "name", label: "Class", kind: "text", width: 80 },
        { path: "aptitude", label: "Aptitude", kind: "select", options: names("aptitudes"), width: 84 },
        { path: "hitDie", label: "HD", kind: "number", width: 44 },
        ...attrCols("points"),
      ]} />
      <TableEditor title="Ascendancies" table="ascendancies" keyPath="name" rs={rs}
        newRow={() => ({ name: "New", coreClass: r.coreClasses[0]?.name ?? "", forbidden: false, hitDie: 8, purequick: false, rage: false, fel: false, maxArmour: "Light", identity: "" })}
        cols={[
          { path: "name", label: "Ascendancy", kind: "text", width: 96 },
          { path: "coreClass", label: "Core", kind: "select", options: names("coreClasses"), width: 84 },
          { path: "hitDie", label: "HD", kind: "number", width: 44 },
          { path: "forbidden", label: "Forb.", kind: "bool" },
          { path: "purequick", label: "PQ", kind: "bool" },
          { path: "rage", label: "Rage", kind: "bool" },
          { path: "fel", label: "Fel", kind: "bool" },
          { path: "maxArmour", label: "Max armour", kind: "select", options: names("armour"), width: 76 },
        ]} />
      <TableEditor title="Races" table="races" keyPath="name" rs={rs}
        newRow={() => ({ name: "New race", lineage: "", speed: null, points: zero(), note: "" })}
        cols={[
          { path: "name", label: "Race", kind: "text", width: 110 },
          { path: "lineage", label: "Lineage", kind: "text", width: 80 },
          { path: "speed", label: "Speed", kind: "nullnum", width: 52 },
          ...attrCols("points"),
        ]} />
      <TableEditor title="Marks and powers" table="marks" keyPath="name" rs={rs}
        newRow={() => ({ name: "New power", kind: "Eye power", pole: "", points: zero(), freePoints: 0, note: "" })}
        cols={[
          { path: "name", label: "Name", kind: "text", width: 84 },
          { path: "kind", label: "Kind", kind: "text", width: 72 },
          { path: "freePoints", label: "Free pts", kind: "number", width: 44 },
          ...attrCols("points"),
        ]} />
      <TableEditor title="Well tiers" table="wellTiers" keyPath="tier" rs={rs} newRow={() => ({ tier: "New", frequency: "", base: 0, growth: 0, ceiling: 0, playerStart: false, note: "" })} cols={[
        { path: "tier", label: "Tier", kind: "text", width: 70 },
        { path: "frequency", label: "Frequency", kind: "text", width: 80 },
        { path: "base", label: "Base", kind: "number" },
        { path: "growth", label: "Growth", kind: "number" },
        { path: "ceiling", label: "Ceiling", kind: "number" },
        { path: "playerStart", label: "Player start", kind: "bool" },
      ]} />
      <TableEditor title="Armour weight" table="armour" keyPath="name" rs={rs} newRow={() => ({ name: "New", order: 0, value: 0 })} cols={[
        { path: "name", label: "Armour", kind: "text", width: 80 },
        { path: "order", label: "Order", kind: "number" },
        { path: "value", label: "Armour value", kind: "number" },
      ]} />
      <TableEditor title="Elements" table="elements" keyPath="name" rs={rs} newRow={() => ({ name: "New", subArts: "" })} cols={[
        { path: "name", label: "Element", kind: "text", width: 80 },
        { path: "subArts", label: "Sub-arts (comma list)", kind: "text", width: 200 },
      ]} />
      <TableEditor title="Combinations" table="combinations" keyPath="name" rs={rs}
        newRow={() => ({ name: "New", rootA: "", rootB: "", forbidden: false, description: "" })}
        cols={[
          { path: "name", label: "Combination", kind: "text", width: 100 },
          { path: "rootA", label: "Root A", kind: "select", options: names("ascendancies"), width: 96 },
          { path: "rootB", label: "Root B", kind: "select", options: names("ascendancies"), width: 96 },
          { path: "forbidden", label: "Forb.", kind: "bool" },
        ]} />
      <TableEditor title="Skills" table="skills" keyPath="name" rs={rs} newRow={() => ({ name: "New skill", attribute: "STR" as const })} cols={[
        { path: "name", label: "Skill", kind: "text", width: 110 },
        { path: "attribute", label: "Attribute", kind: "select", options: () => [...ATTR_KEYS], width: 64 },
      ]} />
    </aside>
  );
}
