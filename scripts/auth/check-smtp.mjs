import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const base = `https://console.neon.tech/api/v2/projects/${env.NEON_PROJECT_ID}/branches/${env.NEON_BRANCH_ID}/auth`;
const res = await fetch(`${base}/email_provider`, {
  headers: { authorization: `Bearer ${env.NEON_API_KEY}` },
});
const json = await res.json();
const sender = String(json.sender_email ?? "");
const masked = sender.replace(/^(.).*(@.*)$/, "$1***$2");
console.log("status:", res.status);
console.log("type:", json.type);
console.log("host:", json.host ?? "(masked/not returned)");
console.log("port:", json.port ?? "(not returned)");
console.log("sender:", masked, "| domain:", sender.split("@")[1] ?? "");

const config = await (await fetch(base, { headers: { authorization: `Bearer ${env.NEON_API_KEY}` } })).json();
console.log("app name:", config.name);
