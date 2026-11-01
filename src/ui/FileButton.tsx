/** A button that opens a file picker and hands the chosen file over. The same file can be picked twice in a row. */
export function FileButton({ accept, onFile, children, className = "btn", title }: {
  accept: string; onFile: (f: File) => void; children: React.ReactNode; className?: string; title?: string;
}) {
  return (
    <label className={className} title={title}>
      {children}
      <input type="file" accept={accept} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </label>
  );
}
