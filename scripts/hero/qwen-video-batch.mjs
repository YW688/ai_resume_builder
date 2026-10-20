#!/usr/bin/env node
/**
 * Hero 视觉 · 万相 2.7 视频批量生成（Node 24 ESM，零依赖，DashScope 异步任务 API）
 *
 * 读取 docs/hero-visual/assets.json（v2），逐资产：
 *   1) POST {BASE}/api/v1/services/aigc/video-generation/video-synthesis（Header: X-DashScope-Async: enable）
 *   2) 每 15 s GET {BASE}/api/v1/tasks/{task_id} 轮询，最长 20 min（--timeout 可改）
 *   3) SUCCEEDED 后立即下载 output.video_url 到母版 .mp4（URL 仅 24 h 有效），并写同名 .txt。
 *   - 默认 --dry-run：只打印将发送的字段，不联网、不写盘；
 *   - 首帧/尾帧（本地相对路径）由脚本转成 data:<mime>;base64,... 的 data URL。
 *
 * 可从任意 cwd 运行：脚本从自身位置 / 当前目录向上自动定位项目根（含 docs/hero-visual）。
 *
 * 退出码：
 *   0  成功 / 全部跳过 / dry-run 通过
 *   1  结构或执行错误（清单缺失或 JSON 非法、prompt/firstFrame/master 字段缺失、轮询/下载外的参数错误）
 *   2  环境问题（缺少 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL 非法）
 *   3  API 错误（创建/查询非 2xx、任务 FAILED/CANCELED、轮询超时、视频下载失败）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com';
const VIDEO_CREATE_SUFFIX = '/api/v1/services/aigc/video-generation/video-synthesis';
const TASK_SUFFIX = '/api/v1/tasks/';
const EXIT_OK = 0;
const EXIT_STRUCT = 1;
const EXIT_ENV = 2;
const EXIT_API = 3;
const DEFAULT_TIMEOUT_SECONDS = 1200; // 20 min
const CREATE_TIMEOUT_MS = 120000;
const POLL_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 180000;
const POLL_INTERVAL_MS = 15000;
const MAX_SEED = 2147483647;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const MIN_PROMPT_BYTES = 10;
const KNOWN_VIDEO_MODELS = ['wan2.7-i2v', 'wan2.7-t2v'];

const HELP = `Hero 视觉 · 万相 2.7 视频批量生成（qwen-video-batch）

用法：
  node scripts/hero/qwen-video-batch.mjs [选项]

选项：
  --dry-run           只打印将发送的字段（默认行为），不联网、不写盘
  --run               真正创建异步任务、轮询并下载 MP4 到母版路径，同时写同名 .txt
  --only <id[,id]>    只处理指定资产 id（逗号分隔，可重复传 --only）
  --force             允许覆盖已存在的母版（不加则跳过已存在文件）
  --model <模型名>    覆盖 assets.json 里的 model（如 wan2.7-i2v / wan2.7-t2v）
  --timeout <秒>      轮询上限，默认 1200（20 min），允许 60–3600
  --root <目录>       指定项目根（默认自动定位；一般不需要）
  -h, --help          显示本帮助

请求结构（POST {BASE}/api/v1/services/aigc/video-generation/video-synthesis）：
  Header: X-DashScope-Async: enable（必须）、Authorization: Bearer <key>、Content-Type: application/json
  model               wan2.7-i2v（图生视频：首帧/首尾帧）/ wan2.7-t2v（纯文生视频）
  input.prompt        ≤5000 字符，读 assets.json 的 prompt 文件
  input.negative_prompt ≤500 字符，读 negative 文件（可选）
  input.media         i2v 必填数组：{type:"first_frame",url:data:...}，首尾帧时再加 {type:"last_frame",...}
                      （本地文件 ≤20MB，PNG/JPG/BMP/WEBP，无透明通道，宽高 240–8000，比例 1:8~8:1）
  parameters.resolution  720P / 1080P（默认 1080P）
  parameters.duration    整数秒 2–15（本方案 5/6/5；loop 5）
  parameters.prompt_extend  本方案建议 false（清单未给时按 false 发送）
  parameters.watermark   一律 false（规范强制）
  parameters.seed        0–2147483647
  parameters.ratio       t2v 用；本方案只用 16:9

assets.json v2 字段（兼容顶层与 params 嵌套两种写法）：
  id / kind=video / stage / title / prompt / negative / model / resolution / duration /
  promptExtend / seed（或 seeds 数组）/ firstFrame / lastFrame / master / webOutputs / dependsOn
  - master 含 <seed> 时按 seed 替换；seeds 为数组时插入 _s<seed>。
  - firstFrame / lastFrame 为项目内相对路径；首帧必须是精确 16:9（1920x1080 或 1280x720），脚本会 WARN。

注意事项：
  - 旧版 v1 清单（非 wan2.7 资产）会被跳过并给出提示；等 Lead 合并 v2 后再跑。
  - 视频生成通常 1–5 min，任务结果 URL 仅 24 h 有效；脚本立即下载落盘。
  - 只写 assets.json 声明的 master 路径与同名 .txt，不改 public/、不删旧素材、不 git commit。

退出码：0 成功/跳过/dry-run 通过；1 结构或执行错误；2 环境问题（缺 key / Base URL 非法）；
        3 API 错误（非 2xx、任务失败、轮询超时、下载失败）。

示例：
  node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run
  node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run
  node scripts/hero/qwen-video-batch.mjs --run --timeout 1800
`;

class QwenApiError extends Error {}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printHelpAndExit() {
  process.stdout.write(HELP);
  process.exit(EXIT_OK);
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function failUsage(message) {
  fail(`参数错误：${message}\n\n用 --help 查看用法。`, EXIT_STRUCT);
}

function parseArgs(argv) {
  const opts = { run: false, force: false, only: [], model: null, root: null, help: false, timeoutSeconds: DEFAULT_TIMEOUT_SECONDS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--dry-run') {
      opts.run = false;
    } else if (arg === '--run') {
      opts.run = true;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--only') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--only 需要一个资产 id（如 wan-shot-a）');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      if (!value) failUsage('--only= 后面需要资产 id');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
    } else if (arg === '--model') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--model 需要一个模型名（如 wan2.7-i2v）');
      opts.model = value.trim();
      i += 1;
    } else if (arg.startsWith('--model=')) {
      const value = arg.slice('--model='.length).trim();
      if (!value) failUsage('--model= 后面需要模型名');
      opts.model = value;
    } else if (arg === '--timeout') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--timeout 需要一个秒数（默认 1200）');
      opts.timeoutSeconds = parseTimeout(value);
      i += 1;
    } else if (arg.startsWith('--timeout=')) {
      opts.timeoutSeconds = parseTimeout(arg.slice('--timeout='.length));
    } else if (arg === '--root') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--root 需要一个目录参数');
      opts.root = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
      if (!opts.root) failUsage('--root= 后面需要目录');
    } else {
      failUsage(`未知参数 ${arg}`);
    }
  }
  return opts;
}

function parseTimeout(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) failUsage(`--timeout 必须是整数秒（当前 ${JSON.stringify(value)}）`);
  if (number < 60 || number > 3600) failUsage(`--timeout 必须在 60–3600 秒之间（当前 ${number}）`);
  return number;
}

function isDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPosixPath(p) {
  return String(p).replace(/\\/g, '/');
}

function findRepoRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const starts = [scriptDir, process.cwd()];
  const ancestors = [];
  for (const start of starts) {
    let dir = path.resolve(start);
    for (;;) {
      if (!ancestors.includes(dir)) ancestors.push(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  for (const dir of ancestors) {
    if (isDir(path.join(dir, 'docs', 'hero-visual'))) return dir;
  }
  for (const dir of ancestors) {
    if (fs.existsSync(path.join(dir, 'package.json')) && isDir(path.join(dir, 'scripts', 'hero'))) return dir;
  }
  return path.resolve(scriptDir, '..', '..');
}

function resolveBaseUrl() {
  const raw = String(process.env.DASHSCOPE_BASE_URL || '').trim() || DEFAULT_BASE_URL;
  const trimmed = raw.replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    fail(
      `DASHSCOPE_BASE_URL 不是合法 URL：${raw}\n示例：https://dashscope.aliyuncs.com（默认）；业务空间专属域名见 QWEN_SPEC §1.1。`,
      EXIT_ENV,
    );
  }
  return trimmed;
}

function requireApiKey() {
  const key = String(process.env.DASHSCOPE_API_KEY || '').trim();
  if (!key) {
    fail(
      [
        '缺少环境变量 DASHSCOPE_API_KEY（--run 必须）。',
        '设置方法（任选其一）：',
        '  1) 运行 scripts\\hero\\setup-claude.cmd（把 key 写入 .claude/settings.local.json 并实测端点）；',
        "  2) 当前终端设置：PowerShell  $env:DASHSCOPE_API_KEY='sk-...'  / bash  export DASHSCOPE_API_KEY='sk-...'",
        '密钥不会被本脚本打印；dry-run 不需要 key。',
      ].join('\n'),
      EXIT_ENV,
    );
  }
  return key;
}

function loadManifest(root) {
  const docsDir = path.join(root, 'docs', 'hero-visual');
  const manifestPath = path.join(docsDir, 'assets.json');
  const rel = 'docs/hero-visual/assets.json';
  if (!isDir(docsDir)) {
    fail(`未找到文档目录：${toPosixPath(docsDir)}\n确认在项目根运行（含 package.json 与 scripts/hero），或用 --root 指定。`, EXIT_STRUCT);
  }
  if (!fs.existsSync(manifestPath)) {
    fail(
      [
        `未找到资产清单：${rel}`,
        `项目根：${root}`,
        '清单由 Lead 合并 docs/hero-visual/_fragments/*.json 后生成（v2：qwen-00…qwen-kf-*、wan-shot-*）；',
        '生成前无法批量出片。可先运行 node scripts/hero/assets-check.mjs 查看清单状态，或 /hero-status 盘点进度。',
      ].join('\n'),
      EXIT_STRUCT,
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`${rel} 不是合法 JSON：${error.message}\n提示：检查尾随逗号/注释，或让 Lead 重新合并生成。`, EXIT_STRUCT);
  }
  if (!isPlainObject(manifest) || !Array.isArray(manifest.assets)) {
    fail(`${rel} 结构错误：顶层必须是对象且含 assets 数组（先运行 node scripts/hero/assets-check.mjs 查看详情）。`, EXIT_STRUCT);
  }
  return manifest;
}

function resolveInsideRoot(root, relPath, label) {
  const abs = path.resolve(root, relPath);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${label} 不是项目内路径：${relPath}`);
  }
  return abs;
}

function assetFilePath(root, relPath, label) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error(`${label} 路径为空（检查 assets.json 字段）`);
  }
  if (path.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath) || relPath.startsWith('\\\\')) {
    throw new Error(`${label} 必须是项目内相对路径：${relPath}`);
  }
  const candidates = [path.resolve(root, relPath)];
  const normalized = toPosixPath(relPath);
  if (!normalized.startsWith('docs/')) candidates.push(path.resolve(root, 'docs', 'hero-visual', relPath));
  for (const abs of candidates) {
    const rel = path.relative(root, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    if (fs.existsSync(abs)) return { abs, rel: toPosixPath(rel), exists: true };
  }
  const primary = candidates[0];
  const primaryRel = path.relative(root, primary);
  if (!primaryRel || primaryRel.startsWith('..') || path.isAbsolute(primaryRel)) {
    throw new Error(`${label} 必须是项目内相对路径：${relPath}`);
  }
  return { abs: primary, rel: toPosixPath(primaryRel), exists: false };
}

function pick(asset, keys) {
  for (const key of keys) {
    if (asset[key] !== undefined && asset[key] !== null && asset[key] !== '') return asset[key];
  }
  if (isPlainObject(asset.params)) {
    for (const key of keys) {
      if (asset.params[key] !== undefined && asset.params[key] !== null && asset.params[key] !== '') return asset.params[key];
    }
  }
  return undefined;
}

function readPromptFile(root, relPath, label, maxChars) {
  const info = assetFilePath(root, relPath, label);
  if (!info.exists) throw new Error(`${label} 文件不存在：${relPath}`);
  const stat = fs.statSync(info.abs);
  if (!stat.isFile()) throw new Error(`${label} 不是文件：${relPath}`);
  const text = fs.readFileSync(info.abs, 'utf8').replace(/^\uFEFF/, '').trim();
  if (text === '') throw new Error(`${label} 文件为空：${info.rel}`);
  if (Buffer.byteLength(text, 'utf8') < MIN_PROMPT_BYTES) {
    throw new Error(`${label} 内容过短（${Buffer.byteLength(text, 'utf8')} 字节）：${info.rel}`);
  }
  const chars = Array.from(text).length;
  if (maxChars && chars > maxChars) {
    throw new Error(`${label} 超过 API 上限（${chars} 字符 > ${maxChars} 字符）：${info.rel}`);
  }
  return { text, rel: info.rel, bytes: Buffer.byteLength(text, 'utf8'), chars };
}

function asInteger(value, label, assetId, range) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${assetId}：${label} 必须是整数（当前 ${JSON.stringify(value)}）`);
  if (range && (number < range.min || number > range.max)) {
    throw new Error(`${assetId}：${label} 必须在 ${range.min}–${range.max} 之间（当前 ${number}）`);
  }
  return number;
}

function asBoolean(value, label, assetId) {
  if (typeof value === 'boolean') return value;
  throw new Error(`${assetId}：${label} 必须是 true/false（布尔值，当前 ${JSON.stringify(value)}）`);
}

function mimeOfMedia(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.webp') return 'image/webp';
  throw new Error(`首帧/尾帧仅支持 PNG/JPG/BMP/WEBP：${filePath}`);
}

/** 轻量读取 PNG/JPEG/BMP 尺寸（用于首帧 16:9 / 透明通道提示；读不出就返回 null，不影响执行） */
function probeImage(filePath) {
  const info = { format: null, width: null, height: null, hasAlpha: null, bytes: 0 };
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    return info;
  }
  info.bytes = buffer.length;
  if (buffer.length >= 26 && buffer.toString('ascii', 1, 4) === 'PNG') {
    info.format = 'png';
    info.width = buffer.readUInt32BE(16);
    info.height = buffer.readUInt32BE(20);
    const colorType = buffer[25];
    info.hasAlpha = colorType === 4 || colorType === 6;
    return info;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    info.format = 'jpeg';
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        info.height = buffer.readUInt16BE(offset + 5);
        info.width = buffer.readUInt16BE(offset + 7);
        return info;
      }
      if (offset + 4 > buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
    return info;
  }
  if (buffer.length >= 26 && buffer.toString('ascii', 0, 2) === 'BM') {
    info.format = 'bmp';
    info.width = buffer.readInt32LE(18);
    info.height = Math.abs(buffer.readInt32LE(22));
    return info;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    info.format = 'webp';
    return info;
  }
  return info;
}

