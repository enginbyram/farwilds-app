/** A big selectable button in a grid of choices (race, class, mark…). */
export function Choice({ selected, onClick, children, className = "" }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={`choice${selected ? " choice--on" : ""} ${className}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}
