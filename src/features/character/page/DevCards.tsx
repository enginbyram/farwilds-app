/** Dev mode only, under the Character page: edit the identity by hand, and see every rule check. */
import { param } from "@/features/rules/params";
import { Fact, Select } from "@/ui";
import type { SheetProps } from "./types";

export function DevIdentityCard({ rules, sh, ch }: Omit<SheetProps, "c">) {
  const { sheet: s, update } = sh;
  const maxLevel = param(rules, "MaxLevel", 45);
  const changeClass = (cls: string) => {
    if (cls === ch.className) return;
    if (ch.used > 0 && !window.confirm(`Changing the core class clears the ${ch.used} points spent on the tree. Continue?`)) return;
    ch.setClassName(cls);
    if (!rules.ascendancies.some(a => a.name === s.asc1 && a.coreClass === cls)) update("asc1", "");
  };
  return (
    <section className="card">
      <h2>Dev · identity</h2>
      <dl className="idlist">
        <Fact label="Level"><input type="number" className="in in--num" style={{ width: 70 }} min={1} max={maxLevel} value={s.level}
          onChange={e => update("level", Math.max(1, Number(e.target.value) || 1))} aria-label="Level" /></Fact>
        <Fact label="Race"><Select label="Race" value={s.race} options={rules.races.map(r => r.name)} onChange={v => update("race", v)} /></Fact>
        <Fact label="Mark / power"><Select label="Mark" value={s.mark} options={rules.marks.map(m => m.name)} onChange={v => update("mark", v)} /></Fact>
        <Fact label="Core class"><Select label="Core class" value={ch.className} options={rules.coreClasses.map(x => x.name)} onChange={changeClass} /></Fact>
        <Fact label="First ascendancy"><Select label="First ascendancy" value={s.asc1} blank="— none —"
          options={rules.ascendancies.filter(a => a.coreClass === ch.className).map(a => a.name)} onChange={v => update("asc1", v)} /></Fact>
        <Fact label="Second ascendancy"><Select label="Second ascendancy" value={s.asc2} blank="— none —"
          options={rules.ascendancies.filter(a => a.name !== s.asc1).map(a => a.name)} onChange={v => update("asc2", v)} /></Fact>
        <Fact label="Dominant"><Select label="Dominant affinity" value={s.dominant} options={rules.elements.map(e => e.name)} onChange={v => update("dominant", v)} /></Fact>
        <Fact label="Subdominant"><Select label="Subdominant" value={s.subdominant} options={["None", ...rules.elements.map(e => e.name)]} onChange={v => update("subdominant", v)} /></Fact>
      </dl>
    </section>
  );
}

export function ChecksCard({ c }: Pick<SheetProps, "c">) {
  const failing = c.checks.filter(x => !x.ok);
  return (
    <section className="card">
      <h2>Checks <span className={`pill${failing.length ? " pill--bad" : ""}`}>{failing.length ? `${failing.length} to fix` : "all pass"}</span></h2>
      <ul className="checks">
        {(failing.length ? failing : c.checks).map(k => (
          <li key={k.label} className={k.ok ? "ok" : "bad"}><span>{k.label}</span><b>{k.message}</b></li>
        ))}
      </ul>
    </section>
  );
}
