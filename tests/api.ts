/**
 * The one place the regression tests import app code from.
 * When files move, only these import paths change; the tests and the golden file stay the same.
 */
export * from "@/combat/engine";
export { computeCharacter, attackPower } from "@/rules/compute";
export { collectBonuses, parseBonusText } from "@/rules/bonuses";
export { longRest, shortRest } from "@/rules/rest";
export { DEFAULT_RULES } from "@/rules/defaults";
export { DATABASE } from "@/data/loadTree";
export { buildModel } from "@/model/buildModel";
export { canRefund, canUnlock, nextSteps } from "@/model/character";
export { allocate } from "@/model/routing";
export {
  CATALOG, addToBag, equippedWeapons, formatMoney, pay, receive, sellPrice, slotsFor, unequip, wear, carriedWeight,
} from "@/model/equipment";
export { normaliseSheet, DEFAULT_SHEET } from "@/hooks/useSheet";
export { ascendanciesFromTree } from "@/components/LevelUp";
export type { Item } from "@/rules/types";
export type { CatalogItem as CatalogItemLike } from "@/model/equipment";
