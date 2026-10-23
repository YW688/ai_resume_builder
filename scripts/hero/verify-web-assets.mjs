#!/usr/bin/env node
/**
 * verify-web-assets.mjs — 网页视频/封面素材的「证据化验收」
 *
 * 由来（2026-10-21）：`hero.mp4` 与 `hero-720p.mp4` 曾字节完全相同（MD5 一致），
 * 所谓 720p 档是复制的假货；且主源实为 HEVC，桌面 Firefox 无法播放。
 * 本脚本零依赖地解析 MP4 box，把这些「模型声称完成、实际没做」的情况变成 FAIL。
 *
 * 用法：
 *   node scripts/hero/verify-web-assets.mjs           # 人读格式
 *   node scripts/hero/verify-web-assets.mjs --json    # 机器读格式
 * 退出码：0 全通过（可含 WARN）；1 存在 FAIL。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HERO = join(ROOT, "public", "hero");

/** 体积上限（字节）。超出即 FAIL：移动端首屏不应下载十几 MB。 */
const MAX_BYTES = { "hero.mp4": 8 * 1024 * 1024, "hero-720p.mp4": 4 * 1024 * 1024 };
/** 主源必须是 H.264：HEVC 在桌面 Firefox 上不可播。 */
const H264 = new Set(["avc1", "avc3"]);
const HEVC = new Set(["hev1", "hvc1"]);
const CODEC_NAMES = { avc1: "H.264", avc3: "H.264", hev1: "HEVC", hvc1: "HEVC", mp4a: "AAC", vp09: "VP9", av01: "AV1" };

const results = [];
const record = (id, level, msg) => results.push({ id, level, msg });

// ---------- 最小 MP4 box 解析（零依赖） ----------
function readBoxes(buf, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header) break;
    out.push({ type, start: p, dataStart: p + header, dataEnd: Math.min(p + size, end), size });
    p += size;
  }
  return out;
}
const find = (list, type) => list.find((b) => b.type === type);

/** 返回 { codecs:[], video:{width,height,codec}|null, hasAudio, moovBeforeMdat } */
function inspectMp4(buf) {
  const top = readBoxes(buf, 0, buf.length);
  const moovIdx = top.findIndex((b) => b.type === "moov");
  const mdatIdx = top.findIndex((b) => b.type === "mdat");
  const moov = moovIdx >= 0 ? top[moovIdx] : null;
  const info = { codecs: [], video: null, hasAudio: false, moovBeforeMdat: moovIdx >= 0 && (mdatIdx < 0 || moovIdx < mdatIdx) };
  if (!moov) return info;

  for (const trak of readBoxes(buf, moov.dataStart, moov.dataEnd).filter((b) => b.type === "trak")) {
    const mdia = find(readBoxes(buf, trak.dataStart, trak.dataEnd), "mdia");
    if (!mdia) continue;
    const mdiaKids = readBoxes(buf, mdia.dataStart, mdia.dataEnd);
    const stbl = (() => {
      const minf = find(mdiaKids, "minf");
      return minf ? find(readBoxes(buf, minf.dataStart, minf.dataEnd), "stbl") : null;
    })();
    if (!stbl) continue;
    const stsd = find(readBoxes(buf, stbl.dataStart, stbl.dataEnd), "stsd");
    if (!stsd) continue;
    // stsd: version(1)+flags(3) 后 entry_count(4)，entries 从 dataStart+8 起
    for (const entry of readBoxes(buf, stsd.dataStart + 8, stsd.dataEnd)) {
      const t = entry.type;
      info.codecs.push(t);
      if (HEVC.has(t) || H264.has(t)) {
        // VisualSampleEntry：width @ +32，height @ +34
        if (entry.start + 36 <= entry.dataEnd) {
          info.video = { codec: t, width: buf.readUInt16BE(entry.start + 32), height: buf.readUInt16BE(entry.start + 34) };
        }
      }
      if (t === "mp4a" || t === ".mp3" || t === "ac-3") info.hasAudio = true;
    }
  }
  return info;
}

const sha = (p) => createHash("md5").update(readFileSync(p)).digest("hex").toUpperCase();
const kb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

// ---------- 检查项 ----------
const required = ["hero.mp4", "hero-720p.mp4", "poster.jpg", "mobile-cover.jpg"];
const present = {};
for (const name of required) {
  const p = join(HERO, name);
  if (existsSync(p)) present[name] = p;
  else record("V1 存在性", "FAIL", `缺少必需文件 public/hero/${name}`);
}
if (Object.keys(present).length === required.length) record("V1 存在性", "PASS", `4 个必需文件齐全`);

