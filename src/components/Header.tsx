import { useState } from "react";

export type Page = "tree" | "character" | "creator" | "levelup" | "combat";

export function Header({ source, warnings, onFile, onBackToDatabase, theme, onToggleTheme,
  page, onPage, onSaveCharacter, onLoadCharacter, devMode, onToggleDev, message }: {
  source: string;
  warnings: string[];
  onFile: (f: File) => void;
  onBackToDatabase: (() => void) | null;   // set while an imported workbook is shown
  theme: "light" | "dark" | "system";
  onToggleTheme: () => void;
  page: Page;
  onPage: (p: Page) => void;
  onSaveCharacter: () => void;
  onLoadCharacter: (f: File) => void;
  devMode: boolean;
  onToggleDev: () => void;
  message: string;
}) {
  const [copied, setCopied] = useState("Copy SVG");

  const copySvg = async () => {
    const svg = document.querySelector(".map svg");
    if (!svg) return;
    // Replace CSS variables with real colours so the SVG works outside the app (Inkscape, Figma…).
    const cs = getComputedStyle(document.documentElement);
    const markup = new XMLSerializer().serializeToString(svg)
      .replace(/var\((--[a-z-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim());
    try { await navigator.clipboard.writeText(markup); setCopied("Copied"); }
    catch { setCopied("Copy blocked"); }
    setTimeout(() => setCopied("Copy SVG"), 1600);
  };

  return (
    <header className="header">
      <h1>Farwilds Tree</h1>
      <nav className="tabs" aria-label="Pages">
        <button className={`tab${page === "tree" ? " tab--on" : ""}`} onClick={() => onPage("tree")}>Tree</button>
        <button className={`tab${page === "character" ? " tab--on" : ""}`} onClick={() => onPage("character")}>Character</button>
        <button className={`tab${page === "combat" ? " tab--on" : ""}`} onClick={() => onPage("combat")}>Combat</button>
      </nav>
      <span className="source">{message || `Showing: ${source}`}</span>
      {warnings.length > 0 && (
        <details className="warnings-badge">
          <summary>{warnings.length} data warning{warnings.length === 1 ? "" : "s"}</summary>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
      <div className="actions">
        <button className="btn" onClick={onSaveCharacter} title="Download this character as a .json file">Save character</button>
        <label className="btn">
          Load character
          <input type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f) onLoadCharacter(f); e.target.value = ""; }} />
        </label>
        {page === "tree" ? (
          <>
            {onBackToDatabase && <button className="btn primary" onClick={onBackToDatabase}>Back to JSON database</button>}
            <label className="btn" title="View an old .xlsx workbook. The JSON files stay the real database.">
              Import .xlsx
              <input type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </label>
            <button className="btn" onClick={copySvg}>{copied}</button>
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
