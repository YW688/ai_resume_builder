#!/usr/bin/env node
/**
 * Hero 视觉资产清单校验器（Qwen v2，Node 24 ESM，零依赖）
 *
 * 读取 docs/hero-visual/assets.json（version 2：12 图 + 4 视频 + 8 阶段），做结构校验、
 * 阶段完成度统计与「下一个待办资产」提示。可从任意 cwd 运行（自动定位项目根）。
 *
 * 校验规则（v2）：
 *   - 必填：id / kind / title / stage / prompt / negative / model；
 *   - image：必须有 size（如 "1920x1080"），或等价的 params.size / params.width+height；
 *   - video：必须有 resolution / duration（2–15 整数秒）/ firstFrame（model 含 t2v 时可省），
 *     lastFrame 可选（首尾帧）；
 *   - seed / seeds 可选（单值或数组）；prompt/negative 文件必须存在且 >50 字节；
 *   - refs / firstFrame / lastFrame / inputs 必须是项目内相对路径（文件未生成只 WARN，pending 不算错）；
 *   - webOutputs / dependsOn 路径与引用校验保持：id 唯一、依赖存在且无循环。
 *
 * 完成判定：master（多 seed 时展开 <seed> / _s<seed>）与 webOutputs 文件真实存在。
 * 退出码：0 校验通过（pending 产物不算错）；1 结构错误；2 找不到项目根或 assets.json 尚未生成。
 *
 * 用法见 HELP（node scripts/hero/assets-check.mjs --help）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_OK = 0;
const EXIT_STRUCT = 1;
const EXIT_ENV = 2;
const MIN_PROMPT_BYTES = 50;
const DEFAULT_STAGES = [
  { id: 'S0', name: '环境与 API 自检', gate: 'doctor.cmd 无 FAIL；setup-claude.cmd PASS' },
  { id: 'S1', name: '参考素材整理', gate: 'design/UI_ref.jpg、design/滑板少女.mp4 就位；需要时抽帧到 design/source/frames/' },
  { id: 'S2', name: '角色卡（4 seed，T2I）', gate: '客户确认 design/source/refs/character_front.png' },
  { id: 'S3', name: '7 张网页图 + 4 张关键帧（I2I）', gate: '11 张全过 10 秒验收' },
  { id: 'S4', name: '万相 4 段视频（i2v）', gate: '1080P、5/6/5/5s、首帧=关键帧、主体不进中心' },
  { id: 'S5', name: '剪辑/导出', gate: '15–18s、无音轨、H.264、循环无跳帧' },
  { id: 'S6', name: '前端集成', gate: 'npm run build 通过 + 三档截图 + 对比度达标' },
  { id: 'S7', name: '总验收', gate: '05-acceptance 全过并留证' },
];

const HELP = `Hero 视觉资产清单校验器（assets-check · Qwen v2）

用法：
  node scripts/hero/assets-check.mjs [选项]

选项：
  --next            打印按阶段顺序的下一个未完成资产及下一步命令
  --json            以 JSON 输出结果（便于其他脚本/命令消费）
  --root <目录>     指定项目根（默认自动定位；一般不需要）
  -h, --help        显示本帮助

说明：
  - 清单文件固定为 <项目根>/docs/hero-visual/assets.json，由 Lead 合并生成，勿手改。
  - 校验 v2 schema：必填 id/kind/title/stage/prompt/negative/model；
    image 需 size，video 需 resolution/duration/firstFrame（t2v 可省 firstFrame）；
    seed/seeds 可选；prompt/negative 文件存在且 >50 字节；id 唯一；dependsOn 引用存在且无循环；
    refs/firstFrame/lastFrame/inputs/webOutputs 为项目内相对路径。
  - 完成判定：master（多 seed 展开 <seed> / _s<seed>）与 webOutputs 文件真实存在；
    缺失只是 pending，不算结构错误。
  - 退出码：0 通过；1 结构错误；2 找不到项目根或清单尚未生成。

示例：
  node scripts/hero/assets-check.mjs
  node scripts/hero/assets-check.mjs --next
  node scripts/hero/assets-check.mjs --json
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
  const opts = { json: false, next: false, help: false, root: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--next') {
      opts.next = true;
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

  // 优先：向上找到含 docs/hero-visual 的目录（清单所在）
  for (const dir of ancestors) {
    if (isDir(path.join(dir, 'docs', 'hero-visual'))) return dir;
  }
  // 其次：含 package.json 且本身是脚本所在仓库（scripts/hero 存在）
  for (const dir of ancestors) {
    if (fs.existsSync(path.join(dir, 'package.json')) && isDir(path.join(dir, 'scripts', 'hero'))) return dir;
  }
  // 兜底：脚本在 <root>/scripts/hero 下
  return path.resolve(scriptDir, '..', '..');
}

function isPlainPath(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function safeRelativePath(root, value) {
  if (!isPlainPath(value)) return false;
  if (path.isAbsolute(value) || /^[a-zA-Z]:/.test(value) || value.startsWith('\\\\')) return false;
  const resolved = path.resolve(root, value);
  const rel = path.relative(root, resolved);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function fileStatus(root, relPath, minBytes) {
  if (!isPlainPath(relPath)) return { exists: false, size: 0, reason: '路径为空' };
  const abs = path.resolve(root, relPath);
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return { exists: false, size: 0, reason: '不是文件' };
    if (stat.size <= minBytes) {
      return { exists: true, size: stat.size, reason: `文件仅 ${stat.size} 字节（要求 >${minBytes}）` };
    }
    return { exists: true, size: stat.size, reason: '' };
  } catch {
    return { exists: false, size: 0, reason: '文件不存在' };
  }
}

function pickAssetModel(asset) {
  if (!isPlainObject(asset)) return '';
  if (isPlainPath(asset.model)) return asset.model.trim();
  if (isPlainObject(asset.params) && isPlainPath(asset.params.model)) return String(asset.params.model).trim();
  return '';
}

function seedsOf(asset) {
  const list = [];
  if (Array.isArray(asset.seeds)) {
    for (const seed of asset.seeds) list.push(seed);
  } else if (asset.seed !== undefined && asset.seed !== null) {
    list.push(asset.seed);
  }
  return list;
}

function expandMasterPaths(asset) {
  if (!isPlainObject(asset) || !isPlainPath(asset.master)) return [];
  const master = toPosixPath(asset.master.trim());
  const seeds = seedsOf(asset);
  if (master.includes('<seed>')) {
    const values = seeds.length > 0 ? seeds : [null];
    return values.map((seed) => (seed === null ? master : master.replace(/<seed>/g, String(seed))));
  }
  if (seeds.length > 1) {
    const ext = path.posix.extname(master);
    const base = ext ? master.slice(0, master.length - ext.length) : master;
    return seeds.map((seed) => `${base}_s${seed}${ext}`);
  }
  return [master];
}

function assetEntry(asset, root) {
  const outputs = [];
  for (const rel of expandMasterPaths(asset)) outputs.push(rel);
  if (Array.isArray(asset.webOutputs)) {
    for (const output of asset.webOutputs) {
      if (isPlainObject(output) && isPlainPath(output.path)) outputs.push(output.path.trim());
    }
  }
  const missing = outputs.filter((rel) => !fs.existsSync(path.resolve(root, rel)));
  return { complete: outputs.length > 0 && missing.length === 0, missing, outputs };
}

function stageNameMap(manifest) {
  const list = [];
  if (Array.isArray(manifest.stages)) {
    for (const stage of manifest.stages) {
      if (!isPlainObject(stage)) continue;
      if (typeof stage.id !== 'string' || stage.id.trim() === '') continue;
      list.push({
        id: stage.id,
        name: typeof stage.name === 'string' && stage.name.trim() !== '' ? stage.name : stage.id,
        gate: typeof stage.gate === 'string' ? stage.gate : '',
      });
    }
  }
  return list.length > 0 ? list : DEFAULT_STAGES.slice();
}

function docsForAsset(asset) {
  if (!isPlainObject(asset)) return 'docs/hero-visual/02-qwen-images.md';
  if (asset.kind === 'video' || asset.stage === 'S4' || asset.stage === 'S5') return 'docs/hero-visual/03-qwen-video.md';
  return 'docs/hero-visual/02-qwen-images.md';
}

function isQwenImageModel(model) {
  return /^qwen-image/i.test(String(model));
}

function isWanVideoModel(model) {
  return /^wan/i.test(String(model));
}

/** 断言为项目内相对路径；非法返回 false（由调用方记 error） */
function validRelative(root, value) {
  return safeRelativePath(root, value);
}

