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
  defence: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
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
  // gear slots
  head: "M5 15a7 7 0 0 1 14 0v4H5zM12 8v11M5 15h14",
  neck: "M6 3c0 6 3 9 6 9s6-3 6-9M12 12v2M12 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  shoulders: "M3 16c0-5 4-8 9-8s9 3 9 8zM12 8v8M7.5 9.5v6.5M16.5 9.5v6.5",
  back: "M8 3h8l3 18H5zM8 3L7 9M16 3l1 6",
  chest: "M8 3L4 6v14h16V6l-4-3c0 2-2 3.5-4 3.5S8 5 8 3zM12 6.5V20",
  wrists: "M7 5h10l-1 14H8zM7.4 10h9.2M7.8 15h8.4",
  hands: "M7 21v-7L5 10.5a1.5 1.5 0 0 1 2.6-1.5L9 11V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V6a1.5 1.5 0 0 1 3 0v9c0 3.5-2 6-5 6z",
  waist: "M3 10h18v5H3zM10 9h4v7h-4z",
  legs: "M6 3h12l-1 18h-4l-1-11-1 11H7zM6 6h12",
  feet: "M8 3h6v10l6 3v4H5v-4l3-2zM5 18h15",
  ring: "M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9.5 3h5L12 8z",
  // wealth and bag
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  gem: "M7 4h10l4 5-9 11L3 9zM3 9h18M9 4l3 5 3-5M12 9v11",
  jewellery: "M12 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 4h8l-4 6z",
  art: "M4 5h16v14H4zM4 15l5-5 4 4 2-2 5 5M15 8.5a1 1 0 1 0 0 .1",
  other: "M5 9l7-5 7 5v10H5zM9 19v-6h6v6",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  tool: "M14.5 5.5a4 4 0 0 0 5 5L11 19a2 2 0 0 1-3-3l8.5-8.5a4 4 0 0 0-2-2zM14.5 5.5l2 2",
  potion: "M9 3h6M10 3v5L5.5 16a3.5 3.5 0 0 0 3 5h7a3.5 3.5 0 0 0 3-5L14 8V3M7 14h10",
  cart: "M3 4h2.5l2.5 11h10l2-8H7M9.5 20a1 1 0 1 0 0-.1M16.5 20a1 1 0 1 0 0-.1",
  sell: "M20 12l-8 8-9-9V3h8zM7.5 7.5a1 1 0 1 0 0-.1",
  wear: "M12 4v12M7 11l5 5 5-5M5 20h14",
  unequip: "M12 20V8M7 13l5-5 5 5M5 4h14",
  drop: "M6 7h12l-1 13H7zM4 7h16M10 7V4h4v3",
  use: "M5 13l4 4L19 7",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
};
export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`icon icon--${name.toLowerCase()} ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ICONS.none} />
    </svg>
  );
}
