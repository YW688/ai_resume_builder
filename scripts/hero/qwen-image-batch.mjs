#!/usr/bin/env node
/**
 * Hero 视觉 · Qwen-Image 批量生成（Node 24 ESM，零依赖，DashScope 原生异步图像任务 API）
 *
 * 读取 docs/hero-visual/assets.json（v2），逐资产：
 *   1) POST {BASE}/api/v1/services/aigc/image-generation/generation（Header: X-DashScope-Async: enable）
 *      body = { model, input.messages[0].content[ {image:data URL}…, {text:prompt} ], parameters:{size,n,...} }
 *   2) 每 15 s GET {BASE}/api/v1/tasks/{task_id} 轮询，单资产最长 20 min（--timeout 可调）
 *   3) SUCCEEDED 后取 output.choices[].message.content[] 中 type=="image" 的 image URL，立即下载 PNG 到 master
 *      （结果 URL 仅 24 h 有效），并写同名 .txt（prompt/negative/refs/model/size/seed/parameters/task_id/usage）。
 *   - 默认 --dry-run：只打印创建请求体，不联网、不写盘；
 *   - refs（本地相对路径）转 data:<mime>;base64,... 放在 text 之前；3.0 系最多 3 张。
 *   - size 按 DashScope 原生协议用 `*` 分隔（assets.json 写 "1920x1080" 也可，脚本自动转换）。
 *
 * 可从任意 cwd 运行：脚本从自身位置 / 当前目录向上自动定位项目根（含 docs/hero-visual）。
 *
 * 退出码：
 *   0  成功 / 全部跳过 / dry-run 通过（允许「参考图待生成」这类 WARN）
 *   1  结构或执行错误（清单缺失或 JSON 非法、prompt/refs/master 字段缺失、--run 时参考图缺文件等）
 *   2  环境问题（缺少 DASHSCOPE_API_KEY、DASHSCOPE_BASE_URL 非法）
 *   3  API 错误（创建/查询非 2xx、任务 FAILED/CANCELED、轮询超时、图片下载失败）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com';
const IMAGE_CREATE_SUFFIX = '/api/v1/services/aigc/image-generation/generation';
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
const MIN_PROMPT_BYTES = 10;
const MAX_SEED = 2147483647;
const KNOWN_IMAGE_MODELS = ['qwen-image-3.0-pro', 'qwen-image-3.0', 'qwen-image-2.1-pro'];

const HELP = `Hero 视觉 · Qwen-Image 批量生成（qwen-image-batch · DashScope 原生异步）

用法：
  node scripts/hero/qwen-image-batch.mjs [选项]

选项：
  --dry-run           只打印创建请求体（默认行为），不联网、不写盘
  --run               真正创建异步任务、轮询并下载 PNG 到母版路径，同时写同名 .txt
  --only <id[,id]>    只处理指定资产 id（逗号分隔，可重复传 --only）
  --force             允许覆盖已存在的母版（不加则跳过已存在文件）
  --model <模型名>    覆盖 assets.json 里的 model（如 qwen-image-3.0，更快更便宜）
  --timeout <秒>      轮询上限，默认 1200（20 min），允许 60–3600
  --root <目录>       指定项目根（默认自动定位；一般不需要）
  -h, --help          显示本帮助

请求（POST {BASE}/api/v1/services/aigc/image-generation/generation）：
  Header：X-DashScope-Async: enable（必须）、Authorization: Bearer <key>、Content-Type: application/json
  body.model              qwen-image-3.0-pro（首选）/ qwen-image-3.0 / qwen-image-2.1-pro
  body.input.messages[0].content
                          [ {image: "data:image/png;base64,..."}, ... , {text: "<prompt>"} ]
                          参考图放在 text 之前（3.0 系最多 3 张；无 refs 时只放 text）
  body.parameters.size    "宽*高"（DashScope 原生协议用 *，如 "1920*1080"；总像素 512²~2048²，
                          比例 1:8~8:1；assets.json 写 "1920x1080" 脚本会自动转成 *）
  body.parameters.n       1–6（默认 1；assets.json 的 n）
  body.parameters.negative_prompt  仅 3.0 系支持；2.1-pro 自动忽略
  body.parameters.seed    0–2147483647
  body.parameters.prompt_extend    true/false；清单未给时按 API 默认 true 发送
  body.parameters.watermark        一律 false（规范强制）
  enable_thinking / prompt_extend_mode：原生异步协议未声明，清单若给出会忽略并提示

轮询：GET {BASE}/api/v1/tasks/{task_id}（每 15s 一次，单资产最长 20min）
成功：output.choices[0].message.content[] 中 type=="image" 的 image URL（PNG，24h 有效）→ 立即下载落盘。
失败：task_status=FAILED 打印 output.code/message；HTTP 非 2xx 打印响应体（截断 600 字）。

assets.json v2 字段（兼容顶层与 params 嵌套两种写法）：
  id / kind=image / stage / title / prompt / negative / model / size / n / seed（或 seeds 数组）/
  promptExtend / refs（本地相对路径数组）/ master / webOutputs / dependsOn
  - master 含 <seed> 时按 seed 替换；seeds 为数组（如角色卡 4 seed）时插入 _s<seed>。
  - refs 里的文件在 --run 前必须存在（I2I 参考图）；dry-run 只给 WARN，方便先核对请求。

注意事项：
  - 旧版 v1 清单（非 Qwen 资产）会被跳过并给出提示；等 Lead 合并 v2 后再跑。
  - 结果 URL 仅 24 h 有效，脚本立即下载；下载失败不盲目重试（否则可能产生重复计费）。
  - 只写 assets.json 声明的 master 路径与同名 .txt，不改 public/、不删旧素材、不 git commit。

退出码：0 成功/跳过/dry-run 通过；1 结构或执行错误；2 环境问题（缺 key / Base URL 非法）；
        3 API 错误（创建/查询非 2xx、任务失败、轮询超时、下载失败）。

示例：
  node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run
  node scripts/hero/qwen-image-batch.mjs --only qwen-01 --run
  node scripts/hero/qwen-image-batch.mjs --run --force --model qwen-image-3.0
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
      if (!value || value.startsWith('--')) failUsage('--only 需要一个资产 id（如 qwen-01）');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      if (!value) failUsage('--only= 后面需要资产 id');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
    } else if (arg === '--model') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--model 需要一个模型名（如 qwen-image-3.0-pro）');
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
        '生成前无法批量出图。可先运行 node scripts/hero/assets-check.mjs 查看清单状态，或 /hero-status 盘点进度。',
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

/**
 * 资产内文件路径解析：既接受「项目根相对路径」（docs/hero-visual/prompts/...），
 * 也接受 fragment 里的「docs/hero-visual 相对路径」（prompts/...），返回绝对路径与根相对路径。
 */
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

