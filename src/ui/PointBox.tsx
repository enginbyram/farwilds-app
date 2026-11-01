import { Hint } from "./Hint";
import { Icon } from "./Icon";
import type { HintLine } from "./types";

/** A boxed number with an icon and a caption (keystone points, Hit Die…), explained on hover. */
export function PointBox({ icon, value, caption, lines, iconSize = 22 }: { icon: string; value: React.ReactNode; caption: string; lines: HintLine[]; iconSize?: number }) {
  return (
    <Hint lines={lines}>
      <span className="ptbox"><Icon name={icon} size={iconSize} /><b>{value}</b><small>{caption}</small></span>
    </Hint>
  );
}
