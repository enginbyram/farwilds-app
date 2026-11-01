/**
 * Regression test: the app's logic must produce exactly the snapshot in __golden__/baseline.json.
 * After a deliberate rules change, refresh it with:  npm run test:update
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { golden } from "./golden";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "__golden__", "baseline.json");

test("logic matches the golden snapshot", () => {
  const now = JSON.parse(JSON.stringify(golden()));
  if (process.env.UPDATE_GOLDEN || !existsSync(FILE)) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(now));
    return;
  }
  const was = JSON.parse(readFileSync(FILE, "utf8"));
  for (const part of Object.keys(was)) expect(now[part], part).toEqual(was[part]);
});
