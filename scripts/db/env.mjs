// Shared env loader for DB scripts (no dotenv dependency).
// Loads .env.local then .env from the repo root, without overriding existing
// process.env values. Never prints connection strings.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function loadEnv() {
  parseEnvFile(path.join(ROOT, ".env.local"));
  parseEnvFile(path.join(ROOT, ".env"));
  return ROOT;
}

/** Migration / admin tasks must use the direct (non-pooled) endpoint. */
export function directDatabaseUrl() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED / DATABASE_URL is not set (check .env.local)",
    );
  }
  if (/[-.]pooler\./.test(url)) {
    throw new Error(
      "Refusing to run: the configured URL looks pooled. Migrations/seeding need DATABASE_URL_UNPOOLED (direct).",
    );
  }
  return url;
}

/** Application traffic uses the pooled endpoint. */
export function pooledDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  return url;
}

export { ROOT };
