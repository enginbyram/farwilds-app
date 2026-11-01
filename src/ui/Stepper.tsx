/**
 * − value + : one number nudged by buttons.
 *   variant "text" — small text buttons (Creator, Level up)
 *   variant "icon" — ghost buttons with − / + icons (shop cart, selling)
 */
import { Icon } from "./Icon";

export function Stepper({ value, onDec, onInc, canDec = true, canInc = true, decLabel, incLabel, variant = "text" }: {
  value: React.ReactNode; onDec: () => void; onInc: () => void; canDec?: boolean; canInc?: boolean;
  decLabel?: string; incLabel?: string; variant?: "text" | "icon";
}) {
  if (variant === "icon") {
    return (
      <span className="shop__qty">
        <button type="button" className="btn btn--ghost btn--small" onClick={onDec} disabled={!canDec} aria-label={decLabel}><Icon name="minus" size={14} /></button>
        <b>{value}</b>
        <button type="button" className="btn btn--ghost btn--small" onClick={onInc} disabled={!canInc} aria-label={incLabel}><Icon name="plus" size={14} /></button>
      </span>
    );
  }
  return (
    <span className="stepperbtns">
      <button className="btn btn--small" aria-label={decLabel} disabled={!canDec} onClick={onDec}>−</button>
      <b className="stepperbtns__v">{value}</b>
      <button className="btn btn--small" aria-label={incLabel} disabled={!canInc} onClick={onInc}>+</button>
    </span>
  );
}
