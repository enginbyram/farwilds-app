/** Tree sidebar: the selected node — what it is, what it gives, Unlock / Refund. */
import type { TreeNode } from "@/features/tree/types";
import type { Character } from "@/features/character/state/useCharacter";
import { clusterRuleText, type NextSteps } from "@/features/tree/model/unlock";
import { s } from "@/core/format";

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
        <div><dt>Cost</dt><dd>{node.points} pt{s(node.points)}</dd></div>
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
          Unlock · {node.points} pt{s(node.points)}
        </button>
      )}
      {!unlocked && !unlock.ok && <p className="reason">{unlock.reason}</p>}
      {unlocked && !refund.ok && refund.reason && <p className="reason reason--muted">{refund.reason}</p>}
      <span className="mono node-card__id">{node.id}{node.sourceFile && ` · ${node.sourceFile}`}</span>
    </section>
  );
}
