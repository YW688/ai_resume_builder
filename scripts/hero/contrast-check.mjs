// Hero 玻璃卡对比度实测（04-frontend-integration.md §4.3 / 05-acceptance.md C4）：
// shoot.mjs 的 CONTRAST 段仍是旧主题公式，本脚本按新版式取样真实渲染像素。
// 原理：对 .hero-glass 上/下 padding 条带（无字形区）截图取样，backdrop-filter/scrim 已合成进像素；
// 白字最坏情形 = 最亮背景像素。标题 #F4F8FC 直接对比；副标 rgba(255,255,255,.82) 先按该背景合成再对比。
// 用法: node scripts/hero/contrast-check.mjs [base-url]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const SEEK = process.argv[3] === undefined ? null : Number(process.argv[3]); // 直接把视频 seek 到第 N 秒再取样（最亮帧压测用，如 11.5=C 段天空）
// argv4：用本地 PNG 覆写 /hero/poster.jpg 的响应（headless 截屏不合成 HEVC 视频帧，
// 玻璃背后实际取样对象是 poster 层；换帧即可逐帧压测视频各时刻的最亮背景）。
const POSTER = process.argv[4] ?? null;
const VIEWS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "375", width: 375, height: 812 },
];

const lin = (v) => {
  const t = v / 255;
  return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4);
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const browser = await chromium.launch({ channel: "chromium" });
const decoder = await browser.newPage(); // 借 Chromium 解 PNG：截图 buffer -> canvas 像素
await decoder.setContent("<canvas id=c></canvas>");

for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height } });
  if (POSTER) {
    const body = (await import("node:fs")).readFileSync(POSTER);
    await page.route("**/hero/poster.jpg", (r) =>
      r.fulfill({ status: 200, contentType: "image/png", body }),
    );
  }
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2500); // 等入场动画与视频淡入稳定
  if (SEEK !== null) {
    await page.evaluate(async (t) => {
      const v = document.querySelector("video");
      v.pause();
      v.currentTime = t;
      await new Promise((r) => {
        if (v.readyState >= 2 && Math.abs(v.currentTime - t) < 0.2) return r();
        v.addEventListener("seeked", () => r(), { once: true });
        setTimeout(r, 3000);
      });
    }, SEEK);
    await page.waitForTimeout(400); // 等解码稳定
  }
  const glass = await page.evaluate(() => {
    const el = document.querySelector(".hero-glass");
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const badge = el.querySelector("span");
    const bb = badge ? badge.getBoundingClientRect() : null;
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, badge: bb };
  });
  if (!glass) {
    console.log(`CONTRAST ${v.name} FAIL no .hero-glass found`);
    await page.close();
    continue;
  }
  const shot = await page.screenshot(); // viewport-only, dpr=1 -> CSS px == 设备 px
  await page.close();
  const dataUrl = `data:image/png;base64,${shot.toString("base64")}`;
  const stats = await decoder.evaluate(async ([url, g]) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.getElementById("c");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const lin = (v) => {
      const t = v / 255;
      return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4);
    };
    const lum = (r, g2, b) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b);
    let worst = { L: -1, rgb: [0, 0, 0] };
    const scan = (y0, y1) => {
      const d = ctx.getImageData(
        Math.round(g.left + 20), Math.round(y0),
        Math.round(g.right - g.left - 40), Math.round(y1 - y0),
      ).data;
      for (let i = 0; i < d.length; i += 4) {
        const L = lum(d[i], d[i + 1], d[i + 2]);
        if (L > worst.L) worst = { L, rgb: [d[i], d[i + 1], d[i + 2]] };
      }
    };
    scan(g.top + 4, g.top + 16);     // 上 padding 条带（避开圆角/字形）
    scan(g.bottom - 16, g.bottom - 4); // 下 padding 条带
    if (g.badge) {
      // 徽章胶囊内缘上下 3px（rounded-full 端帽半径≈14px，x 内缩 20 避开描边圆弧取样污染）
      const bx = g.badge.left + 20, bw = g.badge.width - 40;
      const saved = ctx.getImageData; // 复用 scan 的取样路径：临时换 x 范围
      const dTop = ctx.getImageData(Math.round(bx), Math.round(g.badge.top + 2), Math.round(bw), 3).data;
      const dBot = ctx.getImageData(Math.round(bx), Math.round(g.badge.bottom - 5), Math.round(bw), 3).data;
      for (const d of [dTop, dBot]) {
        for (let i = 0; i < d.length; i += 4) {
          const L = lum(d[i], d[i + 1], d[i + 2]);
          if (L > worst.L) worst = { L, rgb: [d[i], d[i + 1], d[i + 2]] };
        }
      }
      void saved;
    }
    return worst;
  }, [dataUrl, glass]);

  const [br, bg, bb] = stats.rgb;
  const bgLum = lum(br, bg, bb);
  const titleRatio = ratio(bgLum, lum(0xf4, 0xf8, 0xfc));
  const subRatio = ratio(bgLum, lum(0.82 * 255 + 0.18 * br, 0.82 * 255 + 0.18 * bg, 0.82 * 255 + 0.18 * bb));
  console.log(
    `CONTRAST ${v.name} worstBg=#${[br, bg, bb].map((x) => x.toString(16).padStart(2, "0")).join("")}` +
      ` bgLum=${bgLum.toFixed(3)}` +
      ` title(#F4F8FC)=${titleRatio.toFixed(2)}:1 ${titleRatio >= 4.5 ? "PASS" : "FAIL"}` +
      ` sub(white82%)=${subRatio.toFixed(2)}:1 ${subRatio >= 4.5 ? "PASS" : "FAIL"}`,
  );
}
await browser.close();
