/**
 * The pages of the app. Tabs appear in the header in this order; pages without a tab (Creator, Level up)
 * are opened from buttons. Add a page: add it here, then render it in App.tsx.
 */
export type Page = "tree" | "character" | "creator" | "levelup" | "combat";

export const TABS: { id: Page; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "character", label: "Character" },
  { id: "combat", label: "Combat" },
];

/** Pages that use the full width (no Dev rules sidebar beside them). */
export const FULL_WIDTH: Page[] = ["combat"];
