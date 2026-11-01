/** Top bar, right: the Hit Die, and the points to spend (keystone, expertise, proficiency). */
import { linesFor } from "@/features/rules/bonuses";
import { PointBox } from "@/ui";
import type { SheetProps } from "../types";

export function HitDieSection({ rules, sh, ch, c }: SheetProps) {
  const s = sh.sheet;
  const core = rules.coreClasses.find(k => k.name === ch.className);
  return (
    <section className="ct ct--hd" aria-label="Hit Die">
      <h2>Hit Die</h2>
      <div className="ct__row">
        <PointBox icon="die" iconSize={24} value={`d${c.hitDie}`} caption="per level"
          lines={[[`Level 1 (${ch.className})`, `d${core?.hitDie ?? "?"}`], [`From Asc. I${s.asc1 ? ` (${s.asc1})` : ""}`, `d${c.hitDie}`], "Each level after the first: d/2 + 1 + CON"]} />
      </div>
    </section>
  );
}

export function PointsSection({ ch, c }: Pick<SheetProps, "ch" | "c">) {
  return (
    <section className="ct ct--points" aria-label="Points">
      <h2>Points</h2>
      <div className="ct__row">
        <PointBox icon="keystone" value={ch.left} caption="keystone" lines={[["Tree points", `${ch.used} spent of ${ch.total}`], "1 keystone point per level"]} />
        <PointBox icon="expertise" value={c.expertisePoints} caption="expertise" lines={[["Expertise points", c.expertisePoints], `From Ascendancy II – Level 1 (level ${c.levels.expertiseStart})`]} />
        {c.proficiencyPoints > 0 && <PointBox icon="tool" value={c.proficiencyPoints} caption="proficiency" lines={["Proficiency points — raise or unlock a proficiency", ...linesFor(c.external, "proficiency")]} />}
      </div>
    </section>
  );
}
