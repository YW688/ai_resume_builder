// 抽取本地 mp4 的若干帧为 JPEG，便于查看参考视频的运镜/画面。
// 用法: node scripts/peek_video.mjs <video-path> <out-prefix> [t1,t2,...]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const videoPath = path.resolve(process.argv[2]);
const outPrefix = path.resolve(process.argv[3]);
const times = (process.argv[4] ?? "0.5,2,4,6,8").split(",").map(Number);

const dir = path.dirname(videoPath);
const types = { ".mp4": "video/mp4", ".html": "text/html", ".jpg": "image/jpeg" };

const server = http.createServer((req, res) => {
  const url = req.url === "/" || req.url === "/peek.html" ? "/peek.html" : req.url.split("?")[0];
  const file = url === "/peek.html" ? null : path.join(dir, decodeURIComponent(url));
  if (url === "/peek.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><body style="margin:0;background:#000">
<video id="v" src="${path.basename(videoPath)}" muted playsinline preload="auto"></video>
<canvas id="c" style="display:none"></canvas></body>`);
    return;
  }
  fs.stat(file, (err, st) => {
    if (err) {
      res.writeHead(404);
      res.end("nf");
      return;
    }
    const type = types[path.extname(file)] ?? "application/octet-stream";
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${st.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": st.size,
      });
      fs.createReadStream(file).pipe(res);
    }
  });
});

await new Promise((r) => server.listen(8791, "127.0.0.1", r));

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8791/peek.html");

const meta = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const v = document.getElementById("v");
      const done = (o) => resolve(o);
      const ok = () =>
        done({ ok: true, duration: v.duration, w: v.videoWidth, h: v.videoHeight });
      if (v.readyState >= 1) return ok();
      v.onloadedmetadata = ok;
      v.onerror = () => done({ ok: false, err: "decode/load error" });
      setTimeout(() => done({ ok: false, err: "timeout" }), 15000);
    }),
);
console.log("META", JSON.stringify(meta));
if (!meta.ok) {
  await browser.close();
  server.close();
  process.exit(1);
}

for (const [i, t] of times.entries()) {
  const dataUrl = await page.evaluate(
    ([t]) =>
      new Promise((resolve) => {
        const v = document.getElementById("v");
        const c = document.getElementById("c");
        const grab = () => {
          c.width = 960;
          c.height = Math.round((960 * v.videoHeight) / v.videoWidth);
          c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.85));
        };
        v.currentTime = Math.min(t, v.duration - 0.1);
        const poll = setInterval(() => {
          if (Math.abs(v.currentTime - Math.min(t, v.duration - 0.1)) < 0.05 && v.readyState >= 2) {
            clearInterval(poll);
            setTimeout(grab, 100);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(poll);
          grab();
        }, 5000);
      }),
    [t],
  );
  const out = `${outPrefix}_${i}_t${t}.jpg`;
  fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("WROTE", out);
}

await browser.close();
server.close();
