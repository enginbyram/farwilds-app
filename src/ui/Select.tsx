/** A dropdown of names. A value that isn't in the list is kept and marked "(not in rules)"; `blank` adds an empty first option. */
export function Select({ value, options, onChange, label, blank }: {
  value: string; options: string[]; onChange: (v: string) => void; label: string; blank?: string;
}) {
  const known = options.includes(value) || value === "";
  return (
    <select className="in" aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {!known && <option value={value}>{value} (not in rules)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
