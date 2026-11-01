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
