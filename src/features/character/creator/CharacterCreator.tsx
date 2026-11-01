/**
 * Character creator — a new level-1 character, step by step (steps.tsx):
 *   1 Origin (name, race, mark or power, dominant affinity) → 2 Class → 3 Attributes → 4 Review.
 * The subdominant affinity opens later (Level Up).
 * Nothing touches the current character until "Create character" is pressed.
 */
import { useMemo, useState } from "react";
import { s as plural } from "@/core/format";
import { DEFAULT_SHEET } from "@/features/character/state/sheet";
import { attributeFocus, computeCharacter } from "@/features/rules/compute";
import { type CharacterSheet, type Rules, zeroPoints } from "@/features/rules/types";
import { AttributesStep, ClassStep, OriginStep, ReviewStep } from "./steps";

export interface NewCharacter { name: string; coreClass: string; sheet: CharacterSheet; }

const STEPS = ["Origin", "Class", "Attributes", "Review"] as const;

export function CharacterCreator({ rules, onCreate, onCancel }: { rules: Rules; onCreate: (c: NewCharacter) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [coreClass, setCoreClass] = useState("");
  const [sheet, setSheet] = useState<CharacterSheet>(() => ({
    ...DEFAULT_SHEET, race: "", mark: "None", subdominant: "None", level: 1, points: zeroPoints(), skillPoints: {},
  }));
  const set = <K extends keyof CharacterSheet>(k: K, v: CharacterSheet[K]) => setSheet(s => ({ ...s, [k]: v }));

  const c = useMemo(() => computeCharacter(rules, sheet, coreClass), [rules, sheet, coreClass]);
  const left = c.creationPoints - c.pointsUsed;
  const props = { rules, c, sheet, setSheet, set };

  /** Is each step complete? A step can be opened once every step before it is. */
  const stepOk = [name.trim() !== "" && !!sheet.race && !!sheet.dominant, !!coreClass, left === 0, true];
  const canGo = (i: number) => stepOk.slice(0, i).every(Boolean);
  const reason = step === 0 ? (!name.trim() ? "Give the character a name." : !sheet.race ? "Choose a race." : "")
    : step === 2 && left > 0 ? `Spend ${left} more point${plural(left)}.` : "";

  return (
    <div className="creator">
      <section className="card creator__head">
        <h2>New character · level 1</h2>
        <ol className="stepper">
          {STEPS.map((t, i) => (
            <li key={t}>
              <button className={`stepper__step${i === step ? " is-on" : ""}${stepOk[i] && i < step ? " is-done" : ""}`}
                disabled={!canGo(i)} onClick={() => setStep(i)}>
                <span className="stepper__n">{i + 1}</span>{t}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {step === 0 && <OriginStep {...props} name={name} setName={setName} />}
      {step === 1 && <ClassStep rules={rules} c={c} coreClass={coreClass} setCoreClass={setCoreClass} />}
      {step === 2 && <AttributesStep {...props} focus={attributeFocus(rules, sheet.race, coreClass)} />}
      {step === 3 && <ReviewStep c={c} sheet={sheet} name={name} coreClass={coreClass} />}

      <div className="creator__nav">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <span className="reason">{reason}</span>
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1
          ? <button className="btn primary" disabled={!stepOk[step]} onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>
          : <button className="btn btn--success" onClick={() => onCreate({ name: name.trim(), coreClass, sheet })}>Create character</button>}
      </div>
    </div>
  );
}