function validateSeedValues(asset, errors, warnings) {
  const raw = [];
  if (Array.isArray(asset.seeds)) raw.push(...asset.seeds.map((seed, index) => ({ value: seed, label: `seeds[${index}]` })));
  if (asset.seed !== undefined && asset.seed !== null) raw.push({ value: asset.seed, label: 'seed' });
  if (raw.length === 0) {
    warnings.push(`${asset.id}：未给 seed/seeds，批量脚本会随机 seed（不利于复现）`);
    return;
  }
  for (const item of raw) {
    const number = Number(item.value);
    const valid = Number.isInteger(number) && number >= 0 && number <= 2147483647;
    if (!valid) errors.push(`${asset.id}：${item.label} 必须是 0–2147483647 的整数（当前 ${JSON.stringify(item.value)}）`);
  }
}

/** 校验一个本地相对路径字段：格式错 → error；文件未生成 → WARN（pending 依赖） */
function validateLocalPath(root, value, label, assetId, errors, warnings, pendingWarnings) {
  if (!validRelative(root, value)) {
    errors.push(`${assetId}：${label} 必须是项目内相对路径（当前 ${JSON.stringify(value)}）`);
    return;
  }
  if (!fs.existsSync(path.resolve(root, value))) {
    pendingWarnings.push(`${assetId}：${label} 文件尚未生成：${toPosixPath(value)}`);
  }
}

