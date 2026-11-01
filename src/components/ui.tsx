/** Small shared pieces for the character pages. */
import type { Focus } from "@/rules/compute";

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** A value that explains itself on hover (or keyboard focus): one line per part. */
export function Hint({ lines, children, className = "" }: { lines: (string | [string, string | number])[]; children: React.ReactNode; className?: string }) {
  return (
    <span className={`hint ${className}`} tabIndex={0}>
      {children}
      <span className="hint__box" role="tooltip">
        {lines.map((l, i) => typeof l === "string"
          ? <span key={i} className="hint__line hint__line--text">{l}</span>
          : <span key={i} className="hint__line"><span>{l[0]}</span><b>{l[1]}</b></span>)}
      </span>
    </span>
  );
}

/** STR / +2 style tag. Main = gold outline, Side = grey outline, none = greyed. */
export function Badge({ focus, children, title }: { focus: Focus; children: React.ReactNode; title?: string }) {
  return <span className={`badge badge--${focus ? focus.toLowerCase() : "none"}`} title={title}>{children}</span>;
}

/**
 * Radial gauge — the one gauge style used everywhere (same language as the turn wheel).
 * Always sliced: one slice per point. Above 40 points a slice stands for 2, 5, 10… points so the ring stays readable.
 * `marks` outlines given points (e.g. Rage thresholds). `kind` picks the colour (hp, foe, rage, quick, pq, sanity, points…).
 */
export function RadialGauge({ now, max, label, kind = "hp", size = 58, marks = [], title, showMax = false }: {
  now: number; max: number; label?: string; kind?: string; size?: number; marks?: number[]; title?: string; showMax?: boolean;
}) {
  const safeMax = Math.max(1, max);
  const step = safeMax <= 40 ? 1 : [2, 5, 10, 20, 50, 100].find(x => safeMax / x <= 40) ?? Math.ceil(safeMax / 40);
  const segs = Math.ceil(safeMax / step);
  const filled = Math.max(0, Math.min(segs, Math.round(now / step)));
  const c = size / 2, w = Math.max(4, size * 0.11), r = c - w / 2 - 1;
  const gap = Math.min(0.08, (Math.PI * 2 / segs) * 0.22);
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const tip = title ?? `${label ? `${label} ` : ""}${now} / ${max}${step > 1 ? ` · each slice = ${step}` : ""}`;
  return (
    <span className={`gauge gauge--${kind}`} title={tip} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={now}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        {segs === 1
          ? <circle cx={c} cy={c} r={r} strokeWidth={w} className={`gauge__seg${filled ? " on" : ""}`} />
          : Array.from({ length: segs }, (_, i) => {
              const a0 = (i / segs) * 2 * Math.PI + gap, a1 = ((i + 1) / segs) * 2 * Math.PI - gap;
              return <path key={i} d={arc(a0, a1)} strokeWidth={w} className={`gauge__seg${i < filled ? " on" : ""}${marks.includes((i + 1) * step) ? " mark" : ""}`} />;
            })}
        <text x={c} y={c + size * 0.075} textAnchor="middle" className="gauge__num" style={{ fontSize: Math.max(10, size * 0.23) }}>{now}</text>
        {showMax && <text x={c} y={c + size * 0.27} textAnchor="middle" className="gauge__max" style={{ fontSize: Math.max(8, size * 0.13) }}>/ {max}</text>}
      </svg>
      {label && <span className="gauge__label">{label}</span>}
    </span>
  );
}

/** Simple line icons (24×24, stroke = currentColor). Placeholders until there are real graphics. */
const ICONS: Record<string, string> = {
  hp: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  armour: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  initiative: "M13 2L4 14h7l-1 8 9-12h-7z",
  speed: "M4 6l6 6-6 6M12 6l6 6-6 6",
  melee: "M14.5 3.5H20v5.5L9 20l-5-5zM4 15l5 5M3 21l2.5-2.5",
  ranged: "M4 20L20 4M14 4h6v6M4 20l1.5-4.5L8.5 18.5z",
  spell: "M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.3l6.1-.7z",
  leech: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM9.5 14a2.5 2.5 0 0 0 2.5 2.5",
  Fire: "M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4 2.5-6.5C11 8 12 10 12 12c1-2 .5-5 0-9z",
  Water: "M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0",
  Earth: "M3 20l6-10 4 6 3-4 5 8z",
  Air: "M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h6",
  keystone: "M12 3l8 9-8 9-8-9z",
  expertise: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l16 9M20 7.5l-16 9",
  mark: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  race: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  die: "M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9zM12 2.5l-5 8.5h10zM7 11l5 10.5L17 11M3.5 7.5L7 11M20.5 7.5L17 11",
  none: "M5 12h14",
};
export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`icon icon--${name.toLowerCase()} ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ICONS.none} />
    </svg>
  );
}
