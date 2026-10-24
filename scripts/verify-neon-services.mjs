#!/usr/bin/env node
/**
 * Neon Realtime + Neon Functions 端到端验证脚本。
 *
 * 用法：
 *   node scripts/verify-neon-services.mjs                 # 全部（函数走部署 URL）
 *   node scripts/verify-neon-services.mjs --skip-realtime # 只测函数
 *   node scripts/verify-neon-services.mjs --function-url http://localhost:8788  # 走 neon dev 本地函数
 *   node scripts/verify-neon-services.mjs --user-id seed-user-e2e
 *
 * 覆盖：
 *   A. Realtime：seal 一条 notifications 查询 → 浏览器客户端订阅（真实 WebSocket）
 *      → SQL 插入一条 notification → 断言收到 changes 批次 → 删除测试行。
 *   B. Functions：GET /health 200；无 token 401；Neon Auth 登录换 JWT → 带 token 200；
 *      同一输入两次结果一致（确定性）；OPTIONS 204。
 *
 * 只读取 .env.local 做本机验证，不打印任何 secret。
 */

import { readFileSync } from "node:fs";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { createRealtimeClient } from "@neon/realtime/client";
import { drizzleParsers } from "@neon/realtime-drizzle/client";
import { neon } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// 参数与 env
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} 需要一个值`);
  return value;
}
function flag(name) {
  return args.includes(`--${name}`);
}

const env = parseEnvFile(".env.local");
const userId = arg("user-id", "seed-user-e2e");
const functionUrl = arg("function-url", env.NEON_FUNCTION_KEYWORDS_BASE_URL ?? "");
const authBaseUrl = arg("auth-base-url", env.NEON_AUTH_BASE_URL ?? "");
const skipRealtime = flag("skip-realtime");
const skipFunctions = flag("skip-functions");
const testEmail = arg("test-email", "e2e.auth.1792769794@example.com");
const testPassword = arg("test-password", "ResumeE2E!1792769794");

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  -> ${detail}` : ""}`);
}

function parseEnvFile(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value.endsWith("\\n")) value = value.slice(0, -2);
    // 展开 $VAR / ${VAR} 形式的引用（neon env pull 只写直接值，这里做最小支持）
    value = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, a, b) => out[a ?? b] ?? "");
    out[match[1]] = value;
  }
  return out;
}

function databaseName() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 未在 .env.local 中");
  return new URL(url).pathname.replace(/^\/+/, "") || "neondb";
}

function timeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// A. Realtime
// ---------------------------------------------------------------------------
async function verifyRealtime() {
  console.log("\n=== A. Neon Realtime ===");
  const dbName = databaseName();
  const sql = neon(env.DATABASE_URL);
  const realtime = createRealtime({
    secret: env.NEON_REALTIME_SECRET,
    db: dbName,
  });

  // 与 lib/realtime/server.ts 的 notificationsQuery 完全一致（参数化、无 now()）。
  const notificationsQuery = (id) =>
    rawSql(
      `SELECT notifications.id, notifications.user_id, notifications.title, notifications.body,
              notifications.at, notifications.read, notifications.kind
       FROM notifications
       WHERE notifications.user_id = $1
       ORDER BY notifications.at DESC
       LIMIT 10`,
      [id],
    );

  const sealed = await realtime.seal({ query: notificationsQuery(userId) });
  console.log(
    `sealed query: fingerprint=${sealed.queryFingerprint} expiresAt=${new Date(sealed.expiresAt).toISOString()}`,
  );

  // 真实浏览器订阅路径：客户端拿 sealed capability 直接订阅（无用户凭证随行）。
  const client = createRealtimeClient({
    url: env.NEON_REALTIME_URL,
    parsers: { ...drizzleParsers },
  });
  const subscription = client.subscribe(sealed);

  await subscription.awaitRows((rows) => Array.isArray(rows), 20_000);
  const initialState = subscription.getSnapshot();

  console.log(
    `subscription state: status=${initialState.status} initialRows=${initialState.data?.length ?? 0}`,
  );
  record(
    "Realtime: sealed query 订阅成功并收到初始结果",
    initialState.status === "live" && Array.isArray(initialState.data),
    `status=${initialState.status}, rows=${initialState.data?.length ?? 0}`,
  );

  const changePromise = new Promise((resolve) => {
    const off = subscription.onUpdate((update) => {
      if (update.type === "changes") {
        off();
        resolve(update);
      }
    });
  });

  // 通过 SQL 插入一条 notification（模拟另一路写入 / 另一个设备）。
  const inserted = await sql`
    INSERT INTO notifications (user_id, title, body, at, read, kind)
    VALUES (${userId}, ${"Realtime E2E 测试通知"}, ${"由 scripts/verify-neon-services.mjs 插入"}, now(), false, ${"application"})
    RETURNING id
  `;
  const insertedId = inserted[0]?.id;
  console.log(`inserted notification id=${insertedId}`);

  let changeEvent;
  try {
    changeEvent = await timeout(changePromise, 30_000, "等待 changes 批次");
  } finally {
    if (insertedId) {
      await sql`DELETE FROM notifications WHERE id = ${insertedId}`;
      console.log(`cleanup: deleted notification id=${insertedId}`);
    }
  }

  console.log("收到变更批次（原始输出）：");
  console.log(JSON.stringify(changeEvent, null, 2));

  const changeCount = changeEvent.changes?.length ?? 0;
  const hasInsert = (changeEvent.changes ?? []).some(
    (change) => change.row?.id === insertedId || change.row_id === insertedId,
  );
  record(
    "Realtime: 插入 notification 后收到 changes 批次",
    changeCount > 0,
    `txids=${(changeEvent.batch?.txids ?? []).join(",") || "(无)"}, changes=${changeCount}, 命中插入行=${hasInsert}`,
  );

  subscription.unsubscribe?.();
  client.close();
  return { changeEvent, initialState };
}

// ---------------------------------------------------------------------------
// B. Functions
// ---------------------------------------------------------------------------
async function getSessionJwt() {
  const signIn = await fetch(`${authBaseUrl}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: new URL(authBaseUrl).origin },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  if (!signIn.ok) {
    throw new Error(`Neon Auth sign-in 失败：HTTP ${signIn.status} ${await signIn.text()}`);
  }
  const setCookie = signIn.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((item) => item.split(";")[0]).join("; ");
  const tokenRes = await fetch(`${authBaseUrl}/token`, { headers: { cookie } });
  if (!tokenRes.ok) throw new Error(`获取 JWT 失败：HTTP ${tokenRes.status}`);
  const payload = await tokenRes.json();
  if (!payload?.token) throw new Error("JWT 响应缺少 token");
  return payload.token;
}

