import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "design/ui-audit/current";
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "landing-desktop", url: "/", width: 1440, height: 900, full: true },
  { name: "landing-mobile", url: "/", width: 390, height: 844, full: true },
  { name: "dashboard", url: "/dashboard", width: 1440, height: 900, full: true },
  { name: "editor", url: "/editor", width: 1440, height: 900, full: true },
];

const browser = await chromium.launch();
for (const t of targets) {
  const ctx = await browser.newContext({
    viewport: { width: t.width, height: t.height },
    deviceScaleFactor: 1,
    locale: "zh-CN",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    const res = await page.goto("http://127.0.0.1:3000" + t.url, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${t.name}.png`, fullPage: t.full });
    console.log(`${t.name}: ${res?.status()} ${page.url()} errors=${errors.length}`);
    if (errors.length) console.log("  " + errors.slice(0, 3).join(" | "));
  } catch (e) {
    console.log(`${t.name}: FAIL ${e.message}`);
  }
  await ctx.close();
}
await browser.close();
