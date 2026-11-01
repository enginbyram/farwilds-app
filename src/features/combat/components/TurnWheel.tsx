/** Initiative wheel: one wedge per combatant, clockwise from the top in turn order; the dot marks whose turn it is. */
import { shorten } from "@/core/format";
import type { CombatState } from "../engine";

export function TurnWheel({ fight, setup }: { fight: CombatState; setup: boolean }) {
  const size = 300, cx = size / 2, cy = size / 2, R = 136, r = 92;
  const order = fight.order;
  const n = Math.max(1, order.length);
  const pt = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  const wedge = (i: number) => {
    const gap = n > 1 ? 0.025 : 0, a0 = (i / n) * 2 * Math.PI + gap, a1 = ((i + 1) / n) * 2 * Math.PI - gap;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    if (n === 1) return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const cur = order[fight.cursor];
  const curAngle = ((fight.cursor + 0.5) / n) * 2 * Math.PI;
  const [px, py] = pt(R + 10, curAngle);
  return (
    <div className="wheel-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="turnwheel" role="img" aria-label="Turn order">
        <circle cx={cx} cy={cy} r={R + 4} className="tw__ring" />
        <circle cx={cx} cy={cy} r={r - 4} className="tw__ring" />
        {setup && <circle cx={cx} cy={cy} r={(R + r) / 2} className="tw__idle" />}
        {order.map((o, i) => {
          const foe = fight.foes.find(x => x.key === o.key);
          const dead = !!foe && foe.hpNow <= 0;
          const mid = ((i + 0.5) / n) * 2 * Math.PI, [lx, ly] = pt((R + r) / 2, mid);
          const isCur = i === fight.cursor && !fight.result;
          return (
            <g key={o.key} className={`tw__seg tw__seg--${o.side}${dead ? " tw__seg--dead" : ""}${isCur ? " tw__seg--cur" : ""}`}>
              <path d={wedge(i)} />
              <text x={lx} y={ly - 3} textAnchor="middle" className="tw__name">{o.side === "you" ? "You" : shorten(o.name)}</text>
              <text x={lx} y={ly + 11} textAnchor="middle" className="tw__init">{o.total}</text>
            </g>
          );
        })}
        {!setup && cur && !fight.result && <circle cx={px} cy={py} r={5} className="tw__pointer" />}
        <text x={cx} y={cy - 6} textAnchor="middle" className="tw__round">{setup ? "Ready" : `Round ${fight.round}`}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="tw__who">
          {setup ? "Start the fight to roll initiative" : fight.result ? fight.result.toUpperCase() : cur?.side === "you" ? "Your turn" : `${cur?.name ?? ""}'s turn`}
        </text>
      </svg>
    </div>
  );
}
