/**
 * Gear setup from src/data/gear.json: the slots a character wears things in, the coins, the bag size,
 * the kinds of valuables and what a merchant pays (sellRate). Edit the JSON; nothing here needs to change.
 */
import gear from "@/data/gear.json";

export interface GearSlot { id: string; label: string; side: "left" | "right" | "melee" | "ranged"; icon: string }
export interface Coin { id: string; label: string; short: string; value: number }

export const GEAR_SLOTS = gear.slots as GearSlot[];
export const COINS = gear.coins as Coin[];
export const BAG_COLUMNS = gear.bagColumns;
export const BAG_MIN_CELLS = gear.bagMinCells;
export const VALUABLE_KINDS = gear.valuableKinds as string[];
/** Share of the catalog price a merchant pays (0.5 = half). */
export const SELL_RATE = gear.sellRate ?? 0.5;

/** "head" → "Head" (the slot id itself when unknown). */
export const slotLabel = (id: string) => GEAR_SLOTS.find(x => x.id === id)?.label ?? id;
/** Slots on one side of the paper doll. */
export const slotsOnSide = (side: GearSlot["side"]) => GEAR_SLOTS.filter(x => x.side === side);
