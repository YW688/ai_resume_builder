/**
 * 邮箱验证码登录端到端验证（真实收信，不依赖浏览器）。
 *
 * 覆盖：登录页 SSR（验证码 / 密码双入口）→ 发送验证码（Next 同源代理 →
 * Neon Auth → SMTP）→ 从一次性测试邮箱读取验证码 → 错误验证码被拒绝 →
 * 正确验证码登录（新邮箱自动注册）→ 会话恢复 → 受保护页访问（补建应用
 * users 行）→ emailVerified 标记 → 登出 → 未登录跳转。
 *
 * 隐私说明：
 * - 收件箱是 API 临时创建的一次性地址（mail.tm），不使用任何个人邮箱；
 * - 不打印验证码、cookie、邮箱全文或任何密钥；
 * - 结束时删除测试账号、验证码记录与临时收件箱。
 *
 * 运行：node scripts/auth/e2e-otp.mjs
 * 前置：dev server 已启动（默认 http://127.0.0.1:3000），.env.local 已配置 Neon。
 * 可选：OTP_E2E_BASE / OTP_E2E_OTP（手工提供验证码时跳过收信）。
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sql = neon(env.DATABASE_URL);

const BASE = process.env.OTP_E2E_BASE ?? "http://127.0.0.1:3000";
const MANUAL_OTP = process.env.OTP_E2E_OTP ?? null;
const ARTIFACTS = path.resolve(ROOT, process.env.OTP_E2E_ARTIFACTS ?? ".tools/auth-otp-e2e");
fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];
let failed = 0;

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
    console.log(`PASS  ${name}${detail ? ` :: ${JSON.stringify(detail)}` : ""}`);
  } catch (error) {
    failed += 1;
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`FAIL  ${name} :: ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function maskEmail(value) {
  return value.replace(/^(.).*(@.*)$/, "$1***$2");
}

/** 极简 cookie jar（仅本脚本使用，不落盘）。 */
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const line of setCookies) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  clear() {
    this.cookies.clear();
  }
}

async function api(pathname, { method = "GET", body, jar, redirect = "manual" } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    redirect,
    headers: {
      origin: BASE,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(jar?.header() ? { cookie: jar.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.absorb(response);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // 非 JSON（HTML）保持 null
  }
  return { status: response.status, text, json };
}

/** 创建一次性测试收件箱（mail.tm 公共 API）。 */
async function createInbox() {
  const domains = await (await fetch("https://api.mail.tm/domains")).json();
  const domain = domains["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("mail.tm domain unavailable");
  const address = `otpe2e${Date.now()}@${domain}`;
  const password = `OtpE2E${Date.now()}`;
  const created = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (created.status !== 201) throw new Error(`mailbox create status ${created.status}`);
  const account = await created.json();

  let token = null;
  let lastStatus = null;
  for (let attempt = 1; attempt <= 6 && !token; attempt += 1) {
    const tokenRes = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, password }),
    });
    lastStatus = tokenRes.status;
    if (tokenRes.ok) token = (await tokenRes.json()).token ?? null;
    if (!token) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  if (!token) throw new Error(`mailbox token missing (last status ${lastStatus})`);
  return { address, token, accountId: account.id };
}

