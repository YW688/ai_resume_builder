/**
 * 邮箱验证码登录的浏览器级 E2E（真实点击 + 真实收信）。
 *
 * 覆盖：/sign-in 默认验证码 Tab → 点击「获取验证码」（浏览器内
 * authClient.emailOtp.sendVerificationOtp）→ 一次性测试邮箱收码 →
 * 填写验证码 → 点击「登录 / 注册」（Server Action）→ 跳转 /dashboard →
 * 会话校验 → 登出。结束后删除测试账号、验证码与临时收件箱。
 *
 * 隐私：不使用个人邮箱；不打印验证码、cookie 或完整邮箱；截图仅保存本地面板。
 *
 * 运行：node scripts/auth/e2e-otp-ui.mjs
 * 前置：dev server 已启动（默认 http://localhost:3000）。
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const ROOT = process.cwd();
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sql = neon(env.DATABASE_URL);

const BASE = process.env.OTP_UI_BASE ?? "http://localhost:3000";
const ARTIFACTS = path.resolve(ROOT, process.env.OTP_UI_ARTIFACTS ?? ".tools/auth-otp-ui");
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

async function createInbox() {
  const domains = await (await fetch("https://api.mail.tm/domains")).json();
  const domain = domains["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("mail.tm domain unavailable");
  const address = `otpui${Date.now()}@${domain}`;
  const password = `OtpUI${Date.now()}`;
  const created = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (created.status !== 201) throw new Error(`mailbox create status ${created.status}`);
  const account = await created.json();
  let token = null;
  for (let attempt = 1; attempt <= 6 && !token; attempt += 1) {
    const res = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, password }),
    });
    if (res.ok) token = (await res.json()).token ?? null;
    if (!token) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  if (!token) throw new Error("mailbox token missing");
  return { address, token, accountId: account.id };
}

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
      if (otp) return { otp, subject: detail.subject };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("verification email not received");
}

async function deleteInbox(inbox) {
  try {
    await fetch(`https://api.mail.tm/accounts/${inbox.accountId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${inbox.token}` },
    });
  } catch {
    // 清理失败不影响结论
  }
}

let inbox = null;
let browser = null;
let userId = null;
let testEmail = null;

try {
  await step("创建一次性测试收件箱（不使用个人邮箱）", async () => {
    inbox = await createInbox();
    testEmail = inbox.address;
    return { domain: testEmail.split("@")[1] };
  });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await step("打开登录页：默认展示验证码登录", async () => {
    await page.goto(`${BASE}/sign-in?redirect_url=%2Fdashboard`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=验证码登录", { timeout: 20000 });
    const selected = await page.getByRole("tab", { name: "验证码登录" }).getAttribute("aria-selected");
    assert(selected === "true", `验证码登录 tab aria-selected=${selected}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "01-sign-in.png"), fullPage: true });
    return { url: page.url() };
  });

  await step("浏览器内发送验证码并进入 60 秒冷却", async () => {
    await page.getByLabel("邮箱", { exact: true }).fill(testEmail);
    await page.getByRole("button", { name: "获取验证码" }).click();
    await page.waitForSelector("text=验证码已发送至", { timeout: 30000 });
    const resend = page.getByRole("button", { name: /后可重发/ });
    await resend.waitFor({ state: "visible", timeout: 5000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "02-code-sent.png"), fullPage: true });
    return { to: maskEmail(testEmail), cooldownLabel: await resend.textContent() };
  });

  await step("真实邮件送达并填写验证码完成登录", async () => {
    const mail = await waitForOtp(inbox);
    await page.getByLabel("验证码", { exact: true }).fill(mail.otp);
    await page.getByRole("button", { name: "登录 / 注册" }).click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 40000 });
    await page.waitForSelector("text=工作台", { timeout: 20000 });
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session", { headers: { accept: "application/json" } });
      return response.json();
    });
    assert(session?.user?.email === testEmail, `session email mismatch`);
    userId = session.user.id;
    await page.screenshot({ path: path.join(ARTIFACTS, "03-after-login.png"), fullPage: true });
    return { url: page.url(), subject: mail.subject, emailVerified: session.user.emailVerified };
  });

  await step("登出后会话清空", async () => {
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.status;
    });
    assert(status < 400, `sign-out status ${status}`);
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session", { headers: { accept: "application/json" } });
      return response.json();
    });
    assert(session === null, "session still present after sign-out");
    return { status };
  });

  await step("切换密码登录 Tab 仍可用", async () => {
    await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "密码登录" }).click();
    await page.getByRole("button", { name: "登录", exact: true }).waitFor({ state: "visible", timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "04-password-tab.png"), fullPage: true });
    return { ok: true };
  });

  await step("控制台无 React / 网络错误", async () => {
    assert(consoleErrors.length === 0, `console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
    return { consoleErrors: 0 };
  });
} finally {
  try {
    if (browser) await browser.close();
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
