/**
 * Regression test: the app's logic must produce exactly the same results as when the snapshot was taken —
 * seeded fights (full logs), simulations, character maths, bonuses, money, gear, tree layout, unlock and route rules.
 *
 *   npm test             check
 *   npm run test:update  after a DELIBERATE rules change: take a new snapshot (commit the .sha256.json it writes)
 *
 * The committed file holds one fingerprint per part. The full snapshot (baseline.json, several MB) stays on your
 * machine only; when it is there, a failure shows exactly what changed.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { golden } from "./golden";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "__golden__");
const HASHES = join(DIR, "baseline.sha256.json");
const FULL = join(DIR, "baseline.json");
const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

test("logic matches the golden snapshot", () => {
  const now = JSON.parse(JSON.stringify(golden())) as Record<string, unknown>;
  const hashes = Object.fromEntries(Object.entries(now).map(([k, v]) => [k, sha(v)]));
  if (process.env.UPDATE_GOLDEN || !existsSync(HASHES)) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(HASHES, `${JSON.stringify(hashes, null, 2)}\n`);
    writeFileSync(FULL, JSON.stringify(now));
    return;
  }
  const was = JSON.parse(readFileSync(HASHES, "utf8")) as Record<string, string>;
  const full = existsSync(FULL) ? JSON.parse(readFileSync(FULL, "utf8")) as Record<string, unknown> : null;
  for (const part of Object.keys(was)) {
    if (hashes[part] === was[part]) continue;
    if (full) expect(now[part], part).toEqual(full[part]);   // shows the difference
    expect(hashes[part], `${part} changed`).toBe(was[part]);
  }
});