function validateManifest(manifest, root) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(manifest)) {
    errors.push('顶层必须是 JSON 对象（含 assets 数组）');
    return { errors, warnings, assets: [], stages: DEFAULT_STAGES.slice() };
  }

  const stages = stageNameMap(manifest);
  const stageIds = new Set(stages.map((stage) => stage.id));

  if (!Array.isArray(manifest.assets)) {
    errors.push('缺少 assets 数组（顶层字段 assets 必填）');
    return { errors, warnings, assets: [], stages };
  }
  if (manifest.assets.length === 0) {
    errors.push('assets 数组为空：应包含 12 张图 + 4 段视频（Qwen v2）');
  }
  if (manifest.version === 1) {
    warnings.push('清单仍是旧版 version 1 schema（非 Qwen）；等 Lead 合并 v2 后 qwen-*-batch 才能批量生成');
  } else if (manifest.version !== 2) {
    warnings.push(`version 不是 2（当前 ${JSON.stringify(manifest.version)}），仍按 v2 结构校验`);
  }
  if (manifest.stages !== undefined) {
    if (!Array.isArray(manifest.stages)) {
      errors.push('stages 必须是数组');
    } else {
      for (const stage of manifest.stages) {
        if (!isPlainObject(stage) || typeof stage.id !== 'string' || stage.id.trim() === '') {
          errors.push('stages 中存在缺少 id 的项');
        }
      }
    }
  }

  const seenIds = new Set();
  const byId = new Map();
  const assets = [];
  const pendingPathWarnings = [];

  manifest.assets.forEach((asset, index) => {
    const where = isPlainObject(asset) && typeof asset.id === 'string' && asset.id.trim() !== ''
      ? asset.id
      : `assets[${index}]`;

    if (!isPlainObject(asset)) {
      errors.push(`${where}：资产项必须是对象`);
      return;
    }

    for (const field of ['id', 'kind', 'title', 'stage', 'prompt', 'negative']) {
      if (asset[field] === undefined || asset[field] === null || asset[field] === '') {
        errors.push(`${where}：缺少必填字段 ${field}`);
      }
    }
    const model = pickAssetModel(asset);
    if (!model) errors.push(`${where}：缺少必填字段 model（qwen-image-3.0-pro / wan2.7-i2v 等）`);

    if (typeof asset.id === 'string' && asset.id.trim() !== '') {
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(asset.id)) {
        warnings.push(`${where}：id 含非常规字符（建议小写字母/数字/连字符）`);
      }
      if (seenIds.has(asset.id)) {
        errors.push(`${asset.id}：id 重复`);
      } else {
        seenIds.add(asset.id);
        byId.set(asset.id, asset);
      }
    }

    if (asset.kind !== undefined && asset.kind !== 'image' && asset.kind !== 'video') {
      errors.push(`${where}：kind 必须是 image 或 video（当前 ${JSON.stringify(asset.kind)}）`);
    }
    if (typeof asset.title !== 'string' || asset.title.trim() === '') {
      if (asset.title !== undefined && asset.title !== null) errors.push(`${where}：title 必须是非空字符串`);
    }
    if (typeof asset.stage === 'string' && !stageIds.has(asset.stage)) {
      errors.push(`${where}：stage=${asset.stage} 不在 stages 列表中`);
    }

    for (const field of ['prompt', 'negative']) {
      const value = asset[field];
      if (typeof value !== 'string' || value.trim() === '') continue;
      if (!safeRelativePath(root, value)) {
        errors.push(`${where}：${field} 必须是项目内相对路径（当前 ${value}）`);
        continue;
      }
      const status = fileStatus(root, value, MIN_PROMPT_BYTES);
      if (status.exists && status.reason) {
        errors.push(`${where}：${field} 文件过小：${toPosixPath(value)}（${status.reason}）`);
      } else if (!status.exists) {
        errors.push(`${where}：${field} 文件不存在：${toPosixPath(value)}（应先由 plan-image / plan-video 产出）`);
      }
    }

    // ---- 按 kind 校验核心生成字段 ----
    if (asset.kind === 'image') {
      let size = '';
      if (isPlainPath(asset.size)) size = asset.size.trim();
      else if (isPlainObject(asset.params) && isPlainPath(asset.params.size)) size = String(asset.params.size).trim();
      else if (isPlainObject(asset.params) && asset.params.width !== undefined && asset.params.height !== undefined) {
        size = `${asset.params.width}x${asset.params.height}`;
      }
      if (!size) {
        errors.push(`${where}：image 资产缺少 size（如 "1920x1080"；或 params.size / params.width+height）`);
      } else if (size.includes('*')) {
        errors.push(`${where}：size 必须用字母 x 连接宽高（如 1920x1080），不支持 *：${size}`);
      } else if (!/^\d{2,5}[xX]\d{2,5}$/.test(size)) {
        errors.push(`${where}：size 格式错误：${size}（应为 "宽x高"）`);
      }
      if (asset.n !== undefined && asset.n !== null) {
        const n = Number(asset.n);
        if (!Number.isInteger(n) || n < 1 || n > 6) errors.push(`${where}：n 必须是 1–6 的整数（当前 ${JSON.stringify(asset.n)}）`);
      }
      if (asset.promptExtend !== undefined && asset.promptExtend !== null && typeof asset.promptExtend !== 'boolean') {
        errors.push(`${where}：promptExtend 必须是 true/false（当前 ${JSON.stringify(asset.promptExtend)}）`);
      }
      if (!isQwenImageModel(model)) {
        warnings.push(`${where}：model=${model} 不是 qwen-image 模型（Qwen v2 图像应为 qwen-image-3.0-pro / 3.0 / 2.1-pro）`);
      }
    } else if (asset.kind === 'video') {
      if (!isPlainPath(asset.resolution)) {
        errors.push(`${where}：video 资产缺少 resolution（720P / 1080P）`);
      } else if (!/^(720P|1080P)$/i.test(String(asset.resolution).trim())) {
        warnings.push(`${where}：resolution=${asset.resolution} 不在 720P/1080P 内（本方案只用这两档）`);
      }
      if (asset.duration === undefined || asset.duration === null) {
        errors.push(`${where}：video 资产缺少 duration（整数秒 2–15）`);
      } else {
        const duration = Number(asset.duration);
        if (!Number.isInteger(duration) || duration < 2 || duration > 15) {
          errors.push(`${where}：duration 必须是 2–15 的整数秒（当前 ${JSON.stringify(asset.duration)}）`);
        }
      }
      const isT2V = /t2v/i.test(String(model));
      if (!isT2V && !isPlainPath(asset.firstFrame)) {
        errors.push(`${where}：i2v 资产缺少 firstFrame（首帧本地路径；纯 t2v 才可省）`);
      }
      if (isPlainPath(asset.firstFrame)) {
        validateLocalPath(root, asset.firstFrame, 'firstFrame', where, errors, warnings, pendingPathWarnings);
      }
      if (asset.lastFrame !== undefined && asset.lastFrame !== null && String(asset.lastFrame).trim() !== '') {
        validateLocalPath(root, asset.lastFrame, 'lastFrame', where, errors, warnings, pendingPathWarnings);
      }
      if (asset.promptExtend !== undefined && asset.promptExtend !== null && typeof asset.promptExtend !== 'boolean') {
        errors.push(`${where}：promptExtend 必须是 true/false（当前 ${JSON.stringify(asset.promptExtend)}）`);
      }
      if (!isWanVideoModel(model)) {
        warnings.push(`${where}：model=${model} 不是万相视频模型（Qwen v2 视频应为 wan2.7-i2v / wan2.7-t2v）`);
      }
    }

    validateSeedValues(asset, errors, warnings);

    // ---- refs / inputs / master ----
    if (asset.refs !== undefined) {
      if (!Array.isArray(asset.refs)) {
        errors.push(`${where}：refs 必须是本地相对路径数组`);
      } else {
        asset.refs.forEach((ref, refIndex) => {
          validateLocalPath(root, ref, `refs[${refIndex}]`, where, errors, warnings, pendingPathWarnings);
        });
        const is21 = /^qwen-image-2\.1/i.test(model);
        const maxRefs = is21 ? 10 : 3;
        if (/^qwen-image/i.test(model) && asset.refs.length > maxRefs) {
          warnings.push(`${where}：refs 有 ${asset.refs.length} 张，${is21 ? 'qwen-image-2.1-pro' : '3.0 系'} 最多 ${maxRefs} 张`);
        }
      }
    }

    if (asset.master !== undefined && asset.master !== '') {
      if (!safeRelativePath(root, asset.master)) {
        errors.push(`${where}：master 必须是项目内相对路径（当前 ${asset.master}）`);
      }
    } else {
      warnings.push(`${where}：缺少 master（批量脚本无法确定母版落盘路径）`);
    }

    if (!Array.isArray(asset.webOutputs)) {
      if (asset.webOutputs !== undefined) {
        errors.push(`${where}：webOutputs 必须是数组`);
      } else {
        warnings.push(`${where}：缺少 webOutputs 输出映射（没有就写 []）`);
      }
    } else {
      asset.webOutputs.forEach((output, outputIndex) => {
        if (!isPlainObject(output) || typeof output.path !== 'string' || output.path.trim() === '') {
          errors.push(`${where}：webOutputs[${outputIndex}].path 必须是非空字符串`);
        } else if (!safeRelativePath(root, output.path)) {
          errors.push(`${where}：webOutputs[${outputIndex}].path 必须是项目内相对路径（当前 ${output.path}）`);
        }
      });
    }

    if (asset.inputs !== undefined) {
      if (!Array.isArray(asset.inputs)) {
        errors.push(`${where}：inputs 必须是路径数组`);
      } else {
        asset.inputs.forEach((input, inputIndex) => {
          if (typeof input !== 'string' || input.trim() === '') {
            errors.push(`${where}：inputs[${inputIndex}] 必须是非空字符串`);
            return;
          }
          if (!safeRelativePath(root, input)) {
            errors.push(`${where}：inputs[${inputIndex}] 必须是项目内相对路径（当前 ${input}）`);
            return;
          }
          if (!fs.existsSync(path.resolve(root, input))) {
            warnings.push(`${where}：inputs 引用文件不存在：${toPosixPath(input)}（生成前需补齐）`);
          }
        });
      }
    }

    if (asset.dependsOn !== undefined) {
      if (!Array.isArray(asset.dependsOn)) {
        errors.push(`${where}：dependsOn 必须是 id 数组`);
      } else {
        asset.dependsOn.forEach((dep) => {
          if (typeof dep !== 'string' || dep.trim() === '') {
            errors.push(`${where}：dependsOn 中存在非字符串 id`);
          } else if (dep === asset.id) {
            errors.push(`${where}：dependsOn 不能依赖自身`);
          }
        });
      }
    }

    if (asset.watermark === true) {
      warnings.push(`${where}：watermark=true 不符合规范（批量脚本会强制 false，生成结果不得带水印）`);
    }

    const state = assetEntry(asset, root);
    assets.push({
      id: asset.id,
      kind: asset.kind,
      title: asset.title,
      stage: asset.stage,
      complete: state.complete,
      missing: state.missing.map(toPosixPath),
      dependsOn: Array.isArray(asset.dependsOn) ? asset.dependsOn.slice() : [],
    });
  });

  // 文件尚未生成的 pending 引用合并成少量 WARN，避免刷屏
  if (pendingPathWarnings.length > 0) {
    const shown = pendingPathWarnings.slice(0, 6).join('；');
    const more = pendingPathWarnings.length > 6 ? `；等 ${pendingPathWarnings.length} 项` : '';
    warnings.push(`以下引用文件尚未生成（pending，生成脚本 --run 前需补齐）：${shown}${more}`);
  }

  // dependsOn 引用与循环依赖
  for (const asset of manifest.assets) {
    if (!isPlainObject(asset) || !Array.isArray(asset.dependsOn)) continue;
    for (const dep of asset.dependsOn) {
      if (typeof dep === 'string' && !byId.has(dep)) {
        errors.push(`${asset.id}：dependsOn 引用了不存在的资产 ${dep}`);
      }
    }
  }

  const visitState = new Map();
  const reportedCycles = new Set();
  function visit(id, stack) {
    const current = visitState.get(id);
    if (current === 'done') return;
    if (current === 'visiting') {
      const cycle = [...stack.slice(stack.indexOf(id)), id].join(' -> ');
      if (!reportedCycles.has(cycle)) {
        reportedCycles.add(cycle);
        errors.push(`dependsOn 存在循环依赖：${cycle}`);
      }
      return;
    }
    visitState.set(id, 'visiting');
    const node = byId.get(id);
    const deps = node && Array.isArray(node.dependsOn) ? node.dependsOn : [];
    for (const dep of deps) {
      if (byId.has(dep)) visit(dep, [...stack, id]);
    }
    visitState.set(id, 'done');
  }
  for (const id of byId.keys()) visit(id, []);

  return { errors, warnings, assets, stages, byId };
}

