/**
 * Fighter skills. Second Wind and Action Surge are generic cards (a heal and a grant of actions,
 * set up entirely in combat.json), so nothing here needs code yet.
 */
import type { ClassMechanics } from "../types";

export const fighter: ClassMechanics = { name: "Fighter", prefix: "fig.", behaviours: {} };