function seedsOf(asset) {
  const seedsValue = pick(asset, ['seeds']);
  if (Array.isArray(seedsValue) && seedsValue.length > 0) {
    return {
      seeds: seedsValue.map((seed, index) => asInteger(seed, `seeds[${index}]`, asset.id, { min: 0, max: MAX_SEED })),
      random: false,
    };
  }
  const single = pick(asset, ['seed']);
  if (single !== undefined) {
    return { seeds: [asInteger(single, 'seed', asset.id, { min: 0, max: MAX_SEED })], random: false };
  }
  const randomSeed = Math.floor(Math.random() * (MAX_SEED + 1));
  return { seeds: [randomSeed], random: true };
}

function withSeed(masterRel, seed, multiSeed) {
  const text = toPosixPath(masterRel);
  if (text.includes('<seed>')) return text.replace(/<seed>/g, String(seed));
  if (multiSeed) {
    const ext = path.posix.extname(text);
    return `${text.slice(0, text.length - ext.length)}_s${seed}${ext}`;
  }
  return text;
}

function sidecarPathFor(targetRel) {
  const ext = path.posix.extname(targetRel);
  return ext ? `${targetRel.slice(0, targetRel.length - ext.length)}.txt` : `${targetRel}.txt`;
}

function modelOf(asset, opts) {
  if (opts.model) return { model: opts.model, source: '--model 覆盖' };
  const value = pick(asset, ['model']);
  if (value === undefined) {
    throw new Error(`${asset.id}：缺少 model（assets.json 的 model 字段，如 wan2.7-i2v / wan2.7-t2v；也可用 --model 覆盖）`);
  }
  return { model: String(value).trim(), source: 'assets.json' };
}

