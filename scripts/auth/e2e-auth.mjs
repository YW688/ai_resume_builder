/**
 * Neon Auth 端到端验证（Playwright，真实浏览器）。
 *
 * 前置：dev server 已运行（默认 http://localhost:3000），.env.local 已配置 Neon Auth。
 * 运行：node scripts/auth/e2e-auth.mjs
 *
 * 覆盖：未登录受保护路由跳转（带回跳参数）→ UI 注册 → 会话恢复 → 受保护页访问
 * → JWT 获取 → 登出 → 登出后受保护页跳转 → UI 登录（回跳）→ 错误密码错误态。
 * 截图与报告写到 .tools/auth-e2e/（不入库）。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUTH_E2E_BASE ?? "http://localhost:3000";
const BASE_ALT = process.env.AUTH_E2E_BASE_ALT ?? "http://127.0.0.1:3000";
const ARTIFACTS = path.resolve(process.env.AUTH_E2E_ARTIFACTS ?? ".tools/auth-e2e");
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
  return `e2e.ui.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

const testUserFile = "/tmp/auth-test-user.json";
const seedUser = fs.existsSync(testUserFile)
  ? JSON.parse(fs.readFileSync(testUserFile, "utf8"))
  : {
      email: process.env.AUTH_E2E_EMAIL,
      password: process.env.AUTH_E2E_PASSWORD,
    };

const newUser = { email: randomEmail(), password: "ResumeE2E!Passw0rd" };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function sessionOf(p) {
  return p.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", {
      headers: { accept: "application/json" },
    });
    return { status: response.status, body: await response.json() };
  });
}

/**
 * 打开登录/注册页并等表单完成水合。
 * 页面使用 Suspense 流式渲染，若在 hydrated 前填写，输入可能被后续 RSC 渲染重置，
 * 导致点击提交时字段为空、按钮停在 pending。networkidle + 等待隐藏的 redirectUrl
 * 输入出现（即流式内容已到位）后再填写。
 */
async function openAuthPage(p, path, expectedRedirect) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  if (expectedRedirect) {
    await p.waitForFunction(
      (expected) =>
        document.querySelector('input[name="redirectUrl"]')?.value === expected,
      expectedRedirect,
      { timeout: 20000 },
    );
  }
}

async function signOutViaApp(p) {
  return p.evaluate(async () => {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return { status: response.status };
  });
}

