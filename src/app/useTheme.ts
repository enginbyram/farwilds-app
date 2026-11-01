/** Light / dark / follow the system. Saved in the browser and applied to <html data-theme>. */
import { useEffect } from "react";
import { textCodec, usePersistentState } from "@/hooks/usePersistentState";

export type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

export function useTheme() {
  const [theme, setTheme] = usePersistentState<Theme>("theme", "system", textCodec<Theme>());
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
  }, [theme]);
  return { theme, cycle: () => setTheme(t => NEXT[t]) };
}