// V2 两个视频不得是同一份文件（复制假货检测）
if (present["hero.mp4"] && present["hero-720p.mp4"]) {
  const a = sha(present["hero.mp4"]);
  const b = sha(present["hero-720p.mp4"]);
  if (a === b) record("V2 档位独立", "FAIL", `hero.mp4 与 hero-720p.mp4 内容完全相同（MD5 ${a}）——720p 是复制品`);
  else record("V2 档位独立", "PASS", `MD5 不同（${a.slice(0, 8)} / ${b.slice(0, 8)}）`);
}

// V3–V6 逐个视频：编码 / 分辨率 / 音轨 / 体积 / faststart
const expect = { "hero.mp4": [1920, 1080], "hero-720p.mp4": [1280, 720] };
for (const [name, [w, h]] of Object.entries(expect)) {
  const p = present[name];
  if (!p) continue;
  const buf = readFileSync(p);
  const info = inspectMp4(buf);
  if (!info.video) {
    record(`V3 编码/${name}`, "FAIL", `解析不到视频轨（codecs: ${info.codecs.join(",") || "无"}）`);
    continue;
  }
  const codec = CODEC_NAMES[info.video.codec] ?? info.video.codec;
  if (H264.has(info.video.codec)) record(`V3 编码/${name}`, "PASS", "H.264（Firefox/Safari 均可播）");
  else if (HEVC.has(info.video.codec)) record(`V3 编码/${name}`, "FAIL", `${codec} —— 桌面 Firefox 不可播，必须转 H.264`);
  else record(`V3 编码/${name}`, "WARN", `${codec} 非预期编码`);

  const { width, height } = info.video;
  if (width === w && height === h) record(`V4 分辨率/${name}`, "PASS", `${width}×${height}`);
  else record(`V4 分辨率/${name}`, "FAIL", `期望 ${w}×${h}，实际 ${width}×${height}`);

  if (info.hasAudio) record(`V5 音轨/${name}`, "FAIL", "含音频轨（规范要求无音轨）");
  else record(`V5 音轨/${name}`, "PASS", "无音轨");

  const size = buf.length;
  if (size <= MAX_BYTES[name]) record(`V6 体积/${name}`, "PASS", `${kb(size)} ≤ ${kb(MAX_BYTES[name])}`);
  else record(`V6 体积/${name}`, "FAIL", `${kb(size)} 超过上限 ${kb(MAX_BYTES[name])}`);

  if (info.moovBeforeMdat) record(`V7 faststart/${name}`, "PASS", "moov 在 mdat 之前（可边下边播）");
  else record(`V7 faststart/${name}`, "WARN", "moov 在 mdat 之后，首帧会等待");
}

// V8 前端引用的 source 必须真实存在（防止 404 / 假承诺）
const videoTsx = join(ROOT, "components", "landing", "HeroVideo.tsx");
if (existsSync(videoTsx)) {
  const src = readFileSync(videoTsx, "utf8");
  const refs = [...src.matchAll(/<source\s+src="(\/hero\/[^"?]+)"/g)].map((m) => m[1]);
  const missing = refs.filter((r) => !existsSync(join(ROOT, "public", r.replace(/^\//, ""))));
  if (missing.length) record("V8 引用一致性", "FAIL", `代码引用了不存在的文件：${missing.join(", ")}`);
  else record("V8 引用一致性", "PASS", `HeroVideo.tsx 的 ${refs.length} 个 source 均存在`);
}

// V9 9:16 缺档：不 FAIL，但必须确认有图片兜底
if (!existsSync(join(HERO, "hero-9x16.mp4"))) {
  if (existsSync(join(HERO, "mobile-cover.jpg"))) record("V9 移动端兜底", "WARN", "无 hero-9x16.mp4，移动端由 mobile-cover.jpg + 720p 视频兜底");
  else record("V9 移动端兜底", "FAIL", "既无 9:16 视频也无移动封面");
}

// ---------- 输出 ----------
const fails = results.filter((r) => r.level === "FAIL");
const warns = results.filter((r) => r.level === "WARN");
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: fails.length === 0, fails: fails.length, warns: warns.length, results }, null, 2));
} else {
  for (const r of results) {
    const tag = r.level === "PASS" ? "✓" : r.level === "WARN" ? "!" : "✗";
    console.log(`${tag} [${r.level}] ${r.id}: ${r.msg}`);
  }
  console.log(`\n${fails.length === 0 ? "PASS" : "FAIL"} — ${fails.length} fail, ${warns.length} warn`);
}
process.exit(fails.length === 0 ? 0 : 1);
