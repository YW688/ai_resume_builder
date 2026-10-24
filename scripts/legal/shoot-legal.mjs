// 法律页验收：三档视口截图 + 横向溢出 / h1 / 目录锚点 / 浅底可读性检查。
// 用法: node scripts/legal/shoot-legal.mjs [base-url]
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const OUT = path.resolve("design");
const pages = [
  { slug: "terms", path: "/terms", expect: "用户服务条款" },
  { slug: "privacy", path: "/privacy", expect: "隐私政策" },
];
const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ channel: "chromium" });
const errors = [];

for (const item of pages) {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[${item.slug}/${viewport.name}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`[${item.slug}/${viewport.name}] pageerror: ${err.message}`));
    await page.goto(`${BASE}${item.path}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const checks = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const shell = document.querySelector(".legal-shell");
      const tocLinks = [...document.querySelectorAll('nav[aria-label="目录"] a')];
      const firstTocHref = tocLinks[0]?.getAttribute("href") ?? null;
      const target = firstTocHref ? document.querySelector(firstTocHref) : null;
      return {
        title: document.title,
        h1: h1?.textContent?.trim() ?? null,
        sections: document.querySelectorAll("article section.legal-section").length,
        toc: tocLinks.length,
        firstTocTargetExists: Boolean(target),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyBg: shell ? getComputedStyle(shell).backgroundColor : null,
        sectionBg: getComputedStyle(document.querySelector("article section.legal-section")).backgroundColor,
        textColor: getComputedStyle(document.querySelector("article section.legal-section p")).color,
      };
    });
    await page.screenshot({
      path: path.join(OUT, `legal-${item.slug}-${viewport.name}.png`),
      fullPage: true,
    });
    console.log(`CHECK ${item.slug}/${viewport.name}`, JSON.stringify(checks));
    if (!checks.h1?.includes(item.expect)) errors.push(`[${item.slug}/${viewport.name}] h1 mismatch`);
    if (checks.overflowX > 0) errors.push(`[${item.slug}/${viewport.name}] horizontal overflow ${checks.overflowX}px`);
    if (checks.toc !== 17 && item.slug === "terms") errors.push(`[${item.slug}] terms toc ${checks.toc}`);
    if (!checks.firstTocTargetExists) errors.push(`[${item.slug}/${viewport.name}] toc anchor missing`);
    if (checks.bodyBg === "rgb(10, 10, 10)" || checks.sectionBg === "rgb(10, 10, 10)") {
      errors.push(`[${item.slug}/${viewport.name}] dark background detected`);
    }
    await page.close();
  }
}

// 锚点跳转检查
const anchorPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await anchorPage.goto(`${BASE}/terms`, { waitUntil: "load" });
await anchorPage.click('nav[aria-label="目录"] a[href="#law-dispute"]', { timeout: 2000 }).catch(() => {});
await anchorPage.waitForTimeout(300);
const hash = await anchorPage.evaluate(() => location.hash);
console.log("ANCHOR", hash);
if (hash !== "#law-dispute") errors.push(`anchor jump failed: ${hash}`);
await anchorPage.close();

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "ERRORS: none");
await browser.close();
process.exit(errors.length ? 1 : 0);
