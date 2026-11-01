/** A level up in progress: the levels, and the nodes owned when it started (Cancel goes back to them). */
export interface PendingLevelUp { from: number; to: number; snapshot: string[]; }
