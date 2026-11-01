/**
 * Dev mode sidebar — edit every rules table live (tables.ts). Changes apply at once and are kept in the browser.
 * Cells that differ from the defaults (src/data/rules.json) are highlighted.
 * To make a change permanent: Export rules, then copy the tables into src/data/rules.json.
 */
import { useState } from "react";
import { downloadJson } from "@/core/files";
import { derivedLevels } from "@/features/rules/compute";
import { rulesFromWorkbook } from "@/features/rules/fromWorkbook";
import { parseRules, rulesFile } from "@/features/rules/rulesFile";
import type { RulesState } from "@/features/rules/useRules";
import { Fact, FileButton } from "@/ui";
import { TableEditor } from "./TableEditor";
import { devTables } from "./tables";

export function DevPanel({ rs }: { rs: RulesState }) {
  const [msg, setMsg] = useState("");
  const lv = derivedLevels(rs.rules);
  const tables = devTables(() => rs.rules);
  const load = (what: (f: File) => Promise<string>) => async (f: File) => {
    try { setMsg(await what(f)); } catch (e) { setMsg(`Couldn't read ${f.name}: ${(e as Error).message}`); }
  };
  const importRules = load(async f => { rs.setRules(parseRules(await f.text())); return `Loaded rules from ${f.name}.`; });
  const importWorkbook = load(async f => { const { rules, found } = await rulesFromWorkbook(f, rs.rules); rs.setRules(rules); return `From ${f.name}: ${found.join(", ")}.`; });

  return (
    <aside className="dev">
      <div className="dev__head">
        <h2>Dev mode · rules</h2>
        <p className="note">Edits apply live and stay in this browser. Highlighted = differs from the defaults.</p>
        <div className="dev__actions">
          <button className="btn btn--small" onClick={() => downloadJson(rulesFile(rs.rules), "farwilds-rules.json")}>Export rules</button>
          <FileButton className="btn btn--small" accept=".json,application/json" onFile={importRules}>Import rules</FileButton>
          <FileButton className="btn btn--small" accept=".xlsx" onFile={importWorkbook} title="Read the Data sheet of the Character Builder workbook">From workbook (.xlsx)</FileButton>
          <button className="btn btn--small btn--ghost" onClick={() => { if (window.confirm("Reset every rule to the defaults?")) { rs.reset(); setMsg("Rules reset to defaults."); } }}>Reset</button>
        </div>
        {msg && <p className="note">{msg}</p>}
      </div>

      <details className="dev__section" open>
        <summary>Derived <span className="mono">read-only</span></summary>
        <dl className="facts">
          <Fact label="AscILevel">{lv.ascILevel} <span className="mono">(BandSize + 1)</span></Fact>
          <Fact label="AscIILevel">{lv.ascIILevel} <span className="mono">(2 × BandSize + 1)</span></Fact>
          <Fact label="ExpertiseStart">{lv.expertiseStart}</Fact>
        </dl>
      </details>

      {tables.map(t => <TableEditor key={t.table} def={t} rs={rs} />)}
    </aside>
  );
}
