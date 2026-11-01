/** Map layer 1 — aptitude sectors, rings, wedge lines, curved aptitude names. Changes only with the data. */
import { memo } from "react";
import { APTITUDE_LABEL_GAP, APTITUDE_LABEL_SIZE } from "@/config/settings";
import type { TreeModel } from "@/features/tree/types";
import { aptitudeColor } from "../colors";
import { labelArc, polar, sectorPath } from "./geometry";

export const Background = memo(function Background({ model, showGrid }: { model: TreeModel; showGrid: boolean }) {
  const rim = model.maxRadius + 40;
  const hub = Math.min(40, (model.ringRadius.get(1) ?? 100) / 2);
  const aptStarts = new Set([...model.aptitudes.values()].map(a => a.angleStart));
  const aptitudes = [...model.aptitudes.values()].filter(a => a.name !== "Centre");
  return (
    <g>
      {aptitudes.map(a => (
        <path key={a.name} d={sectorPath(a.angleStart, a.angleWidth, hub, rim)} fill={aptitudeColor(a.name)}
          style={{ fillOpacity: "var(--sector-opacity)" }} pointerEvents="none" />
      ))}
      {showGrid && (
        <g stroke="var(--line)" fill="none">
          {[...new Set(model.ringRadius.values())].filter(r => r > 0).map(r =>
            <circle key={`r${r}`} r={r} strokeDasharray="4 6" strokeWidth={1} />)}
          <circle r={rim} strokeWidth={1.2} />
          {[...model.classes.values()].filter(c => c.name !== "Centre").map(c => {
            const [x1, y1] = polar(c.wedgeStart, hub), [x2, y2] = polar(c.wedgeStart, rim);
            const major = aptStarts.has(c.wedgeStart);
            return <line key={c.name} x1={x1} y1={y1} x2={x2} y2={y2}
              strokeWidth={major ? 1.6 : 0.8} strokeDasharray={major ? undefined : "2 5"} />;
          })}
        </g>
      )}
      {/* Aptitude names follow the rim, centred on their sector */}
      <defs>
        {aptitudes.map(a => (
          <path key={a.name} id={`apt-arc-${a.name}`} d={labelArc(a.angleStart, a.angleWidth, rim + APTITUDE_LABEL_GAP)} />
        ))}
      </defs>
      {aptitudes.map(a => (
        <text key={a.name} className="aptitude-label" fontSize={APTITUDE_LABEL_SIZE} fill={aptitudeColor(a.name)}>
          <textPath href={`#apt-arc-${a.name}`} startOffset="50%" textAnchor="middle">{a.name.toUpperCase()}</textPath>
        </text>
      ))}
    </g>
  );
});
