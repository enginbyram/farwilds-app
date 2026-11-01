import { Hint } from "./Hint";
import { RadialGauge } from "./RadialGauge";
import type { HintLine } from "./types";

/** A radial gauge that explains itself on hover (HP, Quick, Sanity…). */
export function HintGauge({ label, now, max, kind, lines, size = 54 }: { label: string; now: number; max: number; kind: string; lines: HintLine[]; size?: number }) {
  return <Hint lines={lines}><RadialGauge now={now} max={Math.max(1, max)} kind={kind} size={size} label={label} /></Hint>;
}
