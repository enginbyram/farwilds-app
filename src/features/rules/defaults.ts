/**
 * Default rules = src/data/rules.json (hand-editable, like the tree database).
 *
 * Origin: Farwilds_Character_Builder_v2.xlsx as edited by Engin (24 Oct 2026), plus the decisions since:
 *  - no ranks: a race or class 2 makes an attribute Main, a 1 makes it Side; 18 creator points
 *  - +2 skill points per ascension; every character starts with a Deep well
 *  - subdominant affinity opens at Ascendancy III; marks include eye powers; no mark = 2 free attribute points
 *  - Rage on a scale of 10 (31 Oct); Barbarian + Shifter combination removed (31 Oct)
 *  - Core Rulebook review (1 Nov): Hit Dice (Artificer d6, Witch d8), race speeds, Hunter moved to the Ranger,
 *    Quick / Purequick = Hit Die + CON / WIS mod, +2 every 2 levels
 *
 * `version` is a fingerprint of the file: when you edit rules.json, browsers set their saved
 * Dev-mode copy aside and use the new file.
 */
import raw from "@/data/rules.json";
import { fingerprint } from "@/core/objects";
import type { Rules } from "./types";

const { _about: _ignored, ...tables } = raw as unknown as Omit<Rules, "version"> & { _about?: string };
export const DEFAULT_RULES: Rules = { version: fingerprint(JSON.stringify(tables)), ...tables };