function isWanVideoAsset(asset, opts) {
  if (!isPlainObject(asset) || asset.kind !== 'video') return false;
  const model = opts.model ? opts.model : pick(asset, ['model']);
  if (typeof model !== 'string') return false;
  const trimmed = model.trim();
  return opts.model ? /^wan/i.test(trimmed) : /^wan2\.7/i.test(trimmed);
}

function resolveFrame(root, relPath, label, run, notes, warnings) {
  const info = assetFilePath(root, relPath, label);
  if (!info.exists) {
    if (run) throw new Error(`${label} 文件不存在：${relPath}（先完成关键帧资产）`);
    warnings.push(`${label} 尚未生成：${relPath}（--run 前必须先落盘）`);
    return { abs: info.abs, rel: info.rel, missing: true, mime: mimeOfMedia(relPath), bytes: 0, probe: null };
  }
  const stat = fs.statSync(info.abs);
  if (!stat.isFile() || stat.size === 0) throw new Error(`${label} 不是有效文件：${info.rel}`);
  const mime = mimeOfMedia(info.abs);
  const probe = probeImage(info.abs);
  if (probe.bytes > MAX_MEDIA_BYTES) {
    warnings.push(`${label} 超过 API 上限 ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB：${info.rel}（${(probe.bytes / 1024 / 1024).toFixed(1)}MB），可能被拒绝`);
  }
  if (probe.format === 'png' && probe.hasAlpha === true) {
    warnings.push(`${label} 是带透明通道的 PNG：${info.rel}（万相要求无透明通道，可能被拒绝）`);
  }
  if (probe.width && probe.height) {
    const ratio = probe.width / probe.height;
    const target = 16 / 9;
    if (Math.abs(ratio - target) / target > 0.01) {
      warnings.push(`${label} 不是精确 16:9：${info.rel}（${probe.width}x${probe.height}）；视频宽高比以首帧为准，关键帧请用 1280x720 / 1920x1080`);
    }
    if (probe.width < 240 || probe.height < 240 || probe.width > 8000 || probe.height > 8000) {
      warnings.push(`${label} 宽高超出 API 范围（240–8000）：${probe.width}x${probe.height}`);
    }
    notes.push(`${label}：${info.rel}（${probe.width}x${probe.height}，${probe.format || '未知格式'}，${probe.bytes} 字节）`);
  } else {
    notes.push(`${label}：${info.rel}（${mime}，${probe.bytes} 字节；尺寸未解析）`);
  }
  return { abs: info.abs, rel: info.rel, missing: false, mime, bytes: probe.bytes, probe };
}