function buildStageProgress(manifest, stages, assetStates) {
  const progress = stages.map((stage) => {
    const items = assetStates.filter((asset) => asset.stage === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      gate: stage.gate || '',
      total: items.length,
      complete: items.filter((asset) => asset.complete).length,
    };
  });
  // 未在 stages 中声明的阶段（理论上已被校验为错误）也展示出来，避免漏报
  const known = new Set(progress.map((item) => item.id));
  for (const asset of assetStates) {
    if (!known.has(asset.stage)) {
      progress.push({
        id: String(asset.stage),
        name: String(asset.stage),
        gate: '',
        total: 1,
        complete: asset.complete ? 1 : 0,
      });
      known.add(asset.stage);
    }
  }
  return progress;
}

function pickNext(manifest, assetStates, stages) {
  if (assetStates.length === 0) return { done: false, asset: null, state: null, blocked: true };
  const stageIndex = new Map(stages.map((stage, index) => [stage.id, index]));
  const ordered = assetStates
    .map((asset, index) => ({ asset, index }))
    .sort((a, b) => {
      const ai = stageIndex.has(a.asset.stage) ? stageIndex.get(a.asset.stage) : 99;
      const bi = stageIndex.has(b.asset.stage) ? stageIndex.get(b.asset.stage) : 99;
      return ai - bi || a.index - b.index;
    })
    .map((item) => item.asset);

  const stateById = new Map(assetStates.map((asset) => [asset.id, asset]));
  const dependenciesComplete = (asset) =>
    (Array.isArray(asset.dependsOn) ? asset.dependsOn : []).every((dep) => {
      const st = stateById.get(dep);
      return !st || st.complete;
    });

  const firstIncomplete = ordered.find((asset) => !asset.complete);
  if (!firstIncomplete) return { done: true, asset: null };

  const ready = ordered.find((asset) => !asset.complete && dependenciesComplete(asset));
  const target = ready || firstIncomplete;
  const manifestAssets = isPlainObject(manifest) && Array.isArray(manifest.assets) ? manifest.assets : [];
  const original = manifestAssets.find((item) => isPlainObject(item) && item.id === target.id) || target;
  return {
    done: false,
    asset: original,
    state: target,
    blocked: !ready,
  };
}

