#!/usr/bin/env node
/**
 * Hero 视觉 SD 批量生成脚本（Node 24 ESM，零依赖，AUTOMATIC1111 API）
 *
 * 读取 docs/hero-visual/assets.json，按资产 prompt/negative/params 组装 txt2img 或 img2img 请求：
 *   - 默认 --dry-run：只打印将发送的关键字段，不联网、不写盘；
 *   - --run：真正 POST http://127.0.0.1:7860/sdapi/v1/txt2img 或 /img2img；
 *   - --only id1,id2：只处理指定资产；--force：允许覆盖已有母版。
 *   - 生成成功后把 PNG 存到资产的 master 路径，并写同名 .txt（完整正向/负向/seed/参数）。
 *
 * 可从任意 cwd 运行：脚本会从自身位置 / 当前目录向上自动定位项目根。
 *
 * 退出码：0 成功/全部跳过；1 结构或执行错误（含部分资产失败）；2 清单缺失或 A1111 不可达。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const A1111_BASE = 'http://127.0.0.1:7860';
const EXIT_OK = 0;
const EXIT_STRUCT = 1;
const EXIT_ENV = 2;
const MIN_PROMPT_BYTES = 50;
const GENERATE_TIMEOUT_MS = 600000;

const HELP = `Hero 视觉 · SD 批量生成（A1111）

用法：
  node scripts/hero/sd-batch.mjs [选项]

选项：
  --dry-run           只打印将发送的请求关键字段（默认行为），不联网、不写盘
  --run               真正提交到 AUTOMATIC1111（http://127.0.0.1:7860），生成并保存母版
  --only <id[,id]>    只处理指定资产 id（逗号分隔，可重复传 --only）
  --force             允许覆盖已存在的母版（不加则跳过已存在文件）
  --root <目录>       指定项目根（默认自动定位；一般不需要）
  -h, --help          显示本帮助

请求字段（来自 assets.json 的 params）：
  txt2img: prompt / negative_prompt / width / height / steps / cfg_scale / sampler_name / seed
  img2img: 额外 init_images（优先读 assets.json 的 initImage 画布，没有则退回 inputs[0]，base64）+ denoising_strength（params.denoise）
  hires:   若 params.hires 存在，透传 enable_hr / hr_scale / hr_upscaler / hr_second_pass_steps
  模式判定：params.mode 优先；否则有 initImage（或 inputs[0]）且 params.denoise 非 null 时用 img2img，否则 txt2img
  多 seed：params.seeds 为数组时逐个 seed 生成，母版文件名插入 _s<seed>（如 character_front_s848800.png）
  扩展：ControlNet / IP-Adapter / ADetailer 等需要在 A1111 界面配置，本脚本不代发

注意事项：
  - 本脚本不切换 checkpoint：请先在 A1111 加载 assets.json params.model 对应的底模；
    若当前 checkpoint 与 params.model 不一致会给出 WARN。
  - 生成可能耗时数分钟，单次请求超时 10 分钟。
  - 只写资产的 master 路径与同名 .txt，不会改动 public/ 与其它文件。
  - 含 STYLE / CH-A 拼装占位的资产（如角色卡）会被拒绝：按 02 文档的拼接公式在 A1111 手工
    展开后生成，脚本不改写提示词；ComfyUI/VACE 资产与 params 未补全的资产默认跳过。

退出码：0 成功/全部跳过；1 结构或执行错误；2 清单缺失或 A1111 不可达。

示例：
  node scripts/hero/sd-batch.mjs --only sd-01 --dry-run
  node scripts/hero/sd-batch.mjs --only sd-01 --run
  node scripts/hero/sd-batch.mjs --run --only sd-00-character,sd-01
`;

function printHelpAndExit() {
  process.stdout.write(HELP);
  process.exit(EXIT_OK);
}

function failUsage(message) {
  process.stderr.write(`参数错误：${message}\n\n用 --help 查看用法。\n`);
  process.exit(EXIT_STRUCT);
}

function parseArgs(argv) {
  const opts = { dryRun: true, run: false, dryRunFlag: false, only: [], force: false, help: false, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--dry-run') {
      opts.dryRunFlag = true;
      opts.dryRun = true;
    } else if (arg === '--run') {
      opts.run = true;
      opts.dryRun = false;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--only') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) failUsage('--only 需要一个资产 id（如 sd-01）');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      if (!value) failUsage('--only= 后面需要资产 id');
      opts.only.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
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
  if (opts.run && opts.dryRunFlag) failUsage('--run 与 --dry-run 不能同时使用');
  return opts;
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

function resolveInsideRoot(root, relPath, label) {
  const abs = path.resolve(root, relPath);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${label} 不是项目内路径：${relPath}`);
  }
  return abs;
}

function readTextFile(root, relPath, label) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error(`${label} 路径为空（检查 assets.json 字段）`);
  }
  const abs = resolveInsideRoot(root, relPath, label);
  if (!fs.existsSync(abs)) throw new Error(`${label} 文件不存在：${toPosixPath(relPath)}`);
  const stat = fs.statSync(abs);
  if (stat.size <= MIN_PROMPT_BYTES) {
    throw new Error(`${label} 文件过小（${stat.size} 字节，要求 >${MIN_PROMPT_BYTES}）：${toPosixPath(relPath)}`);
  }
  return fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').trim();
}

function loadManifest(root) {
  const manifestPath = path.join(root, 'docs', 'hero-visual', 'assets.json');
  const rel = 'docs/hero-visual/assets.json';
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(`未找到资产清单：${rel}\n`);
    process.stderr.write(`项目根：${root}\n`);
    process.stderr.write('该文件由 Lead 合并 _fragments/sd-assets.json 与 _fragments/comfy-assets.json 后生成；\n');
    process.stderr.write('生成前无法批量生成，请先让 Lead 合并，或用 --help 查看用法。\n');
    process.exit(EXIT_ENV);
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    process.stderr.write(`${rel} 不是合法 JSON：${error.message}\n`);
    process.exit(EXIT_STRUCT);
  }
  if (!isPlainObject(manifest) || !Array.isArray(manifest.assets)) {
    process.stderr.write(`${rel} 结构错误：缺少 assets 数组（先运行 node scripts/hero/assets-check.mjs 查看详情）\n`);
    process.exit(EXIT_STRUCT);
  }
  return manifest;
}

function normalizeInteger(value, label, assetId, { allowNull = false, defaultValue = undefined } = {}) {
  if (value === undefined || value === null) {
    if (allowNull && defaultValue !== undefined) return defaultValue;
    throw new Error(`${assetId}：缺少 ${label}（请在 assets.json 的 params 中补全；源方案没有的字段用 null）`);
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${assetId}：${label} 必须是整数（当前 ${JSON.stringify(value)}）`);
  return number;
}

function normalizeNumber(value, label, assetId) {
  if (value === undefined || value === null) {
    throw new Error(`${assetId}：缺少 ${label}（请在 assets.json 的 params 中补全）`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${assetId}：${label} 必须是数字（当前 ${JSON.stringify(value)}）`);
  return number;
}

function normalizeString(value, label, assetId) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${assetId}：缺少 ${label}（请在 assets.json 的 params 中补全）`);
  }
  return value;
}

function determineMode(asset) {
  const params = isPlainObject(asset.params) ? asset.params : {};
  if (params.mode === 'txt2img' || params.mode === 'img2img') return params.mode;
  const hasInput = Boolean(asset.initImage) || (Array.isArray(asset.inputs) && asset.inputs.length > 0);
  const denoise = params.denoise !== undefined && params.denoise !== null ? params.denoise : params.denoising_strength;
  return hasInput && denoise !== undefined && denoise !== null ? 'img2img' : 'txt2img';
}

// 是否为本脚本可执行的 SD 资产（排除 ComfyUI/VACE 产物、拼装占位模板与参数未补全的资产）
function promptHasPlaceholders(root, asset) {
  if (!root || !asset || typeof asset.prompt !== 'string') return false;
  try {
    const text = fs.readFileSync(path.resolve(root, asset.prompt), 'utf8');
    return /(^|[\s,(])(STYLE|CH-A2|CH-A)(?=[\s,)]|$)/.test(text);
  } catch {
    return false;
  }
}

function isSdRunnable(asset, root) {
  if (!isPlainObject(asset) || asset.kind !== 'image') return false;
  const params = isPlainObject(asset.params) ? asset.params : {};
  if (/wan|vace|comfy/i.test(String(params.model || ''))) return false;
  if (promptHasPlaceholders(root, asset)) return false;
  const stepsOk = params.steps !== undefined && params.steps !== null && Number.isInteger(Number(params.steps));
  const samplerOk = typeof params.sampler === 'string' && params.sampler.trim() !== '';
  const sizeOk = params.width !== undefined && params.width !== null && params.height !== undefined && params.height !== null;
  const seedOk =
    (params.seed !== undefined && params.seed !== null) ||
    (Array.isArray(params.seeds) && params.seeds.length > 0);
  return stepsOk && samplerOk && sizeOk && seedOk;
}

function docsForAsset(asset) {
  const params = isPlainObject(asset.params) ? asset.params : {};
  const model = String(params.model || '');
  const comfyStyle = asset.kind === 'video' || asset.stage === 'S1' || /wan|vace|comfy/i.test(model);
  return comfyStyle ? 'docs/hero-visual/03-comfyui-video.md' : 'docs/hero-visual/02-sd-assets.md';
}

function seedsOf(asset) {
  const params = isPlainObject(asset.params) ? asset.params : {};
  if (Array.isArray(params.seeds) && params.seeds.length > 0) {
    return params.seeds.map((seed, index) => {
      const value = Number(seed);
      if (!Number.isInteger(value)) throw new Error(`${asset.id}：params.seeds[${index}] 必须是整数（当前 ${JSON.stringify(seed)}）`);
      return value;
    });
  }
  if (params.seed !== undefined && params.seed !== null) {
    return [normalizeInteger(params.seed, 'params.seed', asset.id)];
  }
  return [-1];
}

function mimeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function targetPathFor(asset, seed, multiSeed) {
  if (!multiSeed) return toPosixPath(asset.master);
  const ext = path.extname(asset.master);
  const base = asset.master.slice(0, asset.master.length - ext.length);
  return toPosixPath(`${base}_s${seed}${ext}`);
}

function sidecarPathFor(targetRel) {
  const ext = path.extname(targetRel);
  return ext ? `${targetRel.slice(0, targetRel.length - ext.length)}.txt` : `${targetRel}.txt`;
}

function buildAssetPlan(root, asset, seed, multiSeed, force, run) {
  const params = isPlainObject(asset.params) ? asset.params : {};
  const promptRel = asset.prompt;
  const negativeRel = asset.negative;
  const positive = readTextFile(root, promptRel, `${asset.id} 的 prompt`);
  const negative = readTextFile(root, negativeRel, `${asset.id} 的 negative`);
  if (/(^|[\s,(])(STYLE|CH-A2|CH-A)(?=[\s,)]|$)/.test(positive)) {
    throw new Error(`${asset.id}：prompt 含 STYLE/CH-A 拼装占位，按 docs/hero-visual/02-sd-assets.md 的拼接公式在 A1111 手工展开；sd-batch 不改写提示词`);
  }
  const mode = determineMode(asset);

  const width = normalizeInteger(params.width, 'params.width', asset.id);
  const height = normalizeInteger(params.height, 'params.height', asset.id);
  const steps = normalizeInteger(params.steps, 'params.steps', asset.id);
  const cfg = normalizeNumber(params.cfg !== undefined && params.cfg !== null ? params.cfg : params.cfg_scale, 'params.cfg', asset.id);
  const sampler = normalizeString(params.sampler !== undefined && params.sampler !== null ? params.sampler : params.sampler_name, 'params.sampler', asset.id);
  if (width <= 0 || height <= 0) throw new Error(`${asset.id}：params.width/height 必须为正整数`);
  if (steps <= 0) throw new Error(`${asset.id}：params.steps 必须为正整数`);

  const payload = {
    prompt: positive,
    negative_prompt: negative,
    width,
    height,
    steps,
    cfg_scale: cfg,
    sampler_name: sampler,
    seed,
  };

  const notes = [];
  const warnings = [];

  if (isPlainObject(params.hires)) {
    const hires = params.hires;
    payload.enable_hr = true;
    if (hires.scale !== undefined && hires.scale !== null) payload.hr_scale = Number(hires.scale);
    if (hires.upscaler) payload.hr_upscaler = String(hires.upscaler);
    if (hires.steps !== undefined && hires.steps !== null) payload.hr_second_pass_steps = Number(hires.steps);
    notes.push(`hires：${payload.hr_scale || '(未给 scale)'}× / denoise ${hires.denoise ?? '(未给)'} / ${payload.hr_upscaler || '(未给 upscaler)'} / ${payload.hr_second_pass_steps ?? '(未给 steps)'} steps`);
    if (mode === 'txt2img' && hires.denoise !== undefined && hires.denoise !== null) {
      payload.denoising_strength = Number(hires.denoise);
    }
    if (mode === 'img2img') {
      warnings.push('img2img + hires：API 的 denoising_strength 会与 img2img 强度冲突，hires 重绘强度需在 A1111 界面单独设置');
    }
  }

  if (mode === 'img2img') {
    const inputRel = asset.initImage || (Array.isArray(asset.inputs) ? asset.inputs[0] : null);
    if (!inputRel) {
      throw new Error(`${asset.id}：判定为 img2img，但 assets.json 既没有 initImage 也没有 inputs[0]（img2img 输入画布）`);
    }
    const inputAbs = resolveInsideRoot(root, inputRel, `${asset.id} 的 initImage/inputs[0]`);
    const denoiseValue = params.denoise !== undefined && params.denoise !== null ? params.denoise : params.denoising_strength;
    if (denoiseValue === undefined || denoiseValue === null) {
      throw new Error(`${asset.id}：img2img 缺少 params.denoise（请在 assets.json 参数表补全）`);
    }
    const denoise = Number(denoiseValue);
    if (!Number.isFinite(denoise) || denoise <= 0 || denoise > 1) {
      throw new Error(`${asset.id}：params.denoise 必须在 (0,1] 区间（当前 ${JSON.stringify(denoiseValue)}）`);
    }
    if (!fs.existsSync(inputAbs)) {
      if (run) {
        throw new Error(`${asset.id}：img2img 输入画布不存在：${toPosixPath(inputRel)}（先按 02 文档 §4.4 搭好画布）`);
      }
      warnings.push(`输入画布尚未生成：${toPosixPath(inputRel)}（S1 产物；dry-run 不读取 base64，--run 前必须先搭画布）`);
      payload._inputRel = toPosixPath(inputRel);
      payload._inputAbs = inputAbs;
      payload._inputMime = mimeOf(inputAbs);
      payload._inputBytes = null;
    } else {
      payload._inputRel = toPosixPath(inputRel);
      payload._inputAbs = inputAbs;
      payload._inputMime = mimeOf(inputAbs);
      payload._inputBytes = fs.statSync(inputAbs).size;
      notes.push(`init_images：${toPosixPath(inputRel)}（${payload._inputBytes} 字节，base64 后约 ${Math.ceil(payload._inputBytes / 3) * 4} 字节）`);
    }
    payload.denoising_strength = denoise;
  }

  if (mode === 'txt2img') {
    payload._inputRel = null;
  }

  if (Array.isArray(params.controlnet) && params.controlnet.length > 0) {
    warnings.push(`ControlNet ×${params.controlnet.length}：脚本不代发，需在 A1111 扩展中配置（参数见 02 文档）`);
  }
  if (params.ipAdapter) warnings.push('IP-Adapter：脚本不代发，需在 A1111 扩展中配置角色参考');
  if (params.adetailer) warnings.push(`ADetailer：脚本不代发，需在 A1111 界面启用（${JSON.stringify(params.adetailer)}）`);

  const targetRel = targetPathFor(asset, seed, multiSeed);
  const targetAbs = resolveInsideRoot(root, targetRel, `${asset.id} 的 master`);
  const sidecarRel = sidecarPathFor(targetRel);
  const sidecarAbs = resolveInsideRoot(root, sidecarRel, `${asset.id} 的参数 txt`);
  const exists = fs.existsSync(targetAbs);
  if (exists && !force) notes.push('母版已存在：跳过（加 --force 覆盖）');

  return {
    asset,
    mode,
    seed,
    targetRel,
    targetAbs,
    sidecarRel,
    sidecarAbs,
    payload,
    notes,
    warnings,
    skip: exists && !force,
    positive,
    negative,
    promptRel,
    negativeRel,
  };
}

function formatPreview(text, limit = 90) {
  const singleLine = String(text).replace(/\s+/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit)}…` : singleLine;
}

function omitRuntimeFields(payload) {
  const copy = { ...payload };
  delete copy._inputRel;
  delete copy._inputAbs;
  delete copy._inputMime;
  delete copy._inputBytes;
  return copy;
}

function printPlan(plan, index, total) {
  const { asset, payload, mode, targetRel, skip } = plan;
  const lines = [];
  lines.push(`── [${index}/${total}] ${asset.id} · ${asset.title}（${mode}）${skip ? ' [SKIP 已存在]' : ''}`);
  lines.push(`   prompt：${toPosixPath(plan.promptRel)}（${plan.positive.length} 字符）`);
  lines.push(`   负向：${toPosixPath(plan.negativeRel)}（${plan.negative.length} 字符）`);
  lines.push(
    `   参数：${payload.width}×${payload.height} / steps ${payload.steps} / cfg ${payload.cfg_scale} / ${payload.sampler_name} / seed ${payload.seed}` +
      `${mode === 'img2img' ? ` / denoise ${payload.denoising_strength}` : ''}`,
  );
  if (payload.enable_hr) lines.push(`   hires：已启用（hr_scale=${payload.hr_scale ?? 'null'}，hr_upscaler=${payload.hr_upscaler ?? 'null'}）`);
  if (payload._inputRel) lines.push(`   输入：${payload._inputRel}（${payload._inputBytes === null ? '待 S1 生成，dry-run 未读取' : `${payload._inputBytes} 字节`}）`);
  lines.push(`   母版：${toPosixPath(targetRel)}`);
  lines.push(`   请求：POST ${A1111_BASE}/sdapi/v1/${mode}`);
  lines.push(`     prompt=${JSON.stringify(formatPreview(payload.prompt))}`);
  lines.push(`     negative_prompt=${JSON.stringify(formatPreview(payload.negative_prompt))}`);
  lines.push(
    `     width=${payload.width} height=${payload.height} steps=${payload.steps} cfg_scale=${payload.cfg_scale} ` +
      `sampler_name=${JSON.stringify(payload.sampler_name)} seed=${payload.seed}` +
      (mode === 'img2img' ? ` denoising_strength=${payload.denoising_strength}` : ''),
  );
  for (const note of plan.notes) lines.push(`   · ${note}`);
  for (const warning of plan.warnings) lines.push(`   ! ${warning}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function writeSidecar(plan, checkpoint) {
  const paramsForFile = omitRuntimeFields(plan.payload);
  const lines = [
    '# Hero 资产参数记录（scripts/hero/sd-batch.mjs 自动生成）',
    `# asset: ${plan.asset.id}`,
    `# title: ${plan.asset.title}`,
    `# stage: ${plan.asset.stage}`,
    `# mode: ${plan.mode}`,
    `# prompt_file: ${toPosixPath(plan.promptRel)}`,
    `# negative_file: ${toPosixPath(plan.negativeRel)}`,
    `# generated_at: ${new Date().toISOString()}`,
    `# checkpoint: ${checkpoint || '(未探测)'}`,
    '',
    'POSITIVE:',
    plan.positive,
    '',
    'NEGATIVE:',
    plan.negative,
    '',
    `SEED: ${plan.seed}`,
    '',
    'PARAMETERS:',
    JSON.stringify(paramsForFile, null, 2),
    '',
  ];
  fs.writeFileSync(plan.sidecarAbs, lines.join('\n'), 'utf8');
}

async function preflight() {
  let response;
  try {
    response = await fetch(`${A1111_BASE}/sdapi/v1/options`, { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    process.stderr.write(`A1111 不可达：${A1111_BASE}/sdapi/v1/options\n`);
    process.stderr.write(`原因：${error.message}\n`);
    process.stderr.write('请确认已启动 AUTOMATIC1111 WebUI（带 --api），端口 7860 可达。\n');
    process.exit(EXIT_ENV);
  }
  if (!response.ok) {
    process.stderr.write(`A1111 API 返回 HTTP ${response.status}（${A1111_BASE}/sdapi/v1/options）\n`);
    process.stderr.write('请确认 WebUI 以 --api 参数启动，且未被防火墙拦截。\n');
    process.exit(EXIT_ENV);
  }
  let options = {};
  try {
    options = await response.json();
  } catch {
    options = {};
  }
  const checkpoint = typeof options.sd_model_checkpoint === 'string' ? options.sd_model_checkpoint : '';
  process.stdout.write(`A1111 已连接；当前 checkpoint：${checkpoint || '(未返回)'}\n`);
  return checkpoint;
}

async function submit(plan) {
  const payload = omitRuntimeFields(plan.payload);
  if (plan.mode === 'img2img') {
    const base64 = fs.readFileSync(plan.payload._inputAbs).toString('base64');
    payload.init_images = [`data:${plan.payload._inputMime};base64,${base64}`];
  }
  let response;
  try {
    response = await fetch(`${A1111_BASE}/sdapi/v1/${plan.mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`请求 A1111 失败（${plan.mode}）：${error.message}`);
  }
  const text = await response.text();
  if (!response.ok) {
    const detail = text.length > 500 ? `${text.slice(0, 500)}…` : text;
    throw new Error(`A1111 返回 HTTP ${response.status}：${detail}`);
  }
  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(`A1111 响应不是合法 JSON：${error.message}`);
  }
  if (!Array.isArray(result.images) || result.images.length === 0 || typeof result.images[0] !== 'string') {
    throw new Error('A1111 响应中没有 images[0]（生成失败或扩展报错，检查 WebUI 控制台）');
  }
  if (result.images.length > 1) {
    process.stdout.write(`   ! A1111 返回 ${result.images.length} 张图，仅保存第一张\n`);
  }
  fs.mkdirSync(path.dirname(plan.targetAbs), { recursive: true });
  fs.writeFileSync(plan.targetAbs, Buffer.from(result.images[0], 'base64'));
  return plan.targetAbs;
}

function modelMatches(checkpoint, desired) {
  if (!checkpoint || !desired) return true;
  const clean = (value) => String(value).toLowerCase().replace(/\.(safetensors|ckpt|pt)$/, '').replace(/[^a-z0-9]+/g, '');
  const a = clean(checkpoint);
  const b = clean(desired);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) printHelpAndExit();

  const root = findRepoRoot(opts.root);
  const manifest = loadManifest(root);
  const allAssets = manifest.assets.filter((asset) => isPlainObject(asset));

  // 选中范围
  let selected;
  let skippedNonSd = [];
  if (opts.only.length > 0) {
    selected = [];
    const seen = new Set();
    for (const id of opts.only) {
      if (seen.has(id)) continue;
      seen.add(id);
      const asset = allAssets.find((item) => item.id === id);
      if (!asset) {
        const available = allAssets.map((item) => `${item.id}(${item.kind})`).join('、');
        process.stderr.write(`未知资产 id：${id}\n可用资产：${available || '(清单为空)'}\n`);
        process.exit(EXIT_STRUCT);
      }
      if (asset.kind !== 'image') {
        process.stderr.write(`资产 ${id} 是 ${asset.kind}，sd-batch 只处理 image；视频请按 docs/hero-visual/03-comfyui-video.md 在 ComfyUI 执行。\n`);
        process.exit(EXIT_STRUCT);
      }
      if (!isSdRunnable(asset, root)) {
        const doc = docsForAsset(asset);
        if (promptHasPlaceholders(root, asset)) {
          process.stderr.write(`资产 ${id} 的 prompt 含 STYLE/CH-A 拼装占位，按 ${doc} 的拼接公式在 A1111 手工展开后生成；sd-batch 不改写提示词。\n`);
        } else if (doc === 'docs/hero-visual/03-comfyui-video.md') {
          process.stderr.write(`资产 ${id} 不是 SD 批量生成资产（由 ComfyUI/VACE 产出），请按 ${doc} 执行。\n`);
        } else {
          process.stderr.write(`资产 ${id} 的 params 尚未补全（steps/cfg/sampler/seed 等），无法组装 A1111 请求；先按 ${doc} 参数表补全 assets.json 后再运行。\n`);
        }
        process.exit(EXIT_STRUCT);
      }
      selected.push(asset);
    }
  } else {
    const imageAssets = allAssets.filter((asset) => asset.kind === 'image');
    selected = imageAssets.filter((asset) => isSdRunnable(asset, root));
    skippedNonSd = imageAssets.filter((asset) => !isSdRunnable(asset, root)).map((asset) => asset.id);
  }

  if (selected.length === 0) {
    process.stderr.write('清单中没有可直接批量生成的 SD image 资产：\n');
    process.stderr.write('  - 先运行 node scripts/hero/assets-check.mjs 检查清单结构；\n');
    process.stderr.write('  - 参数未补全的资产按 docs/hero-visual/02-sd-assets.md 补齐；ComfyUI/VACE 资产按 03 文档执行。\n');
    if (skippedNonSd.length > 0) process.stderr.write(`  - 已跳过的非 SD 资产：${skippedNonSd.join('、')}\n`);
    process.exit(EXIT_STRUCT);
  }

  process.stdout.write('Hero 视觉 · SD 批量生成（A1111）\n');
  process.stdout.write(`仓库根：${root}\n`);
  process.stdout.write(`清单：docs/hero-visual/assets.json（${allAssets.length} 个资产，选中 ${selected.length} 个 SD image 资产）\n`);
  process.stdout.write(`模式：${opts.run ? 'RUN（真正生成）' : 'DRY-RUN（只打印请求，不联网、不写盘）'}${opts.force ? ' + FORCE（允许覆盖）' : ''}\n`);
  process.stdout.write(`A1111：${A1111_BASE}\n`);
  if (skippedNonSd.length > 0) {
    process.stdout.write(`跳过非 SD 批量资产：${skippedNonSd.join('、')}（ComfyUI/VACE 产物、拼装占位或参数未补全，见 03/02 文档）\n`);
  }
  process.stdout.write('');

  // 组装计划（逐资产校验；单个资产失败不阻塞其它资产，但最后以退出码 1 报告）
  const plans = [];
  const planErrors = new Set();
  for (const asset of selected) {
    let seeds;
    try {
      seeds = seedsOf(asset);
    } catch (error) {
      planErrors.add(error.message);
      continue;
    }
    const multiSeed = isPlainObject(asset.params) && Array.isArray(asset.params.seeds) && asset.params.seeds.length > 1;
    for (const seed of seeds) {
      try {
        plans.push(buildAssetPlan(root, asset, seed, multiSeed, opts.force, opts.run));
      } catch (error) {
        planErrors.add(error.message);
      }
    }
  }

  if (planErrors.size > 0) {
    process.stderr.write('以下资产的参数/文件校验失败（跳过，不提交请求）：\n');
    for (const error of planErrors) process.stderr.write(`  [ERROR] ${error}\n`);
    process.stderr.write('提示：按 docs/hero-visual/02-sd-assets.md 对应资产参数表补全，或先运行 node scripts/hero/assets-check.mjs。\n');
  }

  if (plans.length === 0) {
    process.stderr.write('没有可执行的资产计划：先修复上面的 [ERROR]，再重跑本脚本。\n');
    process.exit(EXIT_STRUCT);
  }

  const pending = plans.filter((plan) => !plan.skip);
  if (pending.length === 0) {
    process.stdout.write('所有目标母版都已存在，无需生成（加 --force 可覆盖）。\n');
    process.exit(planErrors.size > 0 ? EXIT_STRUCT : EXIT_OK);
  }

  let checkpoint = '';
  if (opts.run) {
    checkpoint = await preflight();
    // checkpoint 与计划模型的差异提示
    const mismatches = new Set();
    for (const plan of pending) {
      const desired = plan.asset.params && isPlainObject(plan.asset.params) ? plan.asset.params.model : null;
      if (desired && !modelMatches(checkpoint, desired)) mismatches.add(String(desired));
    }
    for (const desired of mismatches) {
      process.stdout.write(`WARN：当前 checkpoint（${checkpoint}）与 assets.json params.model（${desired}）不一致；脚本不会自动切换，请在 A1111 手动加载正确底模。\n`);
    }
    process.stdout.write('');
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    if (!opts.run) {
      printPlan(plan, index + 1, plans.length);
      if (plan.skip) skipped += 1;
      continue;
    }

    if (plan.skip) {
      process.stdout.write(`── [${index + 1}/${plans.length}] ${plan.asset.id} 跳过（${toPosixPath(plan.targetRel)} 已存在，加 --force 覆盖）\n`);
      skipped += 1;
      continue;
    }

    process.stdout.write(
      `── [${index + 1}/${plans.length}] ${plan.asset.id} 生成中…（${plan.mode} ${plan.payload.width}×${plan.payload.height}，seed ${plan.seed}，steps ${plan.payload.steps}，cfg ${plan.payload.cfg_scale}，${plan.payload.sampler_name}）\n`,
    );
    const startedAt = Date.now();
    try {
      const saved = await submit(plan);
      writeSidecar(plan, checkpoint);
      success += 1;
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      process.stdout.write(`   PASS：${toPosixPath(path.relative(root, saved))}（${seconds}s）\n`);
      process.stdout.write(`   参数：${toPosixPath(path.relative(root, plan.sidecarAbs))}\n`);
    } catch (error) {
      failed += 1;
      process.stdout.write(`   FAIL：${error.message}\n`);
    }
  }

  process.stdout.write('');
  if (!opts.run) {
    process.stdout.write(`DRY-RUN 完成：${plans.length} 个请求已打印，其中 ${skipped} 个母版已存在会被跳过。\n`);
    if (planErrors.size > 0) {
      process.stdout.write(`另有 ${planErrors.size} 个资产因参数/文件校验未生成（见上方 [ERROR]）。\n`);
      process.exit(EXIT_STRUCT);
    }
    process.stdout.write('确认字段无误后加 --run 真正生成（A1111 需已启动并加载正确底模）。\n');
    process.exit(EXIT_OK);
  }

  process.stdout.write(`完成：成功 ${success} / 跳过 ${skipped} / 失败 ${failed}`);
  if (planErrors.size > 0) process.stdout.write(`（另有 ${planErrors.size} 个资产因参数/文件校验未提交）`);
  process.stdout.write('\n');
  if (failed > 0 || planErrors.size > 0) {
    process.stdout.write('有失败项：看上面的 [ERROR] 原因，修复后重跑；已成功的不会被覆盖（除非 --force）。\n');
    process.exit(EXIT_STRUCT);
  }
  process.stdout.write('下一步：node scripts/hero/assets-check.mjs --next 查看下一个待办。\n');
  process.exit(EXIT_OK);
}

main().catch((error) => {
  process.stderr.write(`未处理的错误：${error && error.stack ? error.stack : error}\n`);
  process.exit(EXIT_STRUCT);
});
