import type { HintLine } from "./types";

/** A value that explains itself on hover (or keyboard focus): one line per part. */
export function Hint({ lines, children, className = "" }: { lines: HintLine[]; children: React.ReactNode; className?: string }) {
  return (
    <span className={`hint ${className}`} tabIndex={0}>
      {children}
      <span className="hint__box" role="tooltip">
        {lines.map((l, i) => typeof l === "string"
          ? <span key={i} className="hint__line hint__line--text">{l}</span>
          : <span key={i} className="hint__line"><span>{l[0]}</span><b>{l[1]}</b></span>)}
      </span>
    </span>
  );
}