/** 轮询收件箱，读取本次验证码（不打印明文）。 */
async function waitForOtp(inbox, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listRes = await fetch("https://api.mail.tm/messages?page=1", {
      headers: { authorization: `Bearer ${inbox.token}` },
    });
    const list = await listRes.json().catch(() => null);
    const messages = list?.["hydra:member"] ?? [];
    if (messages.length > 0) {
      const detail = await (
        await fetch(`https://api.mail.tm/messages/${messages[0].id}`, {
          headers: { authorization: `Bearer ${inbox.token}` },
        })
      ).json();
      const text = String(detail.text ?? detail.html ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
      const otp = text.match(/\b(\d{6})\b/)?.[1] ?? null;
      if (otp) {
        return {
          otp,
          subject: detail.subject,
          from: detail.from?.address,
          receivedAt: detail.createdAt,
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`verification email not received within ${Math.round(timeoutMs / 1000)}s`);
}

async function deleteInbox(inbox) {
  try {
    await fetch(`https://api.mail.tm/accounts/${inbox.accountId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${inbox.token}` },
    });
  } catch {
    // 清理失败不影响测试结论
  }
}

const jar = new CookieJar();
let inbox = null;
let userId = null;
let testEmail = null;

try {
  if (!MANUAL_OTP) {
    await step("创建一次性测试收件箱（不使用个人邮箱）", async () => {
      inbox = await createInbox();
      testEmail = inbox.address;
      return { domain: inbox.address.split("@")[1] };
    });
  } else {
    testEmail = `manual.otp.${Date.now()}@example.com`;
  }
  if (!testEmail) {
    failed += 1;
    results.push({
      name: "E2E 前置：测试收件箱",
      ok: false,
      error: "测试收件箱创建失败，后续步骤跳过",
    });
    console.log("FAIL  E2E 前置：测试收件箱创建失败，后续步骤跳过");
  } else {
    await step("登录页 SSR 包含验证码 / 密码两种登录入口", async () => {
    const page = await api("/sign-in");
    assert(page.status === 200, `status ${page.status}`);
    for (const text of ["验证码登录", "密码登录", "获取验证码", "登录 / 注册"]) {
      assert(page.text.includes(text), `missing text: ${text}`);
    }
    fs.writeFileSync(path.join(ARTIFACTS, "sign-in.html"), page.text);
    return { status: page.status, htmlBytes: page.text.length };
  });

  await step("发送登录验证码（Next 代理 → Neon Auth → SMTP）", async () => {
    const sent = await api("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      body: { email: testEmail, type: "sign-in" },
    });
    assert(sent.status < 400, `send status ${sent.status}: ${sent.json?.code ?? sent.text.slice(0, 160)}`);
    return { status: sent.status, to: maskEmail(testEmail) };
  });

  let otp = MANUAL_OTP;
  let mail = null;
  if (!MANUAL_OTP) {
    await step("验证码邮件真实送达测试收件箱", async () => {
      mail = await waitForOtp(inbox);
      otp = mail.otp;
      return {
        subject: mail.subject,
        from: maskEmail(mail.from),
        receivedAt: mail.receivedAt,
        codeIsSixDigits: /^\d{6}$/.test(mail.otp),
      };
    });
  }

  await step("错误验证码被拒绝且不建立会话", async () => {
    const wrong = otp === "000000" ? "111111" : "000000";
    const result = await api("/api/auth/sign-in/email-otp", {
      method: "POST",
      body: { email: testEmail, otp: wrong },
      jar,
    });
    assert(result.status >= 400, `wrong otp unexpectedly accepted: ${result.status}`);
    const session = await api("/api/auth/get-session", { jar });
    assert(session.json === null, "session created after wrong otp");
    return { status: result.status, code: result.json?.code ?? null };
  });

  await step("正确验证码登录成功（新邮箱自动注册）", async () => {
    const result = await api("/api/auth/sign-in/email-otp", {
      method: "POST",
      body: { email: testEmail, otp, name: "E2E 验证码用户" },
      jar,
    });
    assert(result.status < 400, `sign-in status ${result.status}: ${result.json?.code ?? result.text.slice(0, 160)}`);
    assert(jar.cookies.size > 0, "no session cookie set");
    const session = await api("/api/auth/get-session", { jar });
    assert(session.json?.user?.email === testEmail, `session email=${session.json?.user?.email}`);
    userId = session.json.user.id;
    return { status: result.status, userId, emailVerified: session.json.user.emailVerified };
  });

  await step("受保护页可访问并补建应用 users 行", async () => {
    const page = await api("/dashboard", { jar });
    assert(page.status === 200, `dashboard status ${page.status}`);
    assert(page.text.includes("工作台"), "dashboard content missing 工作台");
    const deadline = Date.now() + 8000;
    let row = null;
    while (Date.now() < deadline) {
      const rows = await sql`select id, email from public.users where id = ${userId} limit 1`;
      row = rows[0] ?? null;
      if (row) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert(row, "public.users row not created");
    assert(row.email === testEmail, "users.email mismatch");
    return { dashboardStatus: page.status, usersRowCreated: true };
  });

  await step("邮箱已验证标记写入 neon_auth.user", async () => {
    const rows = await sql`
      select email, "emailVerified"
      from neon_auth."user"
      where id::text = ${userId}
      limit 1
    `;
    assert(rows[0], "auth user missing");
    assert(rows[0].emailVerified === true, `emailVerified=${rows[0].emailVerified}`);
    return { emailVerified: rows[0].emailVerified };
  });

  await step("登出后会话清空", async () => {
    const result = await api("/api/auth/sign-out", { method: "POST", body: {}, jar });
    assert(result.status < 400, `sign-out status ${result.status}`);
    const session = await api("/api/auth/get-session", { jar });
    assert(session.json === null, "session still present after sign-out");
    jar.clear();
    return { status: result.status };
  });

  await step("未登录访问受保护页返回登录跳转", async () => {
    const page = await api("/dashboard");
    assert(page.status === 307 || page.status === 302, `unexpected status ${page.status}`);
    return { status: page.status };
  });
  }
} finally {
  try {
    if (userId) {
      await sql`delete from neon_auth."session" where "userId" = ${userId}::uuid`;
      await sql`delete from neon_auth."account" where "userId" = ${userId}::uuid`;
      await sql`delete from neon_auth."user" where id = ${userId}::uuid`;
      await sql`delete from public.users where id = ${userId}`;
    }
    if (testEmail) {
      await sql`delete from neon_auth."verification" where identifier = ${`sign-in-otp-${testEmail}`}`;
    }
    if (inbox) await deleteInbox(inbox);
  } catch (error) {
    console.log(`cleanup warning: ${error instanceof Error ? error.message : error}`);
  }

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    passed: results.filter((item) => item.ok).length,
    failed,
    results,
  };
  fs.writeFileSync(path.join(ARTIFACTS, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.passed} passed, ${failed} failed. Report: ${path.join(ARTIFACTS, "report.json")}`);
  process.exitCode = failed > 0 ? 1 : 0;
}
