/**
 * E2E：注销账号（删除 Neon Auth 用户 + 应用数据），并验证同邮箱可重新注册。
 * 运行：node scripts/verify/e2e-delete-account.mjs [baseUrl]
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const email = `lead.del.${Date.now()}@example.com`;
const password = "LeadE2E!2345";

function databaseUrl() {
  const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL not found");
  return match[1].replace(/^"|"$/g, "");
}

async function signUpViaApi(targetEmail) {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email: targetEmail, password, name: "Delete E2E" }),
  });
  return response.status;
}

const sql = neon(databaseUrl());
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

async function count(sqlText, userId) {
  const rows = await sql.query(sqlText, [userId]);
  return Number(rows[0].count);
}

try {
  // 1) 注册并进入工作台（首登录会写演示数据）
  await page.goto(`${baseUrl}/sign-up`, { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "Delete E2E");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.getByRole("button", { name: "注册并进入工作台" }).click();
  const deadline = Date.now() + 120_000;
  while (!page.url().includes("/dashboard")) {
    if (Date.now() > deadline) throw new Error("注册后未跳转 /dashboard");
    await page.waitForTimeout(1_000);
  }
  await page.waitForTimeout(3_000);
  const session = await page.evaluate(async () => (await fetch("/api/auth/get-session")).json());
  const userId = session?.session?.userId ?? session?.user?.id;
  console.log("[1] signed up, userId =", userId);
  console.log("[2] before delete: public.users =", await count("select count(*) from users where id = $1", userId));

  // 2) 设置页 → 注销账号 → 确认
  await page.goto(`${baseUrl}/dashboard/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "数据与隐私" }).click();
  await page.getByRole("button", { name: "注销账号" }).last().click();
  await page.getByRole("button", { name: "确认注销" }).click();

  // 3) 等待跳转首页 + 会话失效
  const redirectDeadline = Date.now() + 60_000;
  while (Date.now() < redirectDeadline && !page.url().endsWith("/")) {
    await page.waitForTimeout(500);
  }
  console.log("[3] redirected to:", page.url());
  let afterSession = null;
  for (let i = 0; i < 20; i += 1) {
    afterSession = await page.evaluate(async () => (await fetch("/api/auth/get-session")).json());
    if (!afterSession?.session) break;
    await page.waitForTimeout(500);
  }
  console.log("[4] session after delete =", JSON.stringify(afterSession));

  // 4) 数据库校验
  const publicUsers = await count("select count(*) from users where id = $1", userId);
  const authUsers = await count("select count(*) from neon_auth.user where id = $1", userId);
  console.log("[5] after delete: public.users =", publicUsers, ", neon_auth.user =", authUsers);

  // 5) 同邮箱重新注册
  const reSignupStatus = await signUpViaApi(email);
  console.log("[6] re-signup same email HTTP =", reSignupStatus);

  const passed =
    afterSession === null &&
    publicUsers === 0 &&
    authUsers === 0 &&
    reSignupStatus === 200;
  console.log(
    "RESULT",
    JSON.stringify({ email, userId, publicUsers, authUsers, reSignupStatus, sessionAfter: afterSession, pageErrors: errors, passed }),
  );
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error("DELETE ACCOUNT E2E FAILED:", error);
  await page.screenshot({ path: "scripts/verify/e2e-delete-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
