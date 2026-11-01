/**
 * Item menu — a small floating menu, like a right-click menu, opened by clicking an item in the bag or
 * a gear slot. Closes on a choice, a click elsewhere, Escape, scrolling or resizing.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./ui";

export interface MenuEntry {
  label: string;
  icon?: string;
  note?: string;          // small text on the right: a price, a slot
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}
export interface MenuState { x: number; y: number; title: string; entries: MenuEntry[] }

/** Where to open: the pointer, or (keyboard) just under the clicked element. */
export function menuAt(e: React.MouseEvent<HTMLElement>, title: string, entries: MenuEntry[]): MenuState {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY, title, entries };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 4, title, entries };
}

export function ItemMenu({ menu, onClose }: { menu: MenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)) });
    ref.current.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const close = () => onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return (
    <div ref={ref} className="imenu" role="menu" aria-label={menu.title} style={{ left: pos.x, top: pos.y }}>
      <div className="imenu__title">{menu.title}</div>
      {menu.entries.map((m, i) => (
        <button key={i} type="button" role="menuitem" className={`imenu__item${m.danger ? " imenu__item--danger" : ""}`} disabled={m.disabled}
          onClick={() => { onClose(); m.onClick?.(); }}>
          <Icon name={m.icon ?? "none"} size={15} />
          <span>{m.label}</span>
          {m.note && <small>{m.note}</small>}
        </button>
      ))}
    </div>
  );
}