async function verifyFunctions() {
  console.log("\n=== B. Neon Functions (extract-keywords) ===");
  if (!functionUrl) {
    record("Functions: 配置函数 URL", false, "NEON_FUNCTION_KEYWORDS_BASE_URL 为空");
    return;
  }
  const base = functionUrl.replace(/\/+$/, "");
  console.log(`function base url: ${base}`);

  // 1) 健康检查（公开）
  const health = await fetch(`${base}/health`);
  const healthBody = await health.text();
  record("Functions: GET /health → 200", health.status === 200, `HTTP ${health.status} ${healthBody.slice(0, 120)}`);

  // 2) OPTIONS 预检
  const preflight = await fetch(`${base}/`, { method: "OPTIONS" });
  record(
    "Functions: OPTIONS 预检 → 204 + CORS",
    preflight.status === 204,
    `HTTP ${preflight.status}, allow-origin=${preflight.headers.get("access-control-allow-origin")}`,
  );

  // 3) 未认证 → 401
  const anon = await fetch(`${base}/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "React TypeScript" }),
  });
  const anonBody = await anon.text();
  record("Functions: 无 token POST → 401", anon.status === 401, `HTTP ${anon.status} ${anonBody.slice(0, 160)}`);

  // 4) 用 Neon Auth 真实 JWT → 200
  let jwt;
  try {
    jwt = await getSessionJwt();
    console.log(`Neon Auth JWT: ${jwt.slice(0, 16)}... (len=${jwt.length})`);
  } catch (error) {
    record("Functions: 获取 Neon Auth JWT", false, error instanceof Error ? error.message : String(error));
    return;
  }

  const jd = `岗位职责：
1. 负责核心业务前端开发，精通 React、TypeScript、Next.js；
2. 熟悉 Node.js、PostgreSQL，具备 RESTful API 设计经验；
3. 熟悉 Docker、Kubernetes 与 CI/CD，有 AWS 云服务经验优先；
4. 了解 Redis 缓存、Kafka 消息队列者优先。`;

  const authed = await fetch(`${base}/?limit=12`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ text: jd }),
  });
  const authedBody = await authed.text();
  let authedJson;
  try {
    authedJson = JSON.parse(authedBody);
  } catch {
    authedJson = undefined;
  }
  record(
    "Functions: 带合法 JWT POST → 200",
    authed.status === 200 && authedJson?.ok === true,
    `HTTP ${authed.status}, keywords=${JSON.stringify(authedJson?.keywords ?? authedBody.slice(0, 160))}`,
  );

  // 5) 确定性：同一输入两次结果一致
  const second = await fetch(`${base}/?limit=12`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ text: jd }),
  });
  const secondJson = await second.json();
  record(
    "Functions: 确定性（两次同输入结果一致）",
    JSON.stringify(authedJson?.keywords) === JSON.stringify(secondJson?.keywords),
    `keywords=${JSON.stringify(secondJson?.keywords ?? [])}`,
  );

  // 6) 非法 JWT → 401
  const forged = await fetch(`${base}/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer aaa.bbb.ccc" },
    body: JSON.stringify({ text: jd }),
  });
  record("Functions: 伪造 JWT POST → 401", forged.status === 401, `HTTP ${forged.status}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
try {
  if (!skipRealtime) await verifyRealtime();
  if (!skipFunctions) await verifyFunctions();
} catch (error) {
  console.error("\n验证脚本异常：", error);
  results.push({ name: "脚本执行", pass: false, detail: error instanceof Error ? error.message : String(error) });
}

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exitCode = 1;
