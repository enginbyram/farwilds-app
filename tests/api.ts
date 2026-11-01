/**
 * The one place the regression tests import app code from.
 * When files move, only these import paths change; the tests and the golden file stay the same.
 */
export * from "@/features/combat/engine";
export { computeCharacter, attackPower } from "@/features/rules/compute";
export { collectBonuses, parseBonusText } from "@/features/rules/bonuses";
export { longRest, shortRest } from "@/features/rules/rest";
export { DEFAULT_RULES } from "@/features/rules/defaults";
export { DATABASE } from "@/features/tree/load/loadTree";
export { buildModel } from "@/features/tree/model/buildModel";
export { canRefund, canUnlock, nextSteps } from "@/features/tree/model/unlock";
export { allocate } from "@/features/tree/model/routing";
export {
  CATALOG, addToBag, equippedWeapons, formatMoney, pay, receive, sellPrice, slotsFor, unequip, wear, carriedWeight,
} from "@/features/equipment/model";
export { normaliseSheet, DEFAULT_SHEET } from "@/features/character/state/sheet";
export { ascendanciesFromTree } from "@/features/character/levelup/ascendancies";
export type { Item } from "@/features/rules/types";
export type { CatalogItem as CatalogItemLike } from "@/features/equipment/model";