try {
  // 1) 未登录访问受保护路由 → /sign-in，且带回跳参数
  await step("未登录 /dashboard → /sign-in?redirect_url=/dashboard", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/sign-in/, { timeout: 20000 });
    const url = new URL(page.url());
    assert(url.pathname === "/sign-in", `unexpected path ${url.pathname}`);
    assert(
      url.searchParams.get("redirect_url") === "/dashboard",
      `redirect_url=${url.searchParams.get("redirect_url")}`,
    );
    await page.waitForSelector("text=登录", { timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "01-protected-redirect.png"), fullPage: true });
    return { url: url.pathname + url.search };
  });

  // 2) UI 注册（邮箱 + 密码）→ 进入产品区
  await step("UI 注册新账号 → /dashboard", async () => {
    await openAuthPage(page, "/sign-up?redirect_url=%2Fdashboard", "/dashboard");
    await page.getByLabel("昵称", { exact: false }).fill("E2E 注册用户");
    await page.getByLabel("邮箱", { exact: true }).fill(newUser.email);
    await page.getByLabel("密码", { exact: true }).fill(newUser.password);
    await page.getByRole("button", { name: "注册并进入工作台" }).click();
    await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 40000 });
    await page.waitForSelector("text=工作台", { timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "02-after-signup.png"), fullPage: true });
    const session = await sessionOf(page);
    assert(session.body?.user?.email === newUser.email, `session email=${session.body?.user?.email}`);
    return { url: page.url(), userId: session.body.user.id };
  });

  // 3) 刷新后会话恢复（cookie 持久、服务端可读取）
  await step("刷新 /dashboard 会话恢复", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=工作台", { timeout: 20000 });
    const session = await sessionOf(page);
    assert(session.status === 200, `status ${session.status}`);
    assert(session.body?.user?.email === newUser.email, "session lost after reload");
    await page.screenshot({ path: path.join(ARTIFACTS, "03-session-restored.png"), fullPage: true });
    return { url: page.url(), email: session.body.user.email };
  });

  // 4) 已登录访问另一个受保护页
  await step("已登录访问 /dashboard/settings", async () => {
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
    assert(new URL(page.url()).pathname === "/dashboard/settings", `ended at ${page.url()}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "04-settings-authenticated.png"), fullPage: true });
    return { url: page.url() };
  });

  // 5) 受保护 API：已登录可取 JWT（供 Neon Functions / Realtime 使用）
  await step("GET /api/auth/token 返回 JWT", async () => {
    const result = await page.evaluate(async () => {
      const response = await fetch("/api/auth/token", { headers: { accept: "application/json" } });
      return { status: response.status, body: await response.json() };
    });
    assert(result.status === 200, `status ${result.status}`);
    const token = result.body?.token;
    assert(typeof token === "string" && token.split(".").length === 3, "token is not a JWT");
    return { status: result.status, jwtSegments: token.split(".").length, tokenLength: token.length };
  });

  // 6) 登出（与应用内 authClient.signOut 同一路径：POST /api/auth/sign-out）
  await step("登出后会话清空", async () => {
    const out = await signOutViaApp(page);
    assert(out.status === 200 || out.status === 204, `sign-out status ${out.status}`);
    const session = await sessionOf(page);
    assert(session.body === null, `session still exists: ${JSON.stringify(session.body)}`);
    return { signOutStatus: out.status, session: session.body };
  });

  // 7) 登出后访问受保护页 → 跳 /sign-in
  await step("登出后 /dashboard → /sign-in", async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/sign-in/, { timeout: 20000 });
    assert(new URL(page.url()).pathname === "/sign-in", `ended at ${page.url()}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "05-after-signout-redirect.png"), fullPage: true });
    return { url: page.url() };
  });

  // 8) UI 登录（回跳到原目标页）
  await step("UI 登录 → 回跳 /dashboard/settings", async () => {
    await openAuthPage(
      page,
      "/sign-in?redirect_url=%2Fdashboard%2Fsettings",
      "/dashboard/settings",
    );
    await page.getByLabel("邮箱", { exact: true }).fill(newUser.email);
    await page.getByLabel("密码", { exact: true }).fill(newUser.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(/\/dashboard\/settings/, { timeout: 40000 });
    await page.screenshot({ path: path.join(ARTIFACTS, "06-signin-redirect-back.png"), fullPage: true });
    return { url: page.url() };
  });

  // 9) 错误密码 → 中文错误态，URL 不变
  await step("错误密码显示错误态", async () => {
    await signOutViaApp(page);
    await openAuthPage(page, "/sign-in");
    await page.getByLabel("邮箱", { exact: true }).fill(newUser.email);
    await page.getByLabel("密码", { exact: true }).fill("DefinitelyWrong!123");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForSelector("text=邮箱或密码不正确", { timeout: 30000 });
    assert(new URL(page.url()).pathname === "/sign-in", `unexpected redirect ${page.url()}`);
    await page.screenshot({ path: path.join(ARTIFACTS, "07-login-error.png"), fullPage: true });
    return { url: page.url() };
  });

  // 10) 种子账号可登录（供其他 E2E 复用）
  if (seedUser.email && seedUser.password) {
    await step("种子测试账号可登录", async () => {
      await openAuthPage(page, "/sign-in");
      await page.getByLabel("邮箱", { exact: true }).fill(seedUser.email);
      await page.getByLabel("密码", { exact: true }).fill(seedUser.password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 40000 });
      return { url: page.url() };
    });
  }

  // 11) 备用 origin（127.0.0.1）注册：验证 next.config allowedDevOrigins +
  //     Neon Auth trusted domain 两项配置，避免 E2E 脚本换 host 时静默失败。
  await step("127.0.0.1 注册 → /dashboard（dev origin / trusted domain）", async () => {
    const altContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const altPage = await altContext.newPage();
    try {
      const altUser = { email: randomEmail(), password: "ResumeE2E!Passw0rd" };
      await altPage.goto(`${BASE_ALT}/sign-up`, { waitUntil: "networkidle" });
      await altPage.waitForTimeout(400);
      await altPage.getByLabel("昵称", { exact: false }).fill("E2E 127 用户");
      await altPage.getByLabel("邮箱", { exact: true }).fill(altUser.email);
      await altPage.getByLabel("密码", { exact: true }).fill(altUser.password);
      await altPage.getByRole("button", { name: "注册并进入工作台" }).click();
      await altPage.waitForURL(/\/dashboard/, { timeout: 40000 });
      const session = await sessionOf(altPage);
      assert(session.body?.user?.email === altUser.email, "alt-origin session missing");
      return { origin: BASE_ALT, url: altPage.url(), email: altUser.email };
    } finally {
      await altContext.close();
    }
  });
} finally {
  const report = {
    base: BASE,
    at: new Date().toISOString(),
    passed: results.filter((item) => item.ok).length,
    failed,
    registeredUser: { email: newUser.email, hasPassword: true },
    consoleErrors,
    results,
  };
  fs.writeFileSync(path.join(ARTIFACTS, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(ARTIFACTS, "registered-user.json"),
    JSON.stringify(newUser, null, 2),
  );
  await browser.close();
  console.log(`\n${report.passed} passed, ${failed} failed. Report: ${path.join(ARTIFACTS, "report.json")}`);
  process.exitCode = failed > 0 ? 1 : 0;
}
