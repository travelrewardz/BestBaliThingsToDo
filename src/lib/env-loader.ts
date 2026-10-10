import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for non-Next.js contexts (seeds, scripts, tests).
 * Next.js loads .env automatically at runtime; the Prisma CLI does too.
 * This only fills values that are not already present in process.env.
 *
 * NOTE: keep this file out of the Next.js import graph — Turbopack traces
 * dynamic filesystem access. Scripts and tests import it directly.
 */
export function loadEnv(file = path.join(process.cwd(), ".env")): void {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
