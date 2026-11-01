/** The fixed bar at the bottom of the Combat page: fight buttons, your gauges and status chips, the drawer buttons, Dev tools and the tray. */
import type { Computed } from "@/features/rules/compute";
import { RadialGauge } from "@/ui";
import { rule, statusChips, type Fighter, type Slot } from "../engine";
import type { Combat } from "../useCombat";

const DRAWERS = [["active", "Main"], ["side", "Side"], ["misc", "Misc"]] as const;

export function BottomBar({ combat, fighter, c, foesReady, drawer, setDrawer, miscCount, devMode, devOpen, onDevToggle, tray }: {
  combat: Combat; fighter: Fighter; c: Computed; foesReady: boolean;
  drawer: Slot | ""; setDrawer: (d: Slot | "") => void; miscCount: number;
  devMode: boolean; devOpen: boolean; onDevToggle: () => void; tray: React.ReactNode;
}) {
  const { fight, setup, myTurn } = combat;
  const downed = (fighter.hpStart ?? 1) <= 0;
  const R = fighter.rageMax;
  const over = fight.phase === "over";
  const close = (then: () => void) => () => { setDrawer(""); then(); };
  const status = setup ? "Ready" : myTurn ? "Your turn" : fight.phase === "foes" ? "Foes acting" : "Fight over";
  return (
    <footer className="cb__bar">
      <div className="cb__bar-left">
        {setup && <button className="btn btn--class btn--big" onClick={close(combat.start)} disabled={!foesReady || downed}
          title={downed ? "Downed at 0 HP — take a long rest on the Character page" : undefined}>{downed ? "Downed — rest first" : "Start fight"}</button>}
        {!setup && !over && <button className="btn btn--class btn--big" onClick={close(combat.endTurn)} disabled={!myTurn}>{myTurn ? "End turn" : "Foes acting…"}</button>}
        {over && <button className="btn btn--class btn--big" onClick={close(combat.reset)}>New fight</button>}
        {!setup && !over && <button className="btn btn--small btn--ghost" onClick={close(combat.reset)} title="Abandon this fight">Reset</button>}
      </div>

      <div className="cb__me">
        <div className="cb__me-name"><b>{fighter.name}</b><span>{status} · Round {fight.round || "—"}</span></div>
        <div className="gauges">
          <RadialGauge label="HP" now={Math.max(0, fight.hp)} max={fighter.hpMax} kind="hp" />
          {R > 0 && <RadialGauge label="Rage" now={fight.rage} max={R} kind="rage" marks={[rule("RageThreshold"), R]} />}
          {c.pools.quick > 0 && <RadialGauge label="Quick" now={c.pools.quick} max={c.pools.quick} kind="quick" />}
          {c.pools.purequick !== null && c.pools.purequick > 0 && <RadialGauge label="Purequick" now={c.pools.purequick} max={c.pools.purequick} kind="pq" />}
          <RadialGauge label="Sanity" now={Math.max(0, fighter.sanity - fight.sanityLost)} max={Math.max(1, fighter.sanity)} kind="sanity" />
        </div>
        <div className="cb__chips">
          {statusChips(fight).map(ch => <span key={ch.text} className={`cb-chip${ch.warn ? " cb-chip--warn" : ""}`} title={ch.title}>{ch.text}</span>)}
        </div>
      </div>

      <div className="cb__drawers">
        {DRAWERS.map(([slot, label]) => (
          <button key={slot} className={`cb-slot${drawer === slot ? " cb-slot--open" : ""}${slot !== "misc" && myTurn && !fight.used[slot] ? " cb-slot--ready" : ""}`}
            onClick={() => setDrawer(drawer === slot ? "" : slot)} aria-expanded={drawer === slot}>
            <span>{label}</span>
            <small>{slot === "misc" ? `${miscCount}` : !myTurn ? "—" : fight.used[slot] ? "used" : "1 left"}</small>
          </button>
        ))}
      </div>

      <div className="cb__bar-right">
        {devMode && <button className={`btn btn--small${devOpen ? " btn--dev" : ""}`} onClick={onDevToggle}>Dev tools</button>}
        {tray}
      </div>
    </footer>
  );
}
