/** One label → value row inside a <dl> (class "facts", "idlist"…). */
export function Fact({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <><dt>{label}</dt><dd>{children}</dd></>;
}
