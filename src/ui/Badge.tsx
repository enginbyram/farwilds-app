/** "Main" = gold outline, "Side" = grey outline, "" = greyed. */
export type Focus = "Main" | "Side" | "";

/** STR / +2 style tag. */
export function Badge({ focus, children, title }: { focus: Focus; children: React.ReactNode; title?: string }) {
  return <span className={`badge badge--${focus ? focus.toLowerCase() : "none"}`} title={title}>{children}</span>;
}
