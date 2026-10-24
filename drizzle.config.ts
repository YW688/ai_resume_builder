import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load Next.js env files by itself; read .env.local here
// without adding a dependency. Existing process.env values win.
function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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

const root = process.cwd();
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

// Migrations must run against the direct (non-pooled) endpoint.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED / DATABASE_URL is not set. Add it to .env.local before running drizzle-kit.",
  );
}
if (/[-.]pooler\./.test(migrationUrl)) {
  throw new Error(
    "Refusing to migrate through the pooled endpoint. Set DATABASE_URL_UNPOOLED in .env.local.",
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
