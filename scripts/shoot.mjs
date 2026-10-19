// 落地页验收脚本：三档视口截图 + 横向溢出/h1/alt 检查 + reduced-motion + 标题对比度 + 4G 模拟 LCP。
// 用法: node scripts/shoot.mjs [base-url]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const SHOTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({ channel: "chromium" });
const consoleErrors = [];

for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${s.name}] ${m.text()}`);
  });
  page.on("requestfailed", (r) => {
    consoleErrors.push(`[${s.name}] REQFAIL ${r.failure()?.errorText} ${r.url()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${s.name}] pageerror: ${e.message}`));
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2500); // 等视频 canplay+400ms 淡入完成
  await page.screenshot({ path: `design/shot-${s.name}-hero.png` });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `design/shot-${s.name}.png`, fullPage: true });

  const checks = await page.evaluate(() => {
    const v = document.querySelector("video");
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: document.querySelectorAll("h1").length,
      imgNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
      video: v
        ? { paused: v.paused, muted: v.muted, loop: v.loop, ready: v.readyState, currentSrc: v.currentSrc.split("/").pop() }
        : null,
      cls: Number(window.__cls.toFixed(4)),
    };
  });
  console.log(`CHECK ${s.name}`, JSON.stringify(checks));
  await page.close();
}

// prefers-reduced-motion：视频必须暂停、停留在 poster
const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await rm.goto(BASE, { waitUntil: "load" });
await rm.waitForTimeout(1500);
const rmState = await rm.evaluate(() => {
  const v = document.querySelector("video");
  return { paused: v?.paused ?? null, opacity: v ? getComputedStyle(v).opacity : null };
});
console.log("REDUCED-MOTION", JSON.stringify(rmState));
await rm.screenshot({ path: "design/shot-reduced-1440.png" });
await rm.close();

// 标题对比度：取样 poster 标题区（x30-70%, y30-50%）平均相对亮度，对炭色 #18181b
const cp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await cp.goto(BASE, { waitUntil: "load" });
const contrast = await cp.evaluate(async () => {
  const img = new Image();
  img.src = "/hero/poster.jpg";
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  // 1440x900 cover: scale=0.8333, 显示宽 1600, 水平居中偏移 80
  const scale = 900 / 1080;
  const offX = (1920 * scale - 1440) / 2;
  const px = (vx) => (vx + offX) / scale;
  const py = (vy) => vy / scale;
  const x = Math.round(px(1440 * 0.3));
  const y = Math.round(py(900 * 0.3));
  const w = Math.round(px(1440 * 0.7) - x);
  const h = Math.round(py(900 * 0.55) - y);
  const d = ctx.getImageData(x, y, w, h).data;
  const lin = (v) => {
    const t = v / 255;
    return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4);
  };
  const alphaAt = (vx, vy) => {
    const rx = 0.75 * 1440;
    const ry = 0.65 * 900;
    const t = Math.hypot((vx - 0.5 * 1440) / rx, (vy - 0.45 * 900) / ry);
    if (t <= 0.45) return 0.86 + (0.55 - 0.86) * (t / 0.45);
    if (t <= 0.78) return 0.55 * (1 - (t - 0.45) / 0.33);
    return 0;
  };
  let bg = 0;
  let i = 0;
  for (let vy = 900 * 0.3; vy < 900 * 0.55; vy++) {
    for (let vx = 1440 * 0.3; vx < 1440 * 0.7; vx++) {
      const a = alphaAt(vx, vy);
      const r = 255 * a + d[i] * (1 - a);
      const g = 252 * a + d[i + 1] * (1 - a);
      const b = 244 * a + d[i + 2] * (1 - a);
      bg += 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      i += 4;
    }
  }
  bg /= (w * h);
  const text = 0.2126 * lin(0x18) + 0.7152 * lin(0x18) + 0.0722 * lin(0x1b);
  const ratio = (Math.max(bg, text) + 0.05) / (Math.min(bg, text) + 0.05);
  return { bgLum: Number(bg.toFixed(4)), ratio: Number(ratio.toFixed(2)) };
});
console.log("CONTRAST", JSON.stringify(contrast));
await cp.close();

// 4G 模拟下的 LCP（poster 为首屏 LCP 候选）
const ctx4g = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cdp = await ctx4g.newCDPSession(await ctx4g.newPage());
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 70,
  downloadThroughput: 1.4 * 1024 * 1024,
  uploadThroughput: 512 * 1024,
});
const lcpPage = await ctx4g.newPage();
const lcpCdp = await ctx4g.newCDPSession(lcpPage);
await lcpCdp.send("Network.enable");
await lcpCdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 70,
  downloadThroughput: 1.4 * 1024 * 1024,
  uploadThroughput: 512 * 1024,
});
await lcpPage.addInitScript(() => {
  window.__lcp = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
});
await lcpPage.goto(BASE, { waitUntil: "load" });
await lcpPage.waitForTimeout(3000);
const lcp = await lcpPage.evaluate(() => {
  const entries = performance.getEntriesByType("largest-contentful-paint");
  const byObs = window.__lcp;
  const poster = performance.getEntriesByType("resource").find((e) => e.name.includes("poster"));
  return Math.max(byObs, entries.length ? entries[entries.length - 1].startTime : 0, poster ? poster.responseEnd : 0);
});
console.log("LCP-4G", Math.round(lcp), "ms");
await ctx4g.close();

console.log(consoleErrors.length ? `CONSOLE-ERRORS:\n${consoleErrors.join("\n")}` : "CONSOLE-ERRORS: none");
await browser.close();
