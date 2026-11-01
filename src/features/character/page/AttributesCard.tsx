/** Attributes, grouped by aptitude. Every score explains where it comes from on hover. */
import { signed } from "@/core/format";
import { linesFor } from "@/features/rules/bonuses";
import { Badge, Hint } from "@/ui";
import { bonusLinesOrNone } from "./bonusLines";
import type { SheetProps } from "./types";

export function AttributesCard({ rules, sh, ch, c }: SheetProps) {
  const s = sh.sheet;
  const aptitudes = rules.aptitudes.map(a => ({ ...a, mod: c.aptitudeMods.find(m => m.name === a.name)?.mod ?? 0, rows: c.attributes.filter(x => x.aptitude === a.name) }));
  return (
    <section className="card">
      <h2>Attributes</h2>
      <table className="attrs">
        <tbody>
          {aptitudes.map(ap => ap.rows.map((a, i) => (
            <tr key={a.key} className={i === 0 ? "attrs__first" : ""}>
              {i === 0 && (
                <th rowSpan={ap.rows.length} className="attrs__apt">
                  <Hint lines={[`${ap.name} modifier: average of its attribute modifiers, rounded down`]}>
                    <span>{ap.name}</span><b>{signed(ap.mod)}</b>
                  </Hint>
                </th>
              )}
              <td className="attrs__name">{a.name}</td>
              <td><Badge focus={a.focus} title={a.focus ? `${a.focus} attribute` : undefined}>{a.key}</Badge></td>
              <td className="attrs__score">
                <Hint lines={[
                  ["Base", a.base],
                  [`Race (${s.race})`, signed(a.race)],
                  ...(a.mark ? [[`Mark (${s.mark})`, signed(a.mark)] as [string, string]] : []),
                  [`Class (${ch.className})`, signed(a.cls)],
                  ["Points spent", signed(a.points)],
                  ...bonusLinesOrNone(c.external, `attr:${a.key}`),
                  ...(a.focus ? [`${a.focus}: race or class gives ${a.focus === "Main" ? 2 : 1}`] : []),
                ]}><b>{a.score}</b></Hint>
              </td>
              <td><Hint lines={["(score − 10) ÷ 2, rounded down"]}><Badge focus={a.focus}>{signed(a.mod)}</Badge></Hint></td>
            </tr>
          )))}
        </tbody>
      </table>
      <Hint lines={["Creation points + points per level", ...linesFor(c.external, "attr_points")]}><p className="note">Attribute points {c.pointsUsed} / {c.attributePointsAvailable}</p></Hint>
    </section>
  );
}