function buildVideoPlan(root, asset, seed, multiSeed, opts) {
  if (typeof asset.prompt !== 'string' || asset.prompt.trim() === '') {
    throw new Error(`${asset.id}：缺少 prompt 字段（assets.json 应指向 docs/hero-visual/prompts/video/*.pos.txt）`);
  }
  const prompt = readPromptFile(root, asset.prompt, `${asset.id} 的 prompt`, 5000);
  const negativeRel = asset.negative;
  let negative = null;
  if (typeof negativeRel === 'string' && negativeRel.trim() !== '') {
    negative = readPromptFile(root, negativeRel, `${asset.id} 的 negative`, 500);
  }
  const { model, source: modelSource } = modelOf(asset, opts);
  if (!/^wan/i.test(model)) {
    throw new Error(`${asset.id}：model=${model} 不是万相视频模型（应为 wan2.7-i2v / wan2.7-t2v）`);
  }
  const notes = [];
  const warnings = [];
  if (!KNOWN_VIDEO_MODELS.includes(model)) {
    warnings.push(`model=${model} 不在规范清单（${KNOWN_VIDEO_MODELS.join(' / ')}）内；确认拼写是否正确`);
  }
  if (modelSource === '--model 覆盖') notes.push(`model 由 --model 覆盖为 ${model}`);
  const isT2V = /t2v/i.test(model);

  let resolutionValue = pick(asset, ['resolution']);
  let resolution;
  if (resolutionValue === undefined) {
    resolution = '1080P';
    notes.push('清单未给 resolution，按 API 默认 1080P 发送');
  } else {
    resolution = String(resolutionValue).trim().toUpperCase();
    if (resolution !== '720P' && resolution !== '1080P') {
      throw new Error(`${asset.id}：resolution 只能是 720P 或 1080P（当前 ${JSON.stringify(resolutionValue)}）`);
    }
  }
  const durationValue = pick(asset, ['duration']);
  if (durationValue === undefined) {
    throw new Error(`${asset.id}：缺少 duration（整数秒 2–15，本方案 Shot A/B/C = 5/6/5，loop = 5）`);
  }
  const duration = asInteger(durationValue, 'duration', asset.id, { min: 2, max: 15 });

  let promptExtendValue = pick(asset, ['promptExtend', 'prompt_extend']);
  let promptExtend;
  if (promptExtendValue === undefined) {
    promptExtend = false;
    notes.push('清单未指定 promptExtend，按本方案建议 false 发送（提示词已足够长，需精确控制镜头）');
  } else {
    promptExtend = asBoolean(promptExtendValue, 'promptExtend', asset.id);
  }
  const watermarkValue = pick(asset, ['watermark']);
  if (watermarkValue === true) notes.push('assets.json 的 watermark=true 已按规范强制改为 false（不得出现水印）');

  const media = [];
  if (isT2V) {
    const ratioValue = pick(asset, ['ratio']);
    const ratio = ratioValue === undefined ? '16:9' : String(ratioValue).trim();
    if (ratio !== '16:9') warnings.push(`本方案 t2v 只用 16:9，当前 ratio=${ratio}`);
    notes.push(`t2v：纯文生视频，ratio=${ratio}`);
  } else {
    const firstFrameValue = pick(asset, ['firstFrame', 'first_frame']) ?? (Array.isArray(asset.inputs) ? asset.inputs[0] : undefined);
    if (firstFrameValue === undefined) {
      throw new Error(`${asset.id}：i2v 缺少 firstFrame（首帧本地路径，如 design/source/qwen/010-keyframe-a_s20261110.png）`);
    }
    if (pick(asset, ['firstFrame', 'first_frame']) === undefined) notes.push('清单未给 firstFrame，已退回 inputs[0]');
    const firstFrame = resolveFrame(root, firstFrameValue, `${asset.id} 的 firstFrame`, opts.run, notes, warnings);
    media.push({ type: 'first_frame', frame: firstFrame });
    const lastFrameValue = pick(asset, ['lastFrame', 'last_frame']);
    if (lastFrameValue !== undefined && lastFrameValue !== null) {
      const lastFrame = resolveFrame(root, lastFrameValue, `${asset.id} 的 lastFrame`, opts.run, notes, warnings);
      media.push({ type: 'last_frame', frame: lastFrame });
    }
  }

  const parameters = {
    resolution,
    duration,
    prompt_extend: promptExtend,
    watermark: false,
    seed,
  };
  if (isT2V) parameters.ratio = pick(asset, ['ratio']) === undefined ? '16:9' : String(pick(asset, ['ratio'])).trim();

  if (!asset.master) throw new Error(`${asset.id}：缺少 master（母版落盘路径，如 design/source/wan/shot-a_1080p_5s_s<seed>.mp4）`);
  const targetRel = withSeed(asset.master, seed, multiSeed);
  const targetAbs = resolveInsideRoot(root, targetRel, `${asset.id} 的 master`);
  const sidecarRel = sidecarPathFor(targetRel);
  const sidecarAbs = resolveInsideRoot(root, sidecarRel, `${asset.id} 的参数 txt`);
  const exists = fs.existsSync(targetAbs) && fs.statSync(targetAbs).isFile();
  if (exists && !opts.force) notes.push('母版已存在：跳过（加 --force 覆盖）');

  return {
    asset,
    seed,
    multiSeed,
    isT2V,
    targetRel: toPosixPath(targetRel),
    targetAbs,
    sidecarRel: toPosixPath(sidecarRel),
    sidecarAbs,
    promptRel: prompt.rel,
    negativeRel: negative ? negative.rel : null,
    promptText: prompt.text,
    negativeText: negative ? negative.text : null,
    media,
    parameters,
    resolution,
    duration,
    model,
    promptExtend,
    notes,
    warnings,
    skip: exists && !opts.force,
  };
}

