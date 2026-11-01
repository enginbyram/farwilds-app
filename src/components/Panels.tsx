/** Sidebar cards, top to bottom: Character → Node → Route. */
import type { Route, TreeModel, TreeNode } from "@/data/types";
import type { Character } from "@/hooks/useCharacter";
import { clusterRuleText, type NextSteps } from "@/model/character";

// ── 1. Character ────────────────────────────────────────────
export function CharacterCard({ model, ch, classLocked }: { model: TreeModel; ch: Character; classLocked?: boolean }) {
  const classes = [...model.classes.values()].filter(c => c.name !== "Centre");
  const pct = Math.min(100, (ch.used / ch.total) * 100);
  return (
    <section className="card character">
      <input className="character__name" value={ch.name} aria-label="Character name"
        onChange={e => ch.setName(e.target.value)} spellCheck={false} />
      <div className="character__row">
        <select className="character__class" aria-label="Class" value={ch.className} disabled={classLocked}
          title={classLocked ? "The class is chosen in the Creator (Dev mode unlocks it here)" : undefined}
          onChange={e => ch.setClassName(e.target.value)}>
          {classes.map(c => <option key={c.name} value={c.name}>{c.name} · {c.aptitude}</option>)}
        </select>
        <button className="btn btn--small btn--ghost" onClick={ch.reset} disabled={ch.used === 0} title="Refund every node">Reset</button>
      </div>
      <div className="numbers">
        <div><b>{ch.left}</b><span>points left</span></div>
        <div><b>{ch.used}</b><span>used</span></div>
        <div><b>{ch.total}</b><span>total (= level)</span></div>
      </div>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={ch.total} aria-valuenow={ch.used}><i style={{ width: `${pct}%` }} /></div>
    </section>
  );
}

// ── 2. Node ─────────────────────────────────────────────────
export function NodeCard({ node, ch, next }: { node: TreeNode | null; ch: Character; next: NextSteps }) {
  if (!node) {
    return (
      <section className="card node-card">
        <h2>Node</h2>
        <p className="note" style={{ margin: 0 }}>Click a node on the map to read it and unlock it.</p>
      </section>
    );
  }
  const gemFile = node.sourceFile.replace(/^nodes\//, "gems/");
  const unlocksNext = next.requirements.get(node) ?? [];
  const unlocked = ch.owned.has(node);
  const unlock = ch.unlockVerdict(node);
  const refund = ch.refundVerdict(node);
  const requirement = [clusterRuleText(node), node.required ? `Requires ${node.required.name}` : "", node.requirementText].filter(Boolean).join(" · ");

  return (
    <section className="card node-card">
      <h2>{unlocked ? "Unlocked" : "Node"}</h2>
      <p className="title">{node.name}</p>
      <dl className="meta">
        <div><dt>Class</dt><dd>{node.className}</dd></div>
        <div><dt>Type</dt><dd>{node.type}</dd></div>
        <div><dt>Cost</dt><dd>{node.points} pt{node.points === 1 ? "" : "s"}</dd></div>
        <div><dt>Requirement</dt><dd>{requirement || "—"}</dd></div>
      </dl>
      {node.description
        ? <p className="description">{node.description}</p>
        : <p className="description placeholder">No description yet — add one under "{node.id}" in {gemFile}.</p>}
      {node.flavor && <p className="flavor">{node.flavor}</p>}
      {node.bonuses.length > 0 && (
        <>
          <h3>Bonuses</h3>
          <ul className="bonuses">{node.bonuses.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </>
      )}
      {unlocksNext.length > 0 && !unlocked &&
        <p className="hint hint--req">Required for {unlocksNext.map(n => n.name).join(", ")}.</p>}
      {unlocked ? (
        <div className="node-card__actions">
          <button className="btn btn--success" disabled>Unlocked</button>
          {node !== ch.start && <button className="btn" disabled={!refund.ok} onClick={() => ch.refund(node)}>Refund</button>}
        </div>
      ) : (
        <button className="btn btn--success btn--block" disabled={!unlock.ok} onClick={() => ch.unlock(node)}>
          Unlock · {node.points} pt{node.points === 1 ? "" : "s"}
        </button>
      )}
      {!unlocked && !unlock.ok && <p className="reason">{unlock.reason}</p>}
      {unlocked && !refund.ok && refund.reason && <p className="reason reason--muted">{refund.reason}</p>}
      <span className="mono node-card__id">{node.id}{node.sourceFile && ` · ${node.sourceFile}`}</span>
    </section>
  );
}

// ── 3. Route ────────────────────────────────────────────────
export function RouteCard({ active, picks, route, onStart, onStop }: {
  active: boolean; picks: TreeNode[]; route: Route | null; onStart: () => void; onStop: () => void;
}) {
  let body: JSX.Element | null = null;
  if (active && picks.length === 0) body = <p className="note">Click a start node on the map, then a target.</p>;
  else if (active && picks.length === 1) body = <p className="note">From <b>{picks[0].name}</b>. Now click the target.</p>;
  else if (active && !route) body = <p className="reason">No path between {picks[0].name} and {picks[1].name}.</p>;
  else if (active && route) {
    const main = route.steps.filter(s => !s.isRequirement), reqs = route.steps.filter(s => s.isRequirement);
    body = (
      <>
        <div className="route-cost">{route.cost} <small>points</small></div>
        <div>{picks[0].name} → {picks[1].name}</div>
        <dl className="facts">
          <dt>Path</dt><dd>{main.reduce((t, s) => t + s.cost, 0)} pts</dd>
          {reqs.map(s => (
            <FactRow key={s.target.id} label={`+ ${s.target.name}`}>
              {s.cost} pts {s.requiredBy && <span className="mono">(required by {s.requiredBy.name})</span>}
            </FactRow>
          ))}
        </dl>
        {route.steps.map((s, i) => <p key={i} className="path">{s.isRequirement ? "req: " : ""}{s.path.map(n => n.id).join(" → ")}</p>)}
      </>
    );
  }
  return (
    <section className="card">
      <h2>Route</h2>
      {!active && <p className="note" style={{ marginTop: 0 }}>Measure the cheapest path between two nodes, including every parent 2 it needs.</p>}
      {body}
      <button className={`btn${active ? "" : " primary"}`} style={{ marginTop: 10 }} onClick={active ? onStop : onStart}>
        {active ? "Exit route mode" : "Start route mode"}
      </button>
    </section>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <><dt>{label}</dt><dd>{children}</dd></>;
}
