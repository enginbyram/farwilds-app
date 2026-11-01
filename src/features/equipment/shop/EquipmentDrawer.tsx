/**
 * Equipment drawer — opens in the left column (where Dev mode's sidebar sits) from the Equipment card's
 * Add, Purchase and Sell buttons. Add and Purchase share the catalog list (CatalogDrawer); Sell lists the bag.
 * Catalog: src/data/equipment.json (from the equipment workbook, tools/equipment_xlsx_to_json.py).
 */
import type { SheetState } from "@/features/character/state/useSheet";
import { CatalogDrawer } from "./CatalogDrawer";
import { SellDrawer } from "./SellDrawer";

export type ShopMode = "add" | "buy" | "sell";

export function EquipmentDrawer({ mode, ...rest }: {
  mode: ShopMode; sh: SheetState; onClose: () => void; onMessage: (m: string) => void; style?: React.CSSProperties;
}) {
  return mode === "sell" ? <SellDrawer {...rest} /> : <CatalogDrawer mode={mode} {...rest} />;
}
