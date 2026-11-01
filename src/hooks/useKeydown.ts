/** Runs `handler` when `key` is pressed anywhere on the page (e.g. Escape closes a drawer). */
import { useEffect, useRef } from "react";

export function useKeydown(key: string, handler: () => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === key) latest.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}
