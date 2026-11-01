/** Level up, step 1: this card sits on top of the Tree sidebar while you unlock the new level's node. */
import type { Character } from "@/features/character/state/useCharacter";
import { plural } from "@/core/format";
import type { PendingLevelUp } from "./types";

export function LevelUpCard({ pending, ch, onContinue, onCancel }: {
  pending: PendingLevelUp; ch: Character; onContinue: () => void; onCancel: () => void;
}) {
  const taken = ch.unlockedIds.filter(id => !pending.snapshot.includes(id)).length;
  return (
    <section className="card levelup-card">
      <h2>Level up · {pending.from} → {pending.to}</h2>
      <p className="title">{taken ? "Node taken" : "Choose a node"}</p>
      <p className="note" style={{ marginTop: 4 }}>
        {ch.left > 0 ? `Unlock a node on the map — ${plural(ch.left, "point")} to spend.` : "All points spent. Continue to the Level Up screen."}
      </p>
      <div className="node-card__actions" style={{ marginTop: 10 }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--success" style={{ flex: 1 }} onClick={onContinue}>
          {ch.left > 0 ? "Continue without a node" : "Continue"}
        </button>
      </div>
    </section>
  );
}
