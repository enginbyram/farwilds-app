/** Skills in two compact columns: attribute modifier + points spent + bonuses. */
import { signed } from "@/core/format";
import { param } from "@/features/rules/params";
import { Badge, Hint } from "@/ui";
import { bonusLinesOrNone } from "./bonusLines";
import type { SheetProps } from "./types";

export function SkillsCard({ rules, c }: Pick<SheetProps, "rules" | "c">) {
  const focusOf = (key: string) => c.attributes.find(a => a.key === key)?.focus ?? "";
  return (
    <section className="card">
      <h2>Skills</h2>
      <ul className="skilllist skilllist--compact">
        {c.skills.map(k => (
          <li key={k.name}>
            <span>{k.name}</span>
            <Badge focus={focusOf(k.attribute)}>{k.attribute}</Badge>
            <Hint className="skilllist__v" lines={[[`${k.attribute} modifier`, signed(k.mod)], ["Points spent", k.points], ...bonusLinesOrNone(c.external, `skill:${k.name}`)]}>
              <b>{signed(k.total)}</b>
            </Hint>
          </li>
        ))}
      </ul>
      <p className="note">Skill points {c.skillPointsUsed} / {c.skillPointsAvailable} · +{param(rules, "SkillPointsPerAscension", 0)} per ascension</p>
    </section>
  );
}
