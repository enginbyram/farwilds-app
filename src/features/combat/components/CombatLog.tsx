/** The combat log: engine lines with ⟦kind|text⟧ markup drawn as coloured pills, and centred turn/round dividers. */
import { useEffect, useRef } from "react";
import type { CombatState } from "../engine";

/** Turns "⟦kind|text⟧" markup from the engine into coloured pills. */
function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const re = /⟦(\w+)\|([^⟧]*)⟧/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={i++} className={`pill pill--${m[1]}`}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function CombatLog({ fight }: { fight: CombatState }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [fight.log.length]);
  return (
    <ol className="cb__log" ref={ref} aria-label="Combat log">
      {fight.log.length === 0 && <li className="log--sys">Set up the foes on the left, then press Start fight.</li>}
      {fight.log.map((l, i) => l.kind === "turn" || l.kind === "round"
        ? <li key={i} className={`log-div log-div--${l.kind}`}><span>{l.text}</span></li>
        : <li key={i} className={`log--${l.who}`}><Rich text={l.text} /></li>)}
    </ol>
  );
}
