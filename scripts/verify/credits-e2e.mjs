/**
 * 点数计费 + AI 润色的真实浏览器端到端验证（Playwright）。
 *
 * 前置：
 *   PAY_PROVIDER=manual PAY_ALLOW_MANUAL=1 AI_MOCK=1 npm run start   （或 npm run dev）
 *   .env.local 已配置 Neon Auth / DATABASE_URL。
 *
 * 覆盖：注册新账号 → 设置页点数余额/每日免费 → 沙箱购买套餐到账 →
 * 编辑器 AI 整份生成扣 2 点 → AI 整理技能扣 1 点 → 跨天免费额度重置 →
 * 375px 布局 → 截图证据。
 *
 * 运行：node scripts/verify/credits-e2e.mjs
 * 证据：.tools/credits-e2e/{report.json,*.png}
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.CREDITS_E2E_BASE ?? "http://localhost:3000";
const ARTIFACTS = path.resolve(process.env.CREDITS_E2E_ARTIFACTS ?? ".tools/credits-e2e");
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

function randomEmail() {
  return `e2e.credits.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

const user = { email: randomEmail(), password: "ResumeE2E!Passw0rd" };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function session() {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", { headers: { accept: "application/json" } });
    return response.json();
  });
}

async function balanceFromSettings() {
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle" });
  // 设置页默认在「个人资料」，点数面板需要切到「点数与套餐」标签。
  await page.getByRole("button", { name: "点数与套餐", exact: true }).click();
  await page.waitForSelector(".credit-balance-value", { timeout: 30000 });
  const value = (await page.locator(".credit-balance-value").first().innerText()).trim();
  const daily = (await page.locator(".credit-daily-value").first().innerText()).trim();
  return { balance: Number(value), daily };
}

try {
  // 1) 注册新账号（新账号会自动种入演示数据 + 18 点演示余额）
  await step("注册新账号 → 工作台", async () => {
    await page.goto(`${BASE}/sign-up?redirect_url=%2Fdashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.getByLabel("昵称", { exact: false }).fill("点数 E2E 用户");
    await page.getByLabel("邮箱", { exact: true }).fill(user.email);
    await page.getByLabel("密码", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "注册并进入工作台" }).click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60000 });
    await page.waitForSelector("text=工作台", { timeout: 40000 });
    const s = await session();
    assert(s?.user?.email === user.email, "session email mismatch");
    return { userId: s.user.id };
  });

  // 2) 设置页初始点数：演示余额 18 + 今日免费 5
  const initial = await step("设置页展示点数余额与每日免费额度", async () => {
    const state = await balanceFromSettings();
    assert(state.balance === 18, `expected 18 credits, got ${state.balance}`);
    assert(/\d+\s*\/\s*5\s*点/.test(state.daily), `daily text=${state.daily}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "01-settings-credits-1440.png"), fullPage: true });
    return state;
  });

  // 3) 沙箱购买体验包：18 → 30 点，订单出现
  await step("沙箱购买体验包（¥9.9 / 12 点）", async () => {
    await page.getByRole("button", { name: "点数与套餐", exact: true }).click();
    await page.waitForSelector(".credit-balance-value", { timeout: 30000 });
    // 侧栏点数卡里也有一个「购买点数」链接；这里点余额区的实心按钮（最后一个）。
    await page.getByRole("button", { name: "购买点数", exact: true }).last().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 15000 });
    await dialog.getByRole("button", { name: "购买 体验包", exact: true }).click();
    await page.waitForSelector("text=本机沙箱：点数已模拟到账", { timeout: 30000 });
    await page.reload({ waitUntil: "networkidle" });
    const state = await balanceFromSettings();
    assert(state.balance === 30, `expected 30 after purchase, got ${state.balance}`);
    const body = await page.locator("body").innerText();
    assert(body.includes("体验包"), "order row missing 体验包");
    assert(body.includes("¥9.90") || body.includes("¥9.9"), "order amount missing");
    await page.screenshot({ path: path.join(ARTIFACTS, "02-settings-after-purchase-1440.png"), fullPage: true });
    return { balance: state.balance };
  });

  // 4) 编辑器：AI 整份生成消耗 2 点（AI_MOCK=1 走本地确定性示例）
  await step("AI 整份生成：确认 2 点 → 扣点成功", async () => {
    await page.goto(`${BASE}/editor`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=AI 简历助手", { timeout: 40000 });
    await page.waitForSelector("text=AI 生成整份简历（2 点）", { timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "03-editor-ai-bar-1440.png"), fullPage: true });
    await page.getByRole("button", { name: /AI 生成整份简历（2 点）/ }).click();
    await page.waitForSelector("text=本次消耗", { timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "04-generate-confirm-1440.png"), fullPage: true });
    await page.getByRole("button", { name: /确认生成（2 点）/ }).click();
    await page.waitForSelector("text=整份简历已生成（消耗 2 点）", { timeout: 60000 });
    await page.waitForTimeout(800);
    return { toast: "整份简历已生成（消耗 2 点）" };
  });

  // 5) 生成后：余额仍 30，每日免费从 5 扣到 3
  await step("扣点先扣每日免费：余额 30 不变、今日免费 3/5", async () => {
    const state = await balanceFromSettings();
    assert(state.balance === 30, `balance should stay 30, got ${state.balance}`);
    assert(state.daily.replace(/\s/g, "").startsWith("2/5"), `daily=${state.daily}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "05-settings-after-ai-1440.png"), fullPage: true });
    return state;
  });

  // 6) AI 整理技能再扣 1 点（每日免费 3 → 2）
  await step("AI 整理技能：再扣 1 点", async () => {
    await page.goto(`${BASE}/editor`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=AI 整理技能（1 点）", { timeout: 40000 });
    await page.getByRole("button", { name: /AI 整理技能（1 点）/ }).click();
    await page.waitForSelector("text=技能栏已整理（消耗 1 点）", { timeout: 60000 });
    return null;
  });

  await step("技能整理后每日免费剩 2/5", async () => {
    const state = await balanceFromSettings();
    assert(state.balance === 30, `balance should stay 30, got ${state.balance}`);
    assert(state.daily.replace(/\s/g, "").startsWith("3/5"), `daily=${state.daily}`);
    return state;
  });

  // 7) 跨天重置（直接改测试账号的 daily_credits_date 为昨天）
  await step("跨天后每日免费额度重置为 5", async () => {
    const s = await session();
    const userId = s.user.id;
    const { neon } = await import("@neondatabase/serverless");
    const envPath = path.resolve(process.cwd(), ".env.local");
    const env = {};
    for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[line.slice(0, eq).trim()] = value;
    }
    const sql = neon(env.DATABASE_URL);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    await sql`update users set daily_credits_date = ${yesterday}, daily_credits_used = 5 where id = ${userId}`;
    const state = await balanceFromSettings();
    assert(state.daily.replace(/\s/g, "").startsWith("0/5"), `daily=${state.daily}`);
    const body = await page.locator("body").innerText();
    assert(body.includes("还剩 5 点"), "daily reset UI missing");
    return state;
  });

  // 8) 落地页定价与 375px 截图
  await step("落地页点数定价（1440）", async () => {
    await page.goto(`${BASE}/#pricing`, { waitUntil: "networkidle" });
    await page.waitForSelector("#pricing", { timeout: 20000 });
    await page.waitForSelector("text=体验包", { timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "06-landing-pricing-1440.png"), fullPage: false });
    const body = await page.locator("body").innerText();
    assert(body.includes("体验包") && body.includes("求职包") && body.includes("冲刺包"), "packages missing");
    assert(body.includes("每天") && body.includes("5 点"), "daily free copy missing");
    return null;
  });

  await step("设置页 375px 无横向溢出", async () => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "点数与套餐", exact: true }).click();
    await page.waitForSelector(".credit-balance-value", { timeout: 30000 });
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert(overflowX <= 0, `overflowX=${overflowX}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "07-settings-375.png"), fullPage: true });
    return { overflowX };
  });
} finally {
  const report = {
    base: BASE,
    at: new Date().toISOString(),
    user: { email: user.email },
    passed: results.filter((item) => item.ok).length,
    failed,
    consoleErrors,
    results,
  };
  fs.writeFileSync(path.join(ARTIFACTS, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`\n${report.passed} passed, ${failed} failed. Report: ${path.join(ARTIFACTS, "report.json")}`);
  process.exitCode = failed > 0 ? 1 : 0;
}
