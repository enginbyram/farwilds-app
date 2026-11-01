/** Class colours: CLASS_THEME (config/settings.ts) → the --class-l / --class-d CSS variables a page is drawn with. */
import { CLASS_THEME } from "@/config/settings";

export function classStyle(coreClass: string): React.CSSProperties {
  const t = CLASS_THEME[coreClass];
  return (t ? { "--class-l": t[0], "--class-d": t[1] } : {}) as React.CSSProperties;
}
