import { ICONS } from "./icons";

/** A line icon by name (see icons.ts). Unknown names draw a dash. */
export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`icon icon--${name.toLowerCase()} ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ICONS.none} />
    </svg>
  );
}
