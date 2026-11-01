/**
 * Combat screen.
 *   left third   — foes (FoeColumn)            centre — turn wheel and log (TurnWheel, CombatLog)
 *   right third  — you and allies (PartyColumn) bottom — BottomBar: End turn, gauges, drawers, tray
 * Drawers (ActionDrawer), the tray (PassiveTray) and Dev tools (DevTools) float over the screen and never push anything.
 * Fight logic: ../engine. What each skill does: ../mechanics. Sheet → fighter: ../fighter.ts.
 */
import { useMemo, useState } from "react";
import type { Character } from "@/features/character/state/useCharacter";
import type { Computed } from "@/features/rules/compute";
import type { Condition, Item, Rules } from "@/features/rules/types";
import { useKeydown } from "@/hooks/useKeydown";
import { classStyle } from "@/ui";
import { ATTACK, COMBAT, SKILL_IDS, SKILLS, cardSlot, passiveState, type FoeDef, type Owned, type PlayOptions, type Slot } from "../engine";
import { buildFighter, weaponChoices } from "../fighter";
import { usesRage } from "../mechanics";
import { useCombat } from "../useCombat";
import { ActionDrawer } from "./ActionDrawer";
import { BottomBar } from "./BottomBar";
import { CombatLog } from "./CombatLog";
import { DevTools } from "./DevTools";
import { FoeColumn } from "./FoeColumn";
import { PartyColumn } from "./PartyColumn";
import { PassiveTray, TrayButton } from "./PassiveTray";
import { ResultBanner } from "./ResultBanner";
import { TurnWheel } from "./TurnWheel";

const CARD_ACTIONS = ["active", "side", "misc"];

export function CombatPage({ rules, c, ch, equipped, condition, onFightEnd, devMode }: {
  rules: Rules; c: Computed; ch: Character; equipped: Record<string, Item>;
  condition: Condition; onFightEnd: (next: Condition) => void; devMode: boolean;
}) {
  // ── Setup: skills in play, weapon, armour, foes ──
  const onTree = useMemo<Owned>(() => new Set([...ch.owned].map(n => n.id).filter(id => id in SKILLS)), [ch.owned]);
  const [owned, setOwned] = useState<Owned>(() => new Set(onTree));
  const weapons = useMemo(() => weaponChoices(equipped, devMode), [equipped, devMode]);
  const [weaponKey, setWeaponKey] = useState(() => weapons[0].key);
  const [armourName, setArmourName] = useState("None");   // Dev mode: a test armour tier on top of gear
  const [foes, setFoes] = useState<FoeDef[]>(() => [COMBAT.foes[0], COMBAT.foes[0]].map(f => ({ ...f })));
  const [opt, setOpt] = useState<PlayOptions>({ pastRedDoublesRageDice: false, biteSpend: 4 });

  const weapon = weapons.find(w => w.key === weaponKey) ?? weapons[0];
  const testArmour = devMode ? rules.armour.find(a => a.name === armourName) : undefined;
  const { fighter, condLines } = buildFighter({ rules, c, name: ch.name, weapon, equipped, condition, owned, testArmour });

  // ── Fight ──
  const combat = useCombat({ fighter, foes, owned, condition, onFightEnd, rebuildOn: [foes, weaponKey, armourName, owned] });
  const { fight } = combat;
  const [drawer, setDrawer] = useState<Slot | "">("");
  const [tray, setTray] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  useKeydown("Escape", () => { setDrawer(""); setTray(false); setDevOpen(false); });

  // Cards in each drawer: owned skills of that slot (+ the plain weapon attack under Main).
  const cards = (slot: Slot) => [
    ...(slot === "active" ? [ATTACK] : []),
    ...SKILL_IDS.filter(id => owned.has(id) && cardSlot(id) === slot && CARD_ACTIONS.includes(SKILLS[id].action)),
  ];
  const trayIds = SKILL_IDS.filter(id => owned.has(id) && (SKILLS[id].action === "passive" || SKILLS[id].action === "reaction"));
  const lit = passiveState(fight, owned, fighter);

  return (
    <div className="cb" style={classStyle(ch.className)}>
      <div className="cb__main">
        <FoeColumn fight={fight} setup={combat.setup} foes={foes} setFoes={setFoes} targetKey={combat.targetKey} onTarget={combat.setTargetKey} />
        <section className="cb__col cb__centre">
          <TurnWheel fight={fight} setup={combat.setup} />
          <CombatLog fight={fight} />
        </section>
        <PartyColumn fight={fight} fighter={fighter} c={c} rules={rules} weapons={weapons} weapon={weapon} onWeapon={setWeaponKey}
          armourName={armourName} onArmour={setArmourName} condLines={condLines} devMode={devMode}
          noRagePool={!c.pools.rage && [...owned].some(usesRage)} />
      </div>

      {drawer && (
        <ActionDrawer slot={drawer} cards={cards(drawer)} fight={fight} owned={owned} targetKey={combat.targetKey} fighter={fighter} weapon={weapon}
          opt={opt} setOpt={setOpt} onPlay={id => { combat.play(id, opt); setDrawer(""); }} onClose={() => setDrawer("")} />
      )}
      {tray && <PassiveTray ids={trayIds} lit={lit} owned={owned} />}
      {devMode && devOpen && (
        <DevTools owned={owned} setOwned={setOwned} onTree={onTree} opt={opt} setOpt={setOpt} myTurn={combat.myTurn}
          fighter={fighter} foes={foes} onAutopilot={p => combat.autopilot(p, opt)} onClose={() => setDevOpen(false)} />
      )}
      <ResultBanner fight={fight} onNew={() => { setDrawer(""); combat.reset(); }} />

      <BottomBar combat={combat} fighter={fighter} c={c} foesReady={foes.length > 0} drawer={drawer} setDrawer={setDrawer}
        miscCount={cards("misc").length} devMode={devMode} devOpen={devOpen} onDevToggle={() => setDevOpen(o => !o)}
        tray={<TrayButton ids={trayIds} lit={lit} open={tray} onToggle={() => setTray(t => !t)} />} />
    </div>
  );
}
