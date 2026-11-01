/**
 * The app shell: wires the features together and picks the page. Each piece of state lives in its own hook:
 *   useTreeData      the tree database (or an imported workbook) → model            features/tree
 *   useTreeView      selection, route mode, map toggles                             features/tree
 *   useRules         the rules in use (Dev mode edits)                              features/rules
 *   useSheet         the character sheet                                            features/character/state
 *   useCharacter     name, class, unlocked nodes; tree points = level               features/character/state
 *   useLevelUp       a level up in progress                                         features/character/levelup
 *   useCharacterFiles  save / load / create                                        features/character
 * Pages: pages.ts. Each page component lives in its feature folder.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CombatPage } from "@/features/combat/components/CombatPage";
import { CharacterCreator } from "@/features/character/creator/CharacterCreator";
import { LevelUpCard } from "@/features/character/levelup/LevelUpCard";
import { LevelUpScreen } from "@/features/character/levelup/LevelUpScreen";
import { useLevelUp } from "@/features/character/levelup/useLevelUp";
import { CharacterPage } from "@/features/character/page/CharacterPage";
import { useCharacter } from "@/features/character/state/useCharacter";
import { useSheet } from "@/features/character/state/useSheet";
import { useCharacterFiles } from "@/features/character/useCharacterFiles";
import { DevPanel } from "@/features/dev/DevPanel";
import { EquipmentDrawer, type ShopMode } from "@/features/equipment/shop/EquipmentDrawer";
import { collectBonuses } from "@/features/rules/bonuses";
import { computeCharacter } from "@/features/rules/compute";
import { useRules } from "@/features/rules/useRules";
import { nextSteps } from "@/features/tree/model/unlock";
import { TreePage } from "@/features/tree/TreePage";
import { useTreeData } from "@/features/tree/useTreeData";
import { useTreeView } from "@/features/tree/useTreeView";
import { useFlash } from "@/hooks/useFlash";
import { flagCodec, textCodec, usePersistentState } from "@/hooks/usePersistentState";
import { classStyle } from "@/ui";
import { Header } from "./Header";
import { FULL_WIDTH, type Page } from "./pages";
import { useTheme } from "./useTheme";

export default function App() {
  const view = useTreeView();
  const clearView = useCallback(() => view.clear(), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useTreeData(clearView);
  const { model } = tree;
  const theme = useTheme();
  const rs = useRules();
  const sh = useSheet();
  const lu = useLevelUp();
  // Tree points = keystone points = level (the new level while a level up is in progress).
  const ch = useCharacter(model, tree.source, lu.pending ? lu.pending.to : sh.sheet.level);

  const [page, setPage] = usePersistentState<Page>("page", "tree", textCodec<Page>());
  const [devMode, setDevMode] = usePersistentState("devMode", false, flagCodec);
  const [message, say] = useFlash();
  // Equipment drawer (Add / Purchase / Sell) — takes the left column while open; closes when you leave the page.
  const [shop, setShop] = useState<ShopMode | null>(null);
  useEffect(() => { if (page !== "character") setShop(null); }, [page]);

  // Gear and unlocked tree nodes → one set of bonuses (rules/bonuses.ts), added on top of the sheet.
  const skillNames = useMemo(() => rs.rules.skills.map(k => k.name), [rs.rules]);
  const external = useMemo(() => collectBonuses(sh.sheet, ch.owned, model.effects, skillNames),
    [sh.sheet.equipped, ch.owned, model.effects, skillNames]);   // eslint-disable-line react-hooks/exhaustive-deps
  const computed = useMemo(() => computeCharacter(rs.rules, sh.sheet, ch.className, external), [rs.rules, sh.sheet, ch.className, external]);
  const next = useMemo(() => nextSteps(model.nodes, ch.owned, ch.left), [model, ch.owned, ch.left]);

  const files = useCharacterFiles({ ch, sh, model, source: tree.source, computed, say, onReplaced: lu.clear });

  // ── Level up: Tree (take a node) → Level Up screen (spend points) → Character ──
  const startLevelUp = () => { lu.start(sh.sheet.level, ch); view.clear(); view.stopRoute(); setPage("tree"); };
  const cancelLevelUp = () => { lu.cancel(ch); setPage("character"); };
  const confirmLevelUp = (nextSheet: typeof sh.sheet) => {
    sh.setSheet(nextSheet); lu.clear(); setPage("character");
    say(`${ch.name} reached level ${nextSheet.level}.`);
  };

  const sheetProps = { rules: rs.rules, sh, ch, c: computed };
  const fullWidth = FULL_WIDTH.includes(page);
  const sidebar = shop
    ? <EquipmentDrawer key={shop} mode={shop} sh={sh} onClose={() => setShop(null)} onMessage={say} style={classStyle(ch.className)} />
    : devMode && !fullWidth && <DevPanel rs={rs} />;

  return (
    <div className="app">
      <Header status={message || `Showing: ${tree.error || tree.source}`} warnings={model.warnings} page={page} onPage={setPage}
        theme={theme.theme} onToggleTheme={theme.cycle} onSaveCharacter={files.save} onLoadCharacter={files.load}
        onImportWorkbook={tree.openFile} onBackToDatabase={tree.backToDatabase}
        devMode={devMode} onToggleDev={() => setDevMode(d => !d)} />
      {page === "tree" ? (
        <TreePage model={model} ch={ch} next={next} view={view} classLocked={!devMode} onFileDrop={tree.openFile}
          sidebarTop={lu.pending && <LevelUpCard pending={lu.pending} ch={ch} onContinue={() => setPage("levelup")} onCancel={cancelLevelUp} />} />
      ) : (
        <div className={`charmain${shop ? " charmain--shop" : devMode && !fullWidth ? " charmain--dev" : ""}`}>
          {sidebar}
          <div className={`charmain__page${fullWidth ? " charmain__page--full" : ""}`}>
            {page === "character" && <CharacterPage {...sheetProps} devMode={devMode}
                onCreate={() => setPage("creator")} onLevelUp={startLevelUp} onShop={setShop} onMessage={say} />}
            {page === "creator" && <CharacterCreator key={rs.rules.version} rules={rs.rules}
                onCreate={n => { if (files.create(n)) setPage("character"); }} onCancel={() => setPage("character")} />}
            {page === "combat" && <CombatPage key={`${ch.name}|${sh.sheet.level}|${ch.used}`} rules={rs.rules} c={computed} ch={ch} equipped={sh.sheet.equipped}
                condition={sh.sheet.condition} onFightEnd={cond => sh.update("condition", cond)} devMode={devMode} />}
            {page === "levelup" && (lu.pending
              ? <LevelUpScreen rules={rs.rules} model={model} ch={ch} sheet={sh.sheet} pending={lu.pending} onConfirm={confirmLevelUp} onCancel={cancelLevelUp} />
              : <p className="note">No level up in progress. Press Level up on the Character page to start one.</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
