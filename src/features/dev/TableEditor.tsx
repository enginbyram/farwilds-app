/**
 * A generic editable table for one rules table (Dev mode). Columns are described as data (Col), so any
 * table can be edited without new UI code. Cells that differ from the defaults are highlighted.
 */
import { getPath, setPath } from "@/core/objects";
import type { RulesState } from "@/features/rules/useRules";
import type { Rules } from "@/features/rules/types";

export type CellKind = "number" | "text" | "bool" | "select" | "nullnum" | "status";
/** One column: where the value lives in a row ("points.STR"), its header, and how it is edited. */
export interface Col { path: string; label: string; kind: CellKind; options?: () => string[]; width?: number; }

/** A rules table that is a list of rows. */
export type ListTable = { [K in keyof Rules]: Rules[K] extends unknown[] ? K : never }[keyof Rules];
type Row<K extends ListTable> = Rules[K] extends (infer R)[] ? R : never;

/** One table on the Dev panel. `keyPath` matches a row to its default row (by name), for change highlighting. */
export interface TableDef<K extends ListTable = ListTable> {
  title: string; table: K; keyPath: string; cols: Col[]; newRow?: (rules: Rules) => Row<K>; open?: boolean;
}

const STATUSES = ["Settled", "Proposed", "Open"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function Cell({ col, value, changed, onChange }: { col: Col; value: unknown; changed: boolean; onChange: (v: unknown) => void }) {
  const cls = `in in--dev${changed ? " in--changed" : ""}`;
  const style = { width: col.width ?? (col.kind === "text" ? 120 : 52) };
  switch (col.kind) {
    case "bool":
      return <input type="checkbox" className={changed ? "in--changed" : ""} checked={!!value} onChange={e => onChange(e.target.checked)} aria-label={col.label} />;
    case "select":
    case "status": {
      const opts = col.kind === "status" ? STATUSES : col.options?.() ?? [];
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

export function TableEditor({ def, rs }: { def: TableDef; rs: RulesState }) {
  const { title, table, cols, keyPath, newRow, open } = def;
  const rows = rs.rules[table] as unknown as Record<string, unknown>[];
  const defaults = rs.defaults[table] as unknown as Record<string, unknown>[];
  const defaultOf = (r: Record<string, unknown>) => defaults.find(x => getPath(x, keyPath) === getPath(r, keyPath));
  const changedCount = rows.reduce((t, r) => {
    const d = defaultOf(r);
    return t + (d ? cols.filter(c => !same(getPath(r, c.path), getPath(d, c.path))).length : 1);
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
              const d = defaultOf(r);
              return (
                <tr key={i}>
                  {cols.map(c => (
                    <td key={c.path}>
                      <Cell col={c} value={getPath(r, c.path)} changed={!d || !same(getPath(r, c.path), getPath(d, c.path))}
                        onChange={v => setRows(rows.map((x, j) => (j === i ? setPath(x, c.path, v) : x)))} />
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
      {newRow && <button className="btn btn--small" onClick={() => setRows([...rows, newRow(rs.rules) as unknown as Record<string, unknown>])}>+ Add row</button>}
    </details>
  );
}
