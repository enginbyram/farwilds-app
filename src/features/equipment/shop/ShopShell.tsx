/** The frame every shop drawer shares: title, something beside it, a close button, then the body. */
import { Icon } from "@/ui";

export function ShopShell({ title, label, beside, onClose, style, children }: {
  title: string; label: string; beside?: React.ReactNode; onClose: () => void; style?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <aside className="shop" style={style} aria-label={label}>
      <div className="shop__head">
        <h2>{title}</h2>
        {beside}
        <button type="button" className="btn btn--ghost btn--small shop__close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {children}
    </aside>
  );
}
