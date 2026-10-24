/**
 * 端到端验证 Neon Realtime：已登录页面保持打开 → 数据库插入新通知 →
 * 页面通过 live query 收到变更并自动刷新（无需手动刷新）。
 *
 * 运行：node scripts/verify/e2e-realtime.mjs [baseUrl]
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

function databaseUrl() {
  const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1].replace(/^"|"$/g, "");
}

const email = `lead.realtime.${Date.now()}@example.com`;
const title = `实时通知 ${Date.now()}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

try {
  // 注册一个全新账号（首登录会自动写入演示种子）
  await page.goto(`${baseUrl}/sign-up`, { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "Realtime E2E");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", "LeadE2E!2345");
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 45_000 }),
    page.getByRole("button", { name: "注册并进入工作台" }).click(),
  ]);
  const session = await page.evaluate(async () => (await fetch("/api/auth/get-session")).json());
  const userId = session?.session?.userId ?? session?.user?.id;
  console.log("[1] signed up, userId =", userId);

  // 等待工作台渲染完成（首登录种子写入较慢），再打开通知面板
  const bell = page.getByRole("button", { name: /通知/ }).first();
  await bell.waitFor({ state: "visible", timeout: 120_000 });
  await bell.click();
  const seededCount = await page.locator(".notif-list li, .notif-item").count().catch(() => 0);
  console.log("[2] notification panel opened, seeded items =", seededCount);

  // 等服务端 Realtime 订阅建立
  await page.waitForTimeout(3_000);

  // 直接写库（模拟另一个端/后台任务产生的新通知）
  const sql = neon(databaseUrl());
  await sql`insert into notifications (user_id, title, body, at, read, kind)
            values (${userId}, ${title}, '来自数据库的实时变更', now(), false, 'application')`;
  console.log("[3] inserted notification directly into Postgres:", title);

  // 不刷新页面，等待 UI 自动出现新通知
  let appeared = false;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 75_000 && !appeared) {
    appeared = await page
      .getByText(title)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!appeared) await page.waitForTimeout(1_000);
  }

  if (!appeared) {
    await page.screenshot({ path: "scripts/verify/e2e-realtime-failure.png", fullPage: true });
    throw new Error("75 秒内未在页面上看到实时插入的通知");
  }
  console.log("[4] realtime UI update received without reload, took ms =", Date.now() - startedAt);
  console.log("RESULT", JSON.stringify({ email, userId, title, realtime: true, pageErrors: errors }));
} catch (error) {
  console.error("REALTIME E2E FAILED:", error);
  console.error("pageErrors:", errors);
  await page.screenshot({ path: "scripts/verify/e2e-realtime-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
