/** Small shared pieces for the character pages. */
import type { Focus } from "@/rules/compute";

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** A value that explains itself on hover (or keyboard focus): one line per part. */
export function Hint({ lines, children, className = "" }: { lines: (string | [string, string | number])[]; children: React.ReactNode; className?: string }) {
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

/** STR / +2 style tag. Main = gold outline, Side = grey outline, none = greyed. */
export function Badge({ focus, children, title }: { focus: Focus; children: React.ReactNode; title?: string }) {
  return <span className={`badge badge--${focus ? focus.toLowerCase() : "none"}`} title={title}>{children}</span>;
}