function readPromptFile(root, relPath, label) {
  const info = assetFilePath(root, relPath, label);
  if (!info.exists) throw new Error(`${label} 文件不存在：${relPath}`);
  const stat = fs.statSync(info.abs);
  if (!stat.isFile()) throw new Error(`${label} 不是文件：${relPath}`);
  const text = fs.readFileSync(info.abs, 'utf8').replace(/^\uFEFF/, '').trim();
  if (text === '') throw new Error(`${label} 文件为空：${info.rel}`);
  if (Buffer.byteLength(text, 'utf8') < MIN_PROMPT_BYTES) {
    throw new Error(`${label} 内容过短（${Buffer.byteLength(text, 'utf8')} 字节，至少 ${MIN_PROMPT_BYTES} 字节）：${info.rel}`);
  }
  return { text, rel: info.rel };
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

function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.bmp') return 'image/bmp';
  if (ext === '.gif') return 'image/gif';
  throw new Error(`不支持的图片格式：${filePath}（支持 PNG/JPG/WEBP/BMP/GIF）`);
}

/**
 * 解析 size：接受 assets.json 的 "1920x1080"（也接受 "1920*1080"），
 * 返回 { width, height, sizeX: "1920x1080", sizeDashScope: "1920*1080" }。
 */
function parseSize(value, assetId) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${assetId}：缺少 size（assets.json 的 size 字段，如 "1920x1080"）`);
  }
  const text = value.trim();
  const match = /^(\d{2,5})\s*[xX*]\s*(\d{2,5})$/.exec(text);
  if (!match) throw new Error(`${assetId}：size 格式错误：${text}（应为 "宽x高" 或 "宽*高"，如 1920x1080）`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  const area = width * height;
  if (area < 512 * 512 || area > 2048 * 2048) {
    throw new Error(`${assetId}：size 超出 API 范围：${text}（总像素需在 512×512 ~ 2048×2048 之间）`);
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 8) throw new Error(`${assetId}：size 比例超限：${text}（宽高比需在 1:8 ~ 8:1 之间）`);
  return { width, height, sizeX: `${width}x${height}`, sizeDashScope: `${width}*${height}` };
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

function numberedPath(relPath, index) {
  if (index <= 1) return relPath;
  const ext = path.posix.extname(relPath);
  return `${relPath.slice(0, relPath.length - ext.length)}-${index}${ext}`;
}

function modelOf(asset, opts) {
  if (opts.model) return { model: opts.model, source: '--model 覆盖' };
  const value = pick(asset, ['model']);
  if (value === undefined) {
    throw new Error(`${asset.id}：缺少 model（assets.json 的 model 字段，如 qwen-image-3.0-pro；也可用 --model 覆盖）`);
  }
  return { model: String(value).trim(), source: 'assets.json' };
}

function isQwenImageAsset(asset, opts) {
  if (!isPlainObject(asset) || asset.kind !== 'image') return false;
  const model = opts.model ? opts.model : pick(asset, ['model']);
  return typeof model === 'string' && /^qwen-image/i.test(model.trim());
}

function buildRefs(root, asset, run) {
  const raw = pick(asset, ['refs', 'referenceImages', 'imageRefs']);
  let list = [];
  if (raw === undefined) {
    list = [];
  } else if (typeof raw === 'string') {
    list = [raw];
  } else if (Array.isArray(raw)) {
    list = raw;
  } else {
    throw new Error(`${asset.id}：refs 必须是本地相对路径数组（如 ["design/source/refs/character_front.png"]）`);
  }
  const refs = [];
  for (let index = 0; index < list.length; index += 1) {
    const rel = list[index];
    const info = assetFilePath(root, rel, `${asset.id} 的 refs[${index}]`);
    if (!info.exists) {
      if (run) {
        throw new Error(`${asset.id}：refs[${index}] 文件不存在：${rel}（I2I 参考图必须先落盘；先完成依赖资产）`);
      }
      refs.push({ abs: info.abs, rel: info.rel, missing: true, mime: mimeOf(rel), bytes: 0 });
      continue;
    }
    const stat = fs.statSync(info.abs);
    if (!stat.isFile() || stat.size === 0) throw new Error(`${asset.id}：refs[${index}] 不是有效文件：${info.rel}`);
    refs.push({ abs: info.abs, rel: info.rel, missing: false, mime: mimeOf(info.abs), bytes: stat.size });
  }
  return refs;
}

function buildImagePlan(root, asset, seed, multiSeed, opts) {
  if (typeof asset.prompt !== 'string' || asset.prompt.trim() === '') {
    throw new Error(`${asset.id}：缺少 prompt 字段（assets.json 应指向 docs/hero-visual/prompts/image/*.pos.txt）`);
  }
  const prompt = readPromptFile(root, asset.prompt, `${asset.id} 的 prompt`);
  const negativeRel = asset.negative;
  let negative = null;
  if (typeof negativeRel === 'string' && negativeRel.trim() !== '') {
    negative = readPromptFile(root, negativeRel, `${asset.id} 的 negative`);
  }
  const { model, source: modelSource } = modelOf(asset, opts);
  if (!/^qwen-image/i.test(model)) {
    throw new Error(
      `${asset.id}：model=${model} 不是 Qwen-Image 模型（应为 qwen-image-3.0-pro / qwen-image-3.0 / qwen-image-2.1-pro）`,
    );
  }
  const notes = [];
  const warnings = [];
  if (!KNOWN_IMAGE_MODELS.includes(model)) {
    warnings.push(`model=${model} 不在规范清单（${KNOWN_IMAGE_MODELS.join(' / ')}）内；确认拼写是否正确`);
  }
  if (modelSource === '--model 覆盖') notes.push(`model 由 --model 覆盖为 ${model}`);
  const is21 = /^qwen-image-2\.1/i.test(model);
  const maxRefs = is21 ? 10 : 3;
  const refs = buildRefs(root, asset, opts.run);
  if (refs.length > maxRefs) {
    throw new Error(`${asset.id}：refs 有 ${refs.length} 张，${is21 ? 'qwen-image-2.1-pro' : '3.0 系'} 最多 ${maxRefs} 张`);
  }
  if (refs.some((ref) => ref.missing)) {
    warnings.push(`参考图尚未生成：${refs.filter((ref) => ref.missing).map((ref) => ref.rel).join('、')}（--run 前必须先落盘）`);
  }

  let sizeValue = pick(asset, ['size']);
  if (sizeValue === undefined) {
    const width = pick(asset, ['width']);
    const height = pick(asset, ['height']);
    if (width !== undefined && height !== undefined) sizeValue = `${width}x${height}`;
  }
  const size = parseSize(sizeValue, asset.id);
  const n = asInteger(pick(asset, ['n']) === undefined ? 1 : pick(asset, ['n']), 'n', asset.id, { min: 1, max: 6 });

  let promptExtendValue = pick(asset, ['promptExtend', 'prompt_extend']);
  let promptExtend;
  if (promptExtendValue === undefined) {
    promptExtend = true;
    notes.push('清单未指定 promptExtend，按 API 默认 true 发送（I2I 要严格听构图时在 assets.json 设 false）');
  } else {
    promptExtend = asBoolean(promptExtendValue, 'promptExtend', asset.id);
  }
  const thinkingValue = pick(asset, ['enableThinking', 'enable_thinking']);
  if (thinkingValue !== undefined) {
    warnings.push('原生异步图像协议未声明 enable_thinking，已忽略该字段（如需请按百炼文档确认后手工调用）');
  }
  const modeValue = pick(asset, ['promptExtendMode', 'prompt_extend_mode']);
  if (modeValue !== undefined) {
    warnings.push('原生异步图像协议未声明 prompt_extend_mode，已忽略该字段（如需请按百炼文档确认后手工调用）');
  }
  const watermarkValue = pick(asset, ['watermark']);
  if (watermarkValue === true) notes.push('assets.json 的 watermark=true 已按规范强制改为 false（不得出现水印）');

  let negativeText = null;
  if (is21 && negative) {
    notes.push('qwen-image-2.1-pro 不支持 negative_prompt，已忽略负向文件');
  } else if (negative) {
    negativeText = negative.text;
  } else {
    warnings.push('未提供 negative 字段/文件，请求不会带 negative_prompt（3.0 系建议补负向）');
  }

  const parameters = {
    size: size.sizeDashScope,
    n,
    seed,
    prompt_extend: promptExtend,
    watermark: false,
  };
  if (negativeText !== null) parameters.negative_prompt = negativeText;

  if (!asset.master) throw new Error(`${asset.id}：缺少 master（母版落盘路径，如 design/source/qwen/002-hero-poster_s<seed>.png）`);
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
    targetRel: toPosixPath(targetRel),
    targetAbs,
    sidecarRel: toPosixPath(sidecarRel),
    sidecarAbs,
    promptRel: prompt.rel,
    negativeRel: negative ? negative.rel : null,
    promptText: prompt.text,
    negativeText,
    refs,
    model,
    size,
    n,
    promptExtend,
    parameters,
    notes,
    warnings,
    skip: exists && !opts.force,
    timeoutSeconds: opts.timeoutSeconds,
  };
}

function formatPreview(text, limit = 120) {
  const singleLine = String(text).replace(/\s+/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit)}…` : singleLine;
}

function refSummary(plan) {
  if (plan.refs.length === 0) return '无（纯文生图）';
  return plan.refs
    .map((ref) => `${ref.rel}（${ref.missing ? '待生成' : `${ref.bytes} 字节 → data URL`}）`)
    .join('；');
}

function printPlan(plan, index, total, baseUrl) {
  const { asset, parameters } = plan;
  const lines = [];
  lines.push(`── [${index}/${total}] ${asset.id} · ${asset.title || '(未命名)'}（${asset.stage || '?'} / image）${plan.skip ? ' [SKIP 已存在]' : ''}`);
  lines.push(`   模型：${plan.model}   size=${plan.size.sizeX}（请求用 ${parameters.size}）   n=${plan.n}   seed=${plan.seed}${plan.multiSeed ? '（多 seed 资产）' : ''}`);
  lines.push(`   prompt：${plan.promptRel}（${Array.from(plan.promptText).length} 字符 / ${Buffer.byteLength(plan.promptText, 'utf8')} 字节）`);
  lines.push(`   负向：${plan.negativeRel ? `${plan.negativeRel}（${Buffer.byteLength(plan.negativeText || '', 'utf8')} 字节）` : '无'}`);
  lines.push(`   参考图：${refSummary(plan)}`);
  lines.push(`   母版：${plan.targetRel}`);
  lines.push(`   参数 txt：${plan.sidecarRel}`);
  lines.push(`   创建请求：POST ${baseUrl}${IMAGE_CREATE_SUFFIX}`);
  lines.push('     Header：X-DashScope-Async: enable / Authorization: Bearer <key> / Content-Type: application/json');
  lines.push(`     body.model=${JSON.stringify(plan.model)}`);
  const imageParts = plan.refs.map((ref) => `{image:${ref.missing ? '<待生成>' : '<data:image/...;base64,...>'}}`);
  lines.push(`     body.input.messages[0].content=[${[...imageParts, '{text:<prompt>}'].join(', ')}]`);
  lines.push(`     body.input.messages[0].content[].text=${JSON.stringify(formatPreview(plan.promptText))}`);
  lines.push(`     body.parameters=${JSON.stringify(parameters)}`);
  lines.push(`   轮询：GET ${baseUrl}${TASK_SUFFIX}{task_id}（每 15s 一次，最长 ${Math.round(plan.timeoutSeconds)}s）`);
  for (const note of plan.notes) lines.push(`   · ${note}`);
  for (const warning of plan.warnings) lines.push(`   ! ${warning}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function formatApiErrorBody(text, limit = 600) {
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
  return detail ? ` body=${detail.length > limit ? `${detail.slice(0, limit)}…` : detail}` : '';
}

function buildRequestBody(plan) {
  const content = [];
  for (const ref of plan.refs) {
    content.push({ image: `data:${ref.mime};base64,${fs.readFileSync(ref.abs).toString('base64')}` });
  }
  content.push({ text: plan.promptText });
  return {
    model: plan.model,
    input: { messages: [{ role: 'user', content }] },
    parameters: plan.parameters,
  };
}

async function createImageTask(baseUrl, apiKey, plan) {
  const body = buildRequestBody(plan);
  let response;
  try {
    response = await fetch(`${baseUrl}${IMAGE_CREATE_SUFFIX}`, {
      method: 'POST',
      headers: {
        'X-DashScope-Async': 'enable',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new QwenApiError(`创建 Qwen-Image 任务失败：${error.message}（检查网络/代理/DASHSCOPE_BASE_URL）`);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new QwenApiError(`创建 Qwen-Image 任务返回 HTTP ${response.status}${formatApiErrorBody(text)}`);
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
  return { taskId: taskId.trim(), requestId: result.request_id || null, createdAt: result.created || null };
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

function extractImageUrls(output) {
  const urls = [];
  const choices = Array.isArray(output.choices) ? output.choices : [];
  for (const choice of choices) {
    const message = choice && isPlainObject(choice.message) ? choice.message : {};
    const content = Array.isArray(message.content) ? message.content : [];
    for (const item of content) {
      if (isPlainObject(item) && item.type === 'image' && typeof item.image === 'string' && item.image.trim() !== '') {
        urls.push(item.image.trim());
      }
    }
  }
  if (urls.length === 0 && typeof output.image_url === 'string' && output.image_url.trim() !== '') {
    urls.push(output.image_url.trim());
  }
  return urls;
}

async function pollImageTask(baseUrl, apiKey, taskId, timeoutMs) {
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
      const urls = extractImageUrls(result.output);
      if (urls.length === 0) {
        throw new QwenApiError('任务成功但响应中没有 output.choices[].message.content[] 里 type=="image" 的 image URL');
      }
      return {
        imageUrls: urls,
        taskId,
        requestId: result.data.request_id || result.output.request_id || null,
        usage: result.data.usage === undefined ? null : result.data.usage,
      };
    }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const code = result.data.code || result.output.code || '(无 code)';
      const message = result.data.message || result.output.message || '(无 message)';
      throw new QwenApiError(`任务 ${status}：code=${code} message=${message}`);
    }
  }
  throw new QwenApiError(`轮询超时（${Math.round(timeoutMs / 1000)}s）：任务 ${taskId} 仍未完成；可到百炼控制台查看，或稍后重跑`);
}

async function downloadImage(imageUrl, targetAbs) {
  let response;
  try {
    response = await fetch(imageUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw new QwenApiError(`下载生成的图片失败（网络异常）：${error.message}`);
  }
  if (!response.ok) {
    throw new QwenApiError(`下载生成的图片失败：HTTP ${response.status}（结果 URL 仅 24h 有效，可能已过期）`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new QwenApiError('下载到的图片为空（0 字节）');
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, buffer);
  return buffer.length;
}

async function generateOne(root, plan, baseUrl, apiKey, timeoutMs) {
  process.stdout.write(`   创建任务…（${plan.model} ${plan.size.sizeX} n=${plan.n} prompt_extend=${plan.promptExtend}）\n`);
  const created = await createImageTask(baseUrl, apiKey, plan);
  process.stdout.write(`   task_id=${created.taskId}（创建成功，开始轮询，最长 ${Math.round(timeoutMs / 1000)}s）\n`);
  const finished = await pollImageTask(baseUrl, apiKey, created.taskId, timeoutMs);
  const outputs = [];
  for (let index = 0; index < finished.imageUrls.length; index += 1) {
    const rel = numberedPath(plan.targetRel, index + 1);
    const abs = resolveInsideRoot(root, rel, `${plan.asset.id} 的第 ${index + 1} 张输出`);
    const bytes = await downloadImage(finished.imageUrls[index], abs);
    outputs.push({ rel, bytes, url: finished.imageUrls[index] });
  }
  return {
    taskId: created.taskId,
    requestId: finished.requestId || created.requestId,
    usage: finished.usage,
    outputs,
  };
}

function writeSidecar(plan, response, baseUrl, timeoutMs) {
  const parametersForFile = { ...plan.parameters };
  const lines = [
    '# Hero 资产参数记录（scripts/hero/qwen-image-batch.mjs 自动生成）',
    `# asset: ${plan.asset.id}`,
    `# title: ${plan.asset.title || ''}`,
    `# stage: ${plan.asset.stage || ''}`,
    `# generated_at: ${new Date().toISOString()}`,
    `# create_endpoint: POST ${baseUrl}${IMAGE_CREATE_SUFFIX}（X-DashScope-Async: enable）`,
    `# poll_endpoint: GET ${baseUrl}${TASK_SUFFIX}{task_id}（15s 间隔，上限 ${Math.round(timeoutMs / 1000)}s）`,
    `# model: ${plan.model}`,
    `# size: ${plan.size.sizeX}（请求 parameters.size=${plan.size.sizeDashScope}）`,
    `# n: ${plan.n}`,
    `# seed: ${plan.seed}`,
    `# prompt_extend: ${plan.promptExtend}`,
    `# watermark: false`,
    `# prompt_file: ${plan.promptRel}`,
    `# negative_file: ${plan.negativeRel || '(无)'}`,
    `# refs: ${plan.refs.length === 0 ? '(无)' : plan.refs.map((ref) => ref.rel).join(', ')}`,
    `# task_id: ${response.taskId || '(未返回)'}`,
    `# request_id: ${response.requestId || '(未返回)'}`,
    `# usage: ${response.usage === null ? '(响应未返回 usage)' : JSON.stringify(response.usage)}`,
    `# outputs: ${response.outputs.map((output) => output.rel).join(', ')}`,
    `# result_image_urls: ${response.outputs.map((output) => output.url).join(', ')}`,
    '# note: 结果 URL 仅 24h 有效，已立即下载落盘；Qwen-Image 生成有概率性，同 seed 不保证像素级复现。',
    '',
    'POSITIVE:',
    plan.promptText,
    '',
    'NEGATIVE:',
    plan.negativeText || '(无)',
    '',
    'REFS:',
    plan.refs.length === 0 ? '(无)' : plan.refs.map((ref) => ref.rel).join('\n'),
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
  process.stdout.write(`跳过非 Qwen 图像资产：${detail}${more}\n`);
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
      if (asset.kind !== 'image') {
        fail(`资产 ${id} 是 ${asset.kind}，qwen-image-batch 只处理 image；视频请用 qwen-video-batch.mjs。`, EXIT_STRUCT);
      }
      if (!isQwenImageAsset(asset, opts)) {
        const model = pick(asset, ['model']) || '(未声明)';
        fail(
          `资产 ${id} 不是 Qwen 图像资产（model=${model}）。\n` +
            '若 assets.json 仍是旧版 v1，请等 Lead 合并 v2；确需用 --model 覆盖时请显式传入 --model qwen-image-3.0-pro。',
          EXIT_STRUCT,
        );
      }
      selected.push(asset);
    }
  } else {
    const imageAssets = allAssets.filter((asset) => asset.kind === 'image');
    selected = imageAssets.filter((asset) => isQwenImageAsset(asset, opts));
    skipped = imageAssets
      .filter((asset) => !isQwenImageAsset(asset, opts))
      .map((asset) => ({ id: asset.id, model: pick(asset, ['model']) }));
  }

  if (selected.length === 0) {
    fail(
      [
        '清单中没有可批量生成的 Qwen 图像资产（model 以 qwen-image 开头）。',
        '可能原因：',
        '  - docs/hero-visual/assets.json 仍是旧版 v1（非 Qwen 资产），等 Lead 合并 v2（qwen-00…qwen-kf-sky）；',
        '  - v2 已合并但图像资产 model 字段拼写有误（应为 qwen-image-3.0-pro）。',
        '可先运行 node scripts/hero/assets-check.mjs 检查清单结构。',
      ].join('\n'),
      EXIT_STRUCT,
    );
  }

  const timeoutMs = opts.timeoutSeconds * 1000;
  process.stdout.write('Hero 视觉 · Qwen-Image 批量生成（DashScope 原生异步）\n');
  process.stdout.write(`仓库根：${root}\n`);
  process.stdout.write(
    `清单：docs/hero-visual/assets.json（version ${JSON.stringify(manifest.version === undefined ? '?' : manifest.version)}；${allAssets.length} 个资产；选中 ${selected.length} 个 Qwen 图像资产）\n`,
  );
  process.stdout.write(`模式：${opts.run ? 'RUN（真正创建异步任务并轮询）' : 'DRY-RUN（只打印请求，不联网、不写盘）'}${opts.force ? ' + FORCE（允许覆盖）' : ''}\n`);
  process.stdout.write(`Base URL：${baseUrl}\n`);
  process.stdout.write(`轮询：每 15s 一次，单资产最长 ${opts.timeoutSeconds}s\n`);
  if (opts.run) process.stdout.write('提示：图像按输出像素档计费，先单张试水再批量。\n');
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
        const plan = buildImagePlan(root, asset, seed, multiSeed, opts);
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
    process.stdout.write('确认字段无误后加 --run 真正生成（需要 DASHSCOPE_API_KEY；异步任务通常 1–5min/张）。\n');
    process.exit(EXIT_OK);
  }

  if (pending.length === 0) {
    process.stdout.write('所有目标母版都已存在，无需生成（加 --force 可覆盖）。\n');
    process.exit(planErrors.size > 0 ? EXIT_STRUCT : EXIT_OK);
  }

  process.stdout.write('开始生成（异步任务，逐张创建 + 轮询；单张 1–5min 属正常）…\n\n');
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
      const response = await generateOne(root, plan, baseUrl, apiKey, timeoutMs);
      writeSidecar(plan, response, baseUrl, timeoutMs);
      success += 1;
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      for (const output of response.outputs) {
        process.stdout.write(`   PASS：${output.rel}（${output.bytes} 字节，${seconds}s）\n`);
      }
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
    process.stdout.write('有 API 失败：确认 key/地域/Base URL、模型是否已开通、参考图是否合规；修好后重跑（已成功的不会覆盖，除非 --force）。\n');
    process.exit(EXIT_API);
  }
  if (structFailed > 0 || planErrors.size > 0) {
    process.stdout.write('有参数/文件失败：按上面的 [ERROR] 修正 assets.json 或补齐参考图后重跑。\n');
    process.exit(EXIT_STRUCT);
  }
  process.stdout.write('下一步：node scripts/hero/qwen-image-batch.mjs --dry-run 复核；或 /hero-next 查看下一个待办。\n');
  process.exit(EXIT_OK);
}

main().catch((error) => {
  process.stderr.write(`未处理的错误：${error && error.stack ? error.stack : error}\n`);
  process.exit(EXIT_STRUCT);
});