function formatPreview(text, limit = 120) {
  const singleLine = String(text).replace(/\s+/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit)}…` : singleLine;
}

function mediaSummary(plan) {
  if (plan.media.length === 0) return '无（t2v）';
  return plan.media
    .map((item) => `${item.type}=${item.frame.rel}（${item.frame.missing ? '待生成' : `${item.frame.bytes} 字节 → data URL`}）`)
    .join('；');
}

function printPlan(plan, index, total, baseUrl) {
  const { asset, parameters } = plan;
  const lines = [];
  lines.push(`── [${index}/${total}] ${asset.id} · ${asset.title || '(未命名)'}（${asset.stage || '?'} / video）${plan.skip ? ' [SKIP 已存在]' : ''}`);
  lines.push(`   模型：${plan.model}   resolution=${plan.resolution}   duration=${plan.duration}s   seed=${plan.seed}${plan.multiSeed ? '（多 seed 资产）' : ''}`);
  lines.push(`   prompt：${plan.promptRel}（${Array.from(plan.promptText).length} 字符 / ${Buffer.byteLength(plan.promptText, 'utf8')} 字节，API 上限 5000 字符）`);
  lines.push(`   负向：${plan.negativeRel ? `${plan.negativeRel}（${Array.from(plan.negativeText || '').length} 字符 / ${Buffer.byteLength(plan.negativeText || '', 'utf8')} 字节，API 上限 500 字符）` : '无'}`);
  lines.push(`   首/尾帧：${mediaSummary(plan)}`);
  lines.push(`   母版：${plan.targetRel}`);
  lines.push(`   参数 txt：${plan.sidecarRel}`);
  lines.push(`   创建请求：POST ${baseUrl}${VIDEO_CREATE_SUFFIX}`);
  lines.push(`     Header：X-DashScope-Async: enable / Authorization: Bearer <key> / Content-Type: application/json`);
  lines.push(`     body.model=${JSON.stringify(plan.model)}`);
  lines.push(`     body.input.prompt=${JSON.stringify(formatPreview(plan.promptText))}`);
  lines.push(`     body.input.negative_prompt=${plan.negativeText === null ? '(省略)' : JSON.stringify(formatPreview(plan.negativeText))}`);
  lines.push(
    `     body.input.media=${plan.media.length === 0 ? '(省略)' : `[${plan.media.map((item) => `{type:${JSON.stringify(item.type)},url:${item.frame.missing ? '<待生成>' : '<data URL>'}}`).join(', ')}]`}`,
  );
  lines.push(`     body.parameters=${JSON.stringify(parameters)}`);
  lines.push(`   轮询：GET ${baseUrl}${TASK_SUFFIX}{task_id}（每 15s 一次，最长 ${Math.round(plan.timeoutSeconds || 0)}s）`);
  for (const note of plan.notes) lines.push(`   · ${note}`);
  for (const warning of plan.warnings) lines.push(`   ! ${warning}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function formatApiErrorBody(text) {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (isPlainObject(parsed.error)) {
      const code = parsed.error.code ? ` code=${parsed.error.code}` : '';
      const message = parsed.error.message ? ` message=${parsed.error.message}` : '';
      return `${code}${message}`;
    }
    if (parsed.message) return ` message=${parsed.message}`;
  } catch {
    // 非 JSON，截断原文
  }
  const detail = text.replace(/\s+/g, ' ').trim();
  return detail ? ` body=${detail.length > 400 ? `${detail.slice(0, 400)}…` : detail}` : '';
}

