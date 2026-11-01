/** The title bar: page tabs, the status line, data warnings, and the actions for the page you are on. */
import { useState } from "react";
import { FileButton } from "@/ui";
import { TABS, type Page } from "./pages";
import type { Theme } from "./useTheme";

/** Copies the map as SVG, with CSS variables replaced by real colours so it works outside the app (Inkscape, Figma…). */
async function copyMapSvg(): Promise<boolean> {
  const svg = document.querySelector(".map svg");
  if (!svg) return false;
  const cs = getComputedStyle(document.documentElement);
  const markup = new XMLSerializer().serializeToString(svg).replace(/var\((--[a-z-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim());
  try { await navigator.clipboard.writeText(markup); return true; } catch { return false; }
}

export function Header({ status, warnings, page, onPage, theme, onToggleTheme, onSaveCharacter, onLoadCharacter,
  onImportWorkbook, onBackToDatabase, devMode, onToggleDev }: {
  status: string;
  warnings: string[];
  page: Page;
  onPage: (p: Page) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onSaveCharacter: () => void;
  onLoadCharacter: (f: File) => void;
  onImportWorkbook: (f: File) => void;
  onBackToDatabase: (() => void) | null;   // set while an imported workbook is shown
  devMode: boolean;
  onToggleDev: () => void;
}) {
  const [copied, setCopied] = useState("Copy SVG");
  const copy = async () => {
    if (!document.querySelector(".map svg")) return;
    setCopied((await copyMapSvg()) ? "Copied" : "Copy blocked");
    setTimeout(() => setCopied("Copy SVG"), 1600);
  };

  return (
    <header className="header">
      <h1>Farwilds Tree</h1>
      <nav className="tabs" aria-label="Pages">
        {TABS.map(t => <button key={t.id} className={`tab${page === t.id ? " tab--on" : ""}`} onClick={() => onPage(t.id)}>{t.label}</button>)}
      </nav>
      <span className="source">{status}</span>
      {warnings.length > 0 && (
        <details className="warnings-badge">
          <summary>{warnings.length} data warning{warnings.length === 1 ? "" : "s"}</summary>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
      <div className="actions">
        <button className="btn" onClick={onSaveCharacter} title="Download this character as a .json file">Save character</button>
        <FileButton accept=".json,application/json" onFile={onLoadCharacter}>Load character</FileButton>
        {page === "tree" ? (
          <>
            {onBackToDatabase && <button className="btn primary" onClick={onBackToDatabase}>Back to JSON database</button>}
            <FileButton accept=".xlsx,.xls" onFile={onImportWorkbook} title="View an old .xlsx workbook. The JSON files stay the real database.">Import .xlsx</FileButton>
            <button className="btn" onClick={copy}>{copied}</button>
          </>
        ) : (
          <button className={`btn${devMode ? " btn--dev" : ""}`} onClick={onToggleDev} aria-pressed={devMode}
            title="Edit every rules table and the character's identity, for testing">Dev mode: {devMode ? "on" : "off"}</button>
        )}
        <button className="btn" onClick={onToggleTheme} title="Theme">Theme: {theme}</button>
      </div>
    </header>
  );
}
