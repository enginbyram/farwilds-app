import { Hint } from "./Hint";
import { Icon } from "./Icon";
import type { HintLine } from "./types";

/** Icon + value + short label, explained on hover (Armour, Initiative, Speed…). */
export function StatIcon({ icon, label, value, lines }: { icon: string; label: string; value: string | number; lines: HintLine[] }) {
  return (
    <Hint lines={lines}>
      <span className="stat-ic"><Icon name={icon} /><b>{value}</b><small>{label}</small></span>
    </Hint>
  );
}
