/** Top bar: dominant affinity, and the subdominant once it opens. */
import { roman } from "@/core/format";
import { param } from "@/features/rules/params";
import { Hint, Icon, type HintLine } from "@/ui";
import type { SheetProps } from "../types";

function Affinity({ element, role, lines }: { element: string; role: string; lines: HintLine[] }) {
  return (
    <Hint lines={lines}>
      <span className={`aff aff--${element.toLowerCase()}`}><Icon name={element} size={22} /><b>{element}</b><small>{role}</small></span>
    </Hint>
  );
}

export function AffinitiesSection({ rules, sh, c }: SheetProps) {
  const s = sh.sheet;
  const subOpen = c.subdominantOpen, hasSub = !!s.subdominant && s.subdominant !== "None";
  const subArts = (name: string) => rules.elements.find(e => e.name === name)?.subArts || "—";
  return (
    <section className="ct ct--aff" aria-label="Affinities">
      <h2>Affinities</h2>
      <div className="ct__row">
        <Affinity element={s.dominant} role="dominant" lines={[["Dominant", s.dominant], ["Sub-arts", subArts(s.dominant)]]} />
        {subOpen && hasSub
          ? <Affinity element={s.subdominant} role="subdominant" lines={[["Subdominant", s.subdominant], ["Compound arts", c.compound || "—"]]} />
          : (
            <Hint lines={[subOpen ? "Open — choose it on the next Level Up" : `Opens at Ascendancy ${roman(param(rules, "SubdominantAscension", 3))}`]}>
              <span className="aff aff--locked"><Icon name={subOpen ? "none" : "lock"} size={22} /><b>{subOpen ? "None" : "Locked"}</b><small>subdominant</small></span></Hint>
          )}
      </div>
    </section>
  );
}
