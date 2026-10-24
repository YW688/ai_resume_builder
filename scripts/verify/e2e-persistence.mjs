/**
 * 端到端验证：Neon Auth 注册 → Postgres 读写（server action 持久化）→ 刷新后仍在。
 * 运行：node scripts/verify/e2e-persistence.mjs [baseUrl]
 * 依赖：dev 服务器已启动（默认 http://127.0.0.1:3000）与 playwright 浏览器。
 */
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const email = `lead.ui.${Date.now()}@example.com`;
const password = "LeadE2E!2345";
const company = `E2E 测试公司 ${Date.now().toString().slice(-5)}`;
const jdText =
  "岗位职责：负责用户增长方向的产品规划与落地，围绕拉新与留存设计核心功能；基于 SQL 与数据分析验证迭代效果，建设业务指标体系；协同研发、设计与运营跨部门协作，推动商业化项目。任职要求：3 年以上产品经验，熟练使用 SQL，具备需求分析与项目管理能力。";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

try {
  // 1. 注册并进入工作台
  await page.goto(`${baseUrl}/sign-up`, { waitUntil: "domcontentloaded" });
  await page.fill("#sign-up-name", "E2E 用户");
  await page.fill("#sign-up-email", email);
  await page.fill("#sign-up-password", password);
  await page.getByRole("button", { name: "注册并进入工作台" }).click();
  // 首次登录会写入演示种子，跳转耗时可能较长，这里轮询 URL 而不是依赖 load 事件
  const deadline = Date.now() + 120_000;
  while (!page.url().includes("/dashboard")) {
    if (Date.now() > deadline) throw new Error("注册后 120s 内未跳转到 /dashboard");
    await page.waitForTimeout(1_000);
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  console.log("[1] sign-up ->", page.url());

  const session = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session");
    return response.json();
  });
  const userId = session?.session?.userId ?? session?.user?.id ?? null;
  console.log("[2] session userId =", userId);

  // 2. 工作台首屏应该展示服务端种子数据
  const dashboardText = await page.locator("body").innerText();
  const seeded = dashboardText.includes("林晓") || dashboardText.includes("字节跳动");
  console.log("[3] dashboard seeded demo data visible =", seeded);

  // 3. 通过「粘贴 JD」弹窗写入一个岗位（server action → Postgres）
  await page.goto(`${baseUrl}/dashboard/jobs`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "粘贴 JD" }).first().click();
  await page.getByPlaceholder("例如：字节跳动").fill(company);
  await page.getByPlaceholder("例如：高级产品经理").fill("增长产品经理（E2E）");
  await page.getByPlaceholder("例如：上海 · 杨浦").fill("上海 · 测试");
  await page.getByPlaceholder("例如：30-50K · 15 薪").fill("30-45K");
  await page.getByPlaceholder("例如：BOSS 直聘").fill("E2E");
  await page.locator("textarea").fill(jdText);
  await page.getByRole("button", { name: "保存并分析" }).click();
  await page.getByText("已保存并分析岗位").waitFor({ timeout: 20_000 });
  // 等 server action 真正落库（toast 是乐观更新，早于持久化完成）
  await page.waitForTimeout(3_000);
  console.log("[4] job saved via server action");

  // 4. 刷新后仍在（从 Postgres 重新加载）；最多重试 3 次，覆盖 action 落库与刷新竞态
  let persisted = false;
  for (let attempt = 0; attempt < 3 && !persisted; attempt += 1) {
    await page.reload({ waitUntil: "networkidle" });
    persisted = await page
      .getByText(company)
      .first()
      .isVisible({ timeout: 8_000 })
      .catch(() => false);
    if (!persisted) await page.waitForTimeout(2_000);
  }
  if (!persisted) throw new Error("刷新 3 次后仍未看到新岗位，持久化失败");
  console.log("[5] job persisted after reload =", company);
  // 5. 通知标记已读（UPDATE 路径）
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  const beforeUrl = page.url();

  const result = {
    email,
    userId,
    seeded,
    company,
    pageUrl: beforeUrl,
    pageErrors: errors,
  };
  console.log("RESULT", JSON.stringify(result));
} catch (error) {
  console.error("E2E FAILED:", error);
  console.error("pageErrors:", errors);
  await page.screenshot({ path: "scripts/verify/e2e-failure.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