function emitJson(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function emitManifestMissing(root, manifestRel, jsonMode) {
  const message = `未找到资产清单：${manifestRel}`;
  const hint = 'docs/hero-visual/assets.json 由 Lead 合并 _fragments/image-assets.json 与 video-assets.json 后生成（v2：12 图 + 4 视频）；生成后重跑本脚本。';
  if (jsonMode) {
    emitJson(
      {
        ok: false,
        root,
        manifest: manifestRel,
        error: 'manifest-missing',
        message,
        hint,
      },
      EXIT_ENV,
    );
  }
  process.stderr.write(`${message}\n`);
  process.stderr.write(`项目根：${root}\n`);
  process.stderr.write(`${hint}\n`);
  process.stderr.write('在清单生成前，可用 /hero-status 或读 docs/hero-visual/00-INDEX.md 盘点人工进度。\n');
  process.exit(EXIT_ENV);
}

function isBatchRunnable(asset) {
  if (!isPlainObject(asset)) return false;
  const model = pickAssetModel(asset);
  if (!isPlainPath(asset.master)) return false;
  if (asset.kind === 'image') {
    if (!isQwenImageModel(model)) return false;
    let size = isPlainPath(asset.size) ? asset.size : '';
    if (!size && isPlainObject(asset.params) && isPlainPath(asset.params.size)) size = String(asset.params.size);
    if (!size && isPlainObject(asset.params) && asset.params.width !== undefined && asset.params.height !== undefined) size = 'ok';
    return Boolean(size);
  }
  if (asset.kind === 'video') {
    if (!isWanVideoModel(model)) return false;
    if (!isPlainPath(asset.resolution) || asset.duration === undefined || asset.duration === null) return false;
    const isT2V = /t2v/i.test(model);
    return isT2V || isPlainPath(asset.firstFrame);
  }
  return false;
}

function nextCommands(asset) {
  if (!asset || !isBatchRunnable(asset)) return [];
  const script = asset.kind === 'video' ? 'qwen-video-batch' : 'qwen-image-batch';
  return [
    `node scripts/hero/${script}.mjs --only ${asset.id} --dry-run`,
    `node scripts/hero/${script}.mjs --only ${asset.id} --run`,
  ];
}

function describeNext(asset, assetStateById, stages, root) {
  if (!asset) return null;
  const state = assetStateById.get(asset.id);
  const dependents = Array.isArray(asset.dependsOn) ? asset.dependsOn : [];
  const dependsPending = dependents.filter((dep) => {
    const st = assetStateById.get(dep);
    return st ? !st.complete : false;
  });
  const stage = stages.find((item) => item.id === asset.stage);
  const masterExists = expandMasterPaths(asset).some((rel) => fs.existsSync(path.resolve(root, rel)));
  return {
    id: asset.id,
    title: asset.title,
    kind: asset.kind,
    stage: asset.stage,
    stageName: stage ? stage.name : asset.stage,
    gate: stage ? stage.gate : '',
    model: pickAssetModel(asset),
    prompt: asset.prompt,
    negative: asset.negative,
    master: asset.master,
    missing: state ? state.missing : [],
    masterExists,
    dependsOn: dependents,
    dependsPending,
    refs: Array.isArray(asset.refs) ? asset.refs : [],
    inputs: Array.isArray(asset.inputs) ? asset.inputs : [],
    doc: docsForAsset(asset),
    runnable: isBatchRunnable(asset),
    commands: nextCommands(asset),
  };
}

function printHumanReport({ root, manifestRel, manifest, validation, progress, nextInfo, opts }) {
  const lines = [];
  lines.push('Hero 视觉 · 资产清单检查（Qwen v2）');
  lines.push(`仓库根：${root}`);
  const stageCount = progress.length;
  const assetCount = Array.isArray(manifest.assets) ? manifest.assets.length : 0;
  lines.push(`清单：${manifestRel}（version ${JSON.stringify(manifest.version)}；${assetCount} 个资产；${stageCount} 个阶段）`);
  lines.push('');

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;
  const structStatus = errorCount === 0 ? 'PASS' : 'FAIL';
  lines.push(`结构校验：[${structStatus}] ${errorCount} 错误 / ${warningCount} 警告`);
  for (const error of validation.errors) lines.push(`  [ERROR] ${error}`);
  for (const warning of validation.warnings) lines.push(`  [WARN ] ${warning}`);
  lines.push('');

  lines.push('阶段完成度（按 master/webOutputs 文件是否真实存在计）：');
  for (const stage of progress) {
    if (stage.total === 0) {
      lines.push(`  ${stage.id} ${stage.name}：无资产（由文档/人工 gate 判定）`);
    } else {
      lines.push(`  ${stage.id} ${stage.name}：${stage.complete}/${stage.total} 完成${stage.gate ? `（gate：${stage.gate}）` : ''}`);
    }
  }
  lines.push('');

  if (!opts.next) {
    const pending = validation.assets.filter((asset) => !asset.complete).length;
    lines.push(`pending 资产：${pending}/${validation.assets.length}（缺失产物不算错误）`);
    lines.push('下一步：node scripts/hero/assets-check.mjs --next  或 /hero-next');
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }

  if (nextInfo.done) {
    lines.push('下一个待办：全部资产已完成，进入 S7 总验收（/hero-verify，见 docs/hero-visual/05-acceptance.md）。');
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }

  if (!nextInfo.asset) {
    lines.push('下一个待办：清单中没有可推进的资产（先修复上面的结构错误）。');
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }

  const asset = nextInfo.asset;
  const state = nextInfo.state;
  const expandedMasters = expandMasterPaths(asset);
  const masterExists = expandedMasters.some((rel) => fs.existsSync(path.resolve(root, rel)));
  lines.push(`下一个待办资产：${asset.id}（${asset.stage} / ${asset.kind}）`);
  lines.push(`标题：${asset.title}`);
  lines.push(`模型：${pickAssetModel(asset) || '(未声明)'}`);
  lines.push(`依赖：${asset.dependsOn && asset.dependsOn.length > 0 ? asset.dependsOn.join('、') : '无'}`);
  if (nextInfo.blocked) {
    const pendingDeps = (asset.dependsOn || []).filter((dep) => {
      const st = validation.assets.find((item) => item.id === dep);
      return st && !st.complete;
    });
    lines.push(`依赖未完成：${pendingDeps.length > 0 ? pendingDeps.join('、') : (asset.dependsOn || []).join('、')}（先完成依赖再继续）`);
  }
  lines.push(`提示词：${toPosixPath(asset.prompt)}`);
  lines.push(`负向：${toPosixPath(asset.negative)}`);
  lines.push(`母版：${toPosixPath(asset.master || '(未声明)')}${masterExists ? '（已存在部分/全部）' : '（缺失）'}`);
  if (Array.isArray(asset.webOutputs) && asset.webOutputs.length > 0) {
    const outputs = asset.webOutputs.map((output) => toPosixPath(output.path));
    lines.push(`网页产物：${outputs.join('、')}`);
  }
  if (Array.isArray(asset.refs) && asset.refs.length > 0) {
    lines.push(`参考图（refs）：${asset.refs.map((ref) => toPosixPath(ref)).join('、')}`);
  }
  if (Array.isArray(asset.inputs) && asset.inputs.length > 0) {
    lines.push(`输入：${asset.inputs.map(toPosixPath).join('、')}`);
  }
  lines.push(`文档：${docsForAsset(asset)}`);
  const commands = nextCommands(asset);
  if (masterExists && state.missing.length > 0) {
    lines.push(`下一步：母版已存在，还缺产物：${state.missing.map(toPosixPath).join('、')}；`);
    lines.push('        按对应文档导出/转码到上述路径（不是重新生成；如需重生成母版加 --force）。');
  } else if (commands.length > 0) {
    lines.push('下一步命令：');
    lines.push(`  ${commands[0]}    # 先核对将发送的请求，不联网不写盘`);
    lines.push(`  ${commands[1]}    # 真正调用 DashScope（异步创建+轮询，按次计费）`);
  } else {
    lines.push('下一步：该资产还不能批量生成（缺 model/size/resolution/duration/firstFrame/master 等字段，或首帧未就绪）；');
    lines.push(`        按 ${docsForAsset(asset)} 核对字段与前置产物，修正 assets.json 后重跑。`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) printHelpAndExit();

  const root = findRepoRoot(opts.root);
  const docsDir = path.join(root, 'docs', 'hero-visual');
  const manifestAbs = path.join(docsDir, 'assets.json');
  const manifestRel = 'docs/hero-visual/assets.json';

  if (!isDir(docsDir)) {
    if (opts.json) {
      emitJson(
        {
          ok: false,
          root,
          manifest: manifestRel,
          error: 'docs-dir-missing',
          message: `项目根下不存在 docs/hero-visual：${docsDir}`,
          hint: '确认在项目根运行，或用 --root 指定；docs/hero-visual 由文档任务产出。',
        },
        EXIT_ENV,
      );
    }
    process.stderr.write(`未找到文档目录：${docsDir}\n`);
    process.stderr.write('确认在项目根运行（含 package.json 与 scripts/hero），或用 --root 指定。\n');
    process.exit(EXIT_ENV);
  }

  if (!fs.existsSync(manifestAbs)) emitManifestMissing(root, manifestRel, opts.json);

  let raw;
  try {
    raw = fs.readFileSync(manifestAbs, 'utf8');
  } catch (error) {
    process.stderr.write(`读取 ${manifestRel} 失败：${error.message}\n`);
    process.exit(EXIT_STRUCT);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    const message = `${manifestRel} 不是合法 JSON：${error.message}`;
    if (opts.json) {
      emitJson({ ok: false, root, manifest: manifestRel, error: 'invalid-json', message }, EXIT_STRUCT);
    }
    process.stderr.write(`${message}\n`);
    process.stderr.write('提示：检查尾随逗号/注释（JSON 不支持注释）或让 Lead 重新合并生成。\n');
    process.exit(EXIT_STRUCT);
  }

  const validation = validateManifest(manifest, root);
  const progress = buildStageProgress(manifest, validation.stages, validation.assets);
  const nextInfo = pickNext(manifest, validation.assets, validation.stages);

  let exitCode = EXIT_OK;
  if (validation.errors.length > 0) exitCode = EXIT_STRUCT;

  if (opts.json) {
    const next = nextInfo.done
      ? null
      : (() => {
        const described = describeNext(nextInfo.asset, new Map(validation.assets.map((asset) => [asset.id, asset])), validation.stages, root);
        if (described && nextInfo.blocked) described.blocked = true;
        return described;
      })();
    emitJson(
      {
        ok: validation.errors.length === 0,
        root,
        manifest: manifestRel,
        version: manifest.version,
        counts: {
          assets: validation.assets.length,
          complete: validation.assets.filter((asset) => asset.complete).length,
          pending: validation.assets.filter((asset) => !asset.complete).length,
          errors: validation.errors.length,
          warnings: validation.warnings.length,
        },
        errors: validation.errors,
        warnings: validation.warnings,
        stages: progress,
        assets: validation.assets,
        next,
      },
      exitCode,
    );
  }

  printHumanReport({ root, manifestRel, manifest, validation, progress, nextInfo, opts });
  process.exit(exitCode);
}

main();
