/**
 * The combat engine — pure functions, no UI. Import from "@/features/combat/engine".
 *
 *   newFight → rollInitiative → step … (your turn) playCard … endTurn → step … → over
 *
 * Files: types (shapes) · state (start, end, helpers) · turns (order, foe turns, your turn opening) ·
 * cards (playing a card, the strike) · rage (the Rage pool) · log · screen (tray lights, chips) ·
 * autopilot and simulate (Dev mode). What each skill DOES lives in ../mechanics/.
 */
export * from "../data";
export { parseDice, seeded, type Dice, type Rng } from "@/core/dice";
export * from "./types";
export { T } from "./log";
export { newFight, aliveFoes } from "./state";
export { rollInitiative, step, endTurn } from "./turns";
export { cardSlot, canPlay, playCard, type Slot } from "./cards";
export { passiveState, statusChips } from "./screen";
export { autoTurn, DEFAULT_POLICY, type Policy } from "./autopilot";
export { simulate, type SimResult } from "./simulate";