async function createVideoTask(baseUrl, apiKey, plan) {
  const payload = {
    model: plan.model,
    input: {
      prompt: plan.promptText,
    },
    parameters: plan.parameters,
  };
  if (plan.negativeText !== null) payload.input.negative_prompt = plan.negativeText;
  if (plan.media.length > 0) {
    payload.input.media = plan.media.map((item) => ({
      type: item.type,
      url: `data:${item.frame.mime};base64,${fs.readFileSync(item.frame.abs).toString('base64')}`,
    }));
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${VIDEO_CREATE_SUFFIX}`, {
      method: 'POST',
      headers: {
        'X-DashScope-Async': 'enable',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new QwenApiError(`创建万相任务失败：${error.message}（检查网络/代理/DASHSCOPE_BASE_URL）`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new QwenApiError(`创建万相任务返回 HTTP ${response.status}${formatApiErrorBody(text)}`);
  }
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new QwenApiError(`创建任务响应不是合法 JSON：${error.message}`);
  }
  const output = isPlainObject(result.output) ? result.output : {};
  const taskId = output.task_id || result.task_id;
  if (typeof taskId !== 'string' || taskId.trim() === '') {
    throw new QwenApiError('创建任务响应中没有 output.task_id（检查 X-DashScope-Async: enable 是否被正确处理）');
  }
  return {
    taskId: taskId.trim(),
    requestId: result.request_id || null,
    createdAt: result.created || null,
  };
}

async function fetchTask(baseUrl, apiKey, taskId) {
  let response;
  try {
    response = await fetch(`${baseUrl}${TASK_SUFFIX}${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
  } catch (error) {
    return { transient: true, message: `网络异常：${error.message}` };
  }
  const text = await response.text();
  if (!response.ok) {
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      return { transient: true, message: `HTTP ${response.status}${formatApiErrorBody(text)}` };
    }
    throw new QwenApiError(`查询任务状态返回 HTTP ${response.status}${formatApiErrorBody(text)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { transient: true, message: `响应不是合法 JSON：${error.message}` };
  }
  const output = isPlainObject(data.output) ? data.output : {};
  const status = String(output.task_status || data.task_status || '').toUpperCase();
  return { transient: false, status, data, output };
}

async function pollVideoTask(baseUrl, apiKey, taskId, timeoutMs) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let transient = 0;
  let lastPrintedStatus = null;
  let lastPrintedAt = 0;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_INTERVAL_MS, remaining));
    const result = await fetchTask(baseUrl, apiKey, taskId);
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (result.transient) {
      transient += 1;
      process.stdout.write(`   轮询 ${elapsed}s：暂时失败（${transient}/3）${result.message}\n`);
      if (transient >= 3) {
        throw new QwenApiError(`轮询任务状态连续失败 ${transient} 次：${result.message}`);
      }
      continue;
    }
    transient = 0;
    const status = result.status || '(无 task_status)';
    if (status !== lastPrintedStatus || Date.now() - lastPrintedAt >= 60000) {
      process.stdout.write(`   轮询 ${elapsed}s：${status}\n`);
      lastPrintedStatus = status;
      lastPrintedAt = Date.now();
    }
    if (status === 'SUCCEEDED') {
      const output = result.output;
      let videoUrl = output.video_url;
      if (!videoUrl && Array.isArray(output.results) && output.results[0] && output.results[0].video_url) {
        videoUrl = output.results[0].video_url;
      }
      if (typeof videoUrl !== 'string' || videoUrl.trim() === '') {
        throw new QwenApiError('任务成功但响应中没有 output.video_url');
      }
      return {
        videoUrl: videoUrl.trim(),
        taskId,
        requestId: result.data.request_id || output.request_id || null,
        usage: result.data.usage === undefined ? null : result.data.usage,
      };
    }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const code = result.data.code || output.code || '(无 code)';
      const message = result.data.message || output.message || '(无 message)';
      throw new QwenApiError(`任务 ${status}：code=${code} message=${message}`);
    }
  }
  throw new QwenApiError(`轮询超时（${Math.round(timeoutMs / 1000)}s）：任务 ${taskId} 仍未完成；可到百炼控制台查看，或稍后重跑`);
}

async function downloadVideo(videoUrl, targetAbs) {
  let response;
  try {
    response = await fetch(videoUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw new QwenApiError(`下载视频失败（网络异常）：${error.message}`);
  }
  if (!response.ok) {
    throw new QwenApiError(`下载视频失败：HTTP ${response.status}（结果 URL 仅 24h 有效，可能已过期）`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new QwenApiError('下载到的视频为空（0 字节）');
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, buffer);
  return buffer.length;
}

async function generateOne(baseUrl, apiKey, plan, timeoutMs) {
  process.stdout.write(`   创建任务…（${plan.model} ${plan.resolution} ${plan.duration}s prompt_extend=${plan.promptExtend}）\n`);
  const created = await createVideoTask(baseUrl, apiKey, plan);
  process.stdout.write(`   task_id=${created.taskId}（创建成功，开始轮询，最长 ${Math.round(timeoutMs / 1000)}s）\n`);
  const finished = await pollVideoTask(baseUrl, apiKey, created.taskId, timeoutMs);
  const bytes = await downloadVideo(finished.videoUrl, plan.targetAbs);
  return {
    taskId: created.taskId,
    requestId: finished.requestId || created.requestId,
    usage: finished.usage,
    videoUrl: finished.videoUrl,
    bytes,
  };
}

function writeSidecar(plan, response, baseUrl, timeoutMs) {
  const parametersForFile = { ...plan.parameters };
  const lines = [
    '# Hero 资产参数记录（scripts/hero/qwen-video-batch.mjs 自动生成）',
    `# asset: ${plan.asset.id}`,
    `# title: ${plan.asset.title || ''}`,
    `# stage: ${plan.asset.stage || ''}`,
    `# generated_at: ${new Date().toISOString()}`,
    `# create_endpoint: POST ${baseUrl}${VIDEO_CREATE_SUFFIX}`,
    `# poll_endpoint: GET ${baseUrl}${TASK_SUFFIX}{task_id}（15s 间隔，上限 ${Math.round(timeoutMs / 1000)}s）`,
    `# model: ${plan.model}`,
    `# resolution: ${plan.resolution}`,
    `# duration: ${plan.duration}（整数秒）`,
    `# prompt_extend: ${plan.promptExtend}`,
    `# watermark: false`,
    `# seed: ${plan.seed}`,
    `# prompt_file: ${plan.promptRel}`,
    `# negative_file: ${plan.negativeRel || '(无)'}`,
    `# media: ${plan.media.length === 0 ? '(无，t2v)' : plan.media.map((item) => `${item.type}=${item.frame.rel}`).join(', ')}`,
    `# task_id: ${response.taskId || '(未返回)'}`,
    `# request_id: ${response.requestId || '(未返回)'}`,
    `# usage: ${response.usage === null ? '(响应未返回 usage)' : JSON.stringify(response.usage)}`,
    `# output: ${plan.targetRel}（${response.bytes} 字节）`,
    '# note: output.video_url 仅 24h 有效，已立即下载落盘；生成有概率性，同 seed 不保证像素级复现。',
    `# result_video_url: ${response.videoUrl || '(未记录)'}`,
    '',
    'POSITIVE:',
    plan.promptText,
    '',
    'NEGATIVE:',
    plan.negativeText || '(无)',
    '',
    'MEDIA:',
    plan.media.length === 0 ? '(无，t2v)' : plan.media.map((item) => `${item.type}: ${item.frame.rel}`).join('\n'),
    '',
    'PARAMETERS:',
    JSON.stringify(parametersForFile, null, 2),
    '',
  ];
  fs.writeFileSync(plan.sidecarAbs, lines.join('\n'), 'utf8');
}

function printSkippedSummary(skipped) {
  if (skipped.length === 0) return;
  const detail = skipped
    .slice(0, 10)
    .map((item) => `${item.id}(model=${item.model || '?'})`)
    .join('、');
  const more = skipped.length > 10 ? ` 等 ${skipped.length} 个` : '';
  process.stdout.write(`跳过非 wan2.7 视频资产：${detail}${more}\n`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) printHelpAndExit();

  const root = findRepoRoot(opts.root);
  const baseUrl = resolveBaseUrl();
  const apiKey = opts.run ? requireApiKey() : null;
  const manifest = loadManifest(root);
  const allAssets = manifest.assets.filter((asset) => isPlainObject(asset));

  // ---------- 选中范围 ----------
  let selected;
  let skipped = [];
  if (opts.only.length > 0) {
    selected = [];
    const seen = new Set();
    for (const id of opts.only) {
      if (seen.has(id)) continue;
      seen.add(id);
      const asset = allAssets.find((item) => item.id === id);
      if (!asset) {
        const available = allAssets.map((item) => `${item.id}(${item.kind})`).join('、');
        fail(`未知资产 id：${id}\n可用资产：${available || '(清单为空)'}`, EXIT_STRUCT);
      }
      if (asset.kind !== 'video') {
        fail(`资产 ${id} 是 ${asset.kind}，qwen-video-batch 只处理 video；图像请用 qwen-image-batch.mjs。`, EXIT_STRUCT);
      }
      if (!isWanVideoAsset(asset, opts)) {
        const model = pick(asset, ['model']) || '(未声明)';
        fail(
          `资产 ${id} 不是 wan2.7 视频资产（model=${model}）。\n` +
            '若 assets.json 仍是旧版 v1，请等 Lead 合并 v2；确需用 --model 覆盖时请显式传入 --model wan2.7-i2v。',
          EXIT_STRUCT,
        );
      }
      selected.push(asset);
    }
  } else {
    const videoAssets = allAssets.filter((asset) => asset.kind === 'video');
    selected = videoAssets.filter((asset) => isWanVideoAsset(asset, opts));
    skipped = videoAssets
      .filter((asset) => !isWanVideoAsset(asset, opts))
      .map((asset) => ({ id: asset.id, model: pick(asset, ['model']) }));
  }

  if (selected.length === 0) {
    fail(
      [
        '清单中没有可批量生成的万相 2.7 视频资产（model 以 wan2.7 开头）。',
        '可能原因：',
        '  - docs/hero-visual/assets.json 仍是旧版 v1（非 wan2.7 视频资产），等 Lead 合并 v2（wan-shot-a/b/c、wan-loop）；',
        '  - v2 已合并但视频资产 model 字段拼写有误（应为 wan2.7-i2v / wan2.7-t2v）。',
        '可先运行 node scripts/hero/assets-check.mjs 检查清单结构。',
      ].join('\n'),
      EXIT_STRUCT,
    );
  }

  const timeoutMs = opts.timeoutSeconds * 1000;
  process.stdout.write('Hero 视觉 · 万相 2.7 视频批量生成\n');
  process.stdout.write(`仓库根：${root}\n`);
  process.stdout.write(
    `清单：docs/hero-visual/assets.json（version ${JSON.stringify(manifest.version === undefined ? '?' : manifest.version)}；${allAssets.length} 个资产；选中 ${selected.length} 个 wan2.7 视频资产）\n`,
  );
  process.stdout.write(`模式：${opts.run ? 'RUN（真正创建异步任务并轮询）' : 'DRY-RUN（只打印请求，不联网、不写盘）'}${opts.force ? ' + FORCE（允许覆盖）' : ''}\n`);
  process.stdout.write(`Base URL：${baseUrl}\n`);
  process.stdout.write(`轮询：每 15s 一次，单资产最长 ${opts.timeoutSeconds}s\n`);
  printSkippedSummary(skipped);
  process.stdout.write('');

  // ---------- 组装计划 ----------
  const plans = [];
  const planErrors = new Set();
  for (const asset of selected) {
    let seedInfo;
    try {
      seedInfo = seedsOf(asset);
    } catch (error) {
      planErrors.add(error.message);
      continue;
    }
    const multiSeed = seedInfo.seeds.length > 1;
    for (const seed of seedInfo.seeds) {
      try {
        const plan = buildVideoPlan(root, asset, seed, multiSeed, opts);
        plan.timeoutSeconds = opts.timeoutSeconds;
        if (seedInfo.random) plan.warnings.push(`清单未给 seed，已随机 seed=${seed}（会写入同名 .txt；要复现请在 assets.json 固定 seed）`);
        plans.push(plan);
      } catch (error) {
        planErrors.add(error.message);
      }
    }
  }

  if (planErrors.size > 0) {
    process.stderr.write('以下资产未生成（参数/文件校验失败，不提交请求）：\n');
    for (const error of planErrors) process.stderr.write(`  [ERROR] ${error}\n`);
    process.stderr.write('提示：先运行 node scripts/hero/assets-check.mjs 检查清单，或让 Lead 修正 assets.json。\n');
  }
  if (plans.length === 0) {
    fail('没有可执行的资产计划：先修复上面的 [ERROR]，再重跑本脚本。', EXIT_STRUCT);
  }

  const pending = plans.filter((plan) => !plan.skip);

  if (!opts.run) {
    for (let index = 0; index < plans.length; index += 1) printPlan(plans[index], index + 1, plans.length, baseUrl);
    process.stdout.write('');
    process.stdout.write(`DRY-RUN 完成：${plans.length} 个请求已打印，其中 ${plans.length - pending.length} 个母版已存在会被跳过。\n`);
    if (planErrors.size > 0) {
      process.stdout.write(`另有 ${planErrors.size} 个资产因参数/文件校验未生成（见上方 [ERROR]）。\n`);
      process.exit(EXIT_STRUCT);
    }
    if (pending.length === 0) {
      process.stdout.write('所有目标母版都已存在，无需生成（加 --force 可覆盖）。\n');
      process.exit(EXIT_OK);
    }
    process.stdout.write('确认字段无误后加 --run 真正生成（需要 DASHSCOPE_API_KEY；单段通常 1–5min）。\n');
    process.exit(EXIT_OK);
  }

  if (pending.length === 0) {
    process.stdout.write('所有目标母版都已存在，无需生成（加 --force 可覆盖）。\n');
    process.exit(planErrors.size > 0 ? EXIT_STRUCT : EXIT_OK);
  }

  process.stdout.write('开始生成（异步任务，逐段提交 + 轮询；最长 20min/段）…\n\n');
  let success = 0;
  let skipCount = 0;
  let apiFailed = 0;
  let structFailed = 0;

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    const label = `── [${index + 1}/${plans.length}] ${plan.asset.id} seed=${plan.seed}`;
    if (plan.skip) {
      process.stdout.write(`${label} 跳过（${plan.targetRel} 已存在，加 --force 覆盖）\n`);
      skipCount += 1;
      continue;
    }
    process.stdout.write(`${label} 生成中…\n`);
    const startedAt = Date.now();
    try {
      const response = await generateOne(baseUrl, apiKey, plan, timeoutMs);
      writeSidecar(plan, response, baseUrl, timeoutMs);
      success += 1;
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      process.stdout.write(`   PASS：${plan.targetRel}（${response.bytes} 字节，${seconds}s）\n`);
      process.stdout.write(`   参数：${plan.sidecarRel}\n`);
    } catch (error) {
      if (error instanceof QwenApiError) {
        apiFailed += 1;
        process.stdout.write(`   FAIL（API）：${error.message}\n`);
      } else {
        structFailed += 1;
        process.stdout.write(`   FAIL（参数/文件）：${error.message}\n`);
      }
    }
  }

  process.stdout.write('');
  process.stdout.write(`完成：成功 ${success} / 跳过 ${skipCount} / API 失败 ${apiFailed} / 参数或文件失败 ${structFailed}`);
  if (planErrors.size > 0) process.stdout.write(`（另有 ${planErrors.size} 个资产未提交）`);
  process.stdout.write('\n');

  if (apiFailed > 0) {
    process.stdout.write('有 API 失败：确认 key/地域/Base URL、模型是否已开通、首帧是否合规；修好后重跑（已成功的不会覆盖，除非 --force）。\n');
    process.exit(EXIT_API);
  }
  if (structFailed > 0 || planErrors.size > 0) {
    process.stdout.write('有参数/文件失败：按上面的 [ERROR] 修正 assets.json 或补齐首帧/尾帧后重跑。\n');
    process.exit(EXIT_STRUCT);
  }
  process.stdout.write('下一步：node scripts/hero/qwen-video-batch.mjs --dry-run 复核；或 /hero-next 查看下一个待办。\n');
  process.exit(EXIT_OK);
}

main().catch((error) => {
  process.stderr.write(`未处理的错误：${error && error.stack ? error.stack : error}\n`);
  process.exit(EXIT_STRUCT);
});
