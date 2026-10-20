---
name: hero-visual
description: Hero 视觉全流程执行手册（滑板少女 + 新海诚积云 + 毛玻璃 hero）：千问 Qwen-Image 3.0 生图 12 张（角色卡/7 网页图/4 关键帧）/ 万相 2.7 异步生视频 4 段 / 前端集成 / 验收。触发词：Hero 视觉、Qwen-Image、千问提示词、万相、Wan、毛玻璃、hero 视频、12 张图、滑板少女、新海诚、积云、角色卡、关键帧、poster、glassmorphism。
---

# Hero 视觉技能（hero-visual · 千问原生 API 版）

本技能把「AI 简历网站 Hero 视觉方案」变成可在本项目内直接执行的 runbook：每一阶段有明确输入、
命令、输出路径和 gate（通过条件）。阶段未过 gate 不要进入下一阶段。

## 何时使用

- 要生成/重生 Hero 图片（角色卡、7 张网页图、4 张视频关键帧）。
- 要生成/重生成 Hero 视频（Shot A/B/C、天空 loop）并剪辑导出。
- 要把新素材接入首屏（`Hero.tsx` / `HeroVideo.tsx` / `app/globals.css`）。
- 要做 Hero 验收、排障、检查环境或资产完成度。
- 用户提到：Hero 视觉、Qwen-Image、千问提示词、万相、毛玻璃、hero 视频、角色卡、关键帧、poster。

## 项目现状（以命令与文件系统为准，不要凭记忆）

- Claude Code 模型固定 `qwen3.8-max`，走 DashScope Anthropic 兼容端点；项目 `.claude/settings.json`
  由 Lead 维护（只读），密钥由 `.claude/settings.local.json` 提供（`scripts/hero/setup-claude.ps1` 写入）。
- 生成走 DashScope 云端 API（**无本地 GPU**）：
  - 图像 `qwen-image-3.0-pro`（备选 `qwen-image-3.0` / `qwen-image-2.1-pro`）：原生异步任务
    `POST /api/v1/services/aigc/image-generation/generation` + 轮询 `/api/v1/tasks/{id}`；
  - 视频 `wan2.7-i2v` / `wan2.7-t2v`：异步任务 `POST /api/v1/services/aigc/video-generation/video-synthesis`
    + 轮询 `/api/v1/tasks/{id}`。
  - 结果 URL 仅 24h 有效，批量脚本会立即下载落盘。
- 环境：Node 24 / npm 11；本机无 ffmpeg（可选备选，主路径剪映/PR 剪辑）；`doctor.cmd` 给出 WARN/FAIL。
- 文档：`docs/hero-visual/00-INDEX.md`、`01-visual-bible.md`、`02-qwen-images.md`、`03-qwen-video.md`、
  `04-frontend-integration.md`、`05-acceptance.md` 均已就位，按索引读。
- 提示词在 `docs/hero-visual/prompts/{image,video}/`，具体路径以 `assets.json` 的 `prompt`/`negative` 字段为准。
- 资产清单：`docs/hero-visual/assets.json`（v2，Lead 合并生成，**勿手改**）：12 图 + 4 视频，id 形如
  `qwen-00-character`、`qwen-01`…`qwen-07`、`qwen-kf-a/b/c/sky`、`wan-shot-a/b/c`、`wan-loop`。

## 必读顺序（不要跳，也不要一次读完整旧备份）

1. `CLAUDE.md`（项目根；注意 Next.js 16 破坏性变更与硬规则）。
2. `docs/hero-visual/00-INDEX.md`：文档索引 + 阶段路线 + 当前进度，先读它再决定读哪一篇。
3. `docs/hero-visual/01-visual-bible.md`：唯一事实源（角色卡、7 色 token、材质、构图、安全区、统一风格词、
   资产编号与路径映射、不可违反清单）。任何文档冲突时以它为准。
4. 对应阶段文档：
   - S1/S2/S3（图片 + 关键帧）：`docs/hero-visual/02-qwen-images.md`
   - S4/S5（视频 + 剪辑）：`docs/hero-visual/03-qwen-video.md`
   - S6（前端）：`docs/hero-visual/04-frontend-integration.md`
   - S7（验收）：`docs/hero-visual/05-acceptance.md`
5. 提示词 `docs/hero-visual/prompts/{image,video}/*.txt`：逐字使用，不手打、不改写、不翻译。
6. 旧版工具链文档已归档到 `docs/hero-visual/_archive/`（只作历史参考，**不要执行**）。

## 阶段与 gate

| 阶段 | 名称 | 主要动作 | 执行入口 | gate（全部满足才算过） |
|---|---|---|---|---|
| S0 | 环境与 API 自检 | PowerShell/Node/npm/key/Base URL 连通性/参考素材/清单 | `scripts/hero/doctor.cmd` | doctor 无 FAIL（WARN 需人工确认） |
| S1 | 参考素材整理 | 确认 `design/UI_ref.jpg`、`design/滑板少女.mp4`；需要时抽帧到 `design/source/frames/` | `02-qwen-images.md` §1 | 参考素材只读就位；抽帧清晰无水印 |
| S2 | 角色卡（4 seed，T2I） | 4 个 seed 出正面角色卡 → 客户确认 → 定稿 `design/source/refs/character_front.png` | 子代理 `qwen-image-artist` | 客户确认 `character_front.png`（脸一旦定稿不再换） |
| S3 | 7 张网页图 + 4 张关键帧（I2I） | 按 `02-qwen-images.md` 逐张生成 + 同名参数 txt | 子代理 `qwen-image-artist` | 11 张全部通过「10 秒验收」；关键帧精确 16:9 |
| S4 | 万相 4 段视频（i2v） | Shot A/B/C + 天空 loop，首帧=对应关键帧、loop 首尾同图 | 子代理 `qwen-video-artist` | 1080P、5/6/5/5s、首帧=关键帧、主体不进中心 |
| S5 | 剪辑/导出 | 剪映/PR 拼接、交叉淡化、H.264 1080p 导出（ffmpeg 仅备选） | 子代理 `qwen-video-artist` | 15–18s、无音轨、循环无跳帧、`public/hero/*` 齐全 |
| S6 | 前端集成 | 新版式 + 视频多 source + 玻璃卡片 token | 子代理 `hero-frontend` | `npm run build` 通过 + 1440/768/375 三档截图 |
| S7 | 总验收 | 按 05 清单逐条验、留证、签字 | 子代理 `visual-qa` | `05-acceptance.md` 全部通过 |

阶段顺序固定 S0→S7；S3 与 S4 可在 S2 之后部分并行（视频是瓶颈，可先跑关键帧与视频），
但**视频定稿前不要锁定 hero 最终配色**。

## 全局硬规则（违反即返工）

1. **无帽**：源片没有草帽，「宽檐」是风吹短发 + 逆光发丝；角色卡与所有提示词禁止帽子/头饰/耳机抢戏配饰，
   负向必须含帽子/头饰类词（以 `prompts/image/*.neg.txt` 为准）。
2. **画面内不生成任何文字**：字幕、水印、logo、二维码、UI 文案一律禁止（毛玻璃会把它们糊成脏斑）。
3. **构图**：主体（少女/滑板）占右侧 1/3；左侧 55%~60% 给玻璃卡片与文案；中心 60%×50% 安全区只允许
   天空/云/远山/浅景深虚化——低对比、低细节、慢运动。
4. **安全区可读性**：铺玻璃卡片后正文对底层画面对比度 ≥4.5:1；不够先加深 scrim，再考虑给文字加 1px
   `rgba(0,0,0,.25)` 外发光。
5. **色板统一**：`--hero-sky #1A6BD6` / `--hero-cloud #F4F8FC` / `--hero-sun #FFE9B0` /
   `--hero-chrome-1..3 #F7F9FA→#C9D2D9→#8E9AA4` / `--hero-pink #E5355B` / `--hero-ink #0E1B2A`，
   灰蓝环境底 `--hero-grey-blue #8E9AA1`；CTA 唯一派生色 `--hero-pink-cta #D01E48`（白字 5.30:1，仅按钮底）。
   提示词里直接写对应物（pink glowing sphere、chrome torus ring），不要后期硬调。
6. **提示词逐字复制**：正向/负向一律从 `docs/hero-visual/prompts/{image,video}/*.txt` 读取，
   路径以 `assets.json` 的 `prompt`/`negative` 字段为准；不手打、不转抄、不翻译。
7. **素材路径只用项目内相对路径**（见下表），不要把外部盘符路径写进脚本/文档/提示词。
8. **不跨工具借素材**：不要拿视频成片直接做 I2I 参考（压缩噪点 + 运动模糊会污染）；关键帧用
   Qwen-Image I2I 生成，不依赖视频抽帧。
9. **参考素材只读**：`design/UI_ref.jpg`、`design/滑板少女.mp4` 不删不改；旧主题产物
   `public/hero/*`、`public/art/*` 在新资产验收通过前不删除。
10. **视频**：1080P、整数秒 5/6/5/5（API 只收 2–15 整数秒）、无音轨、首帧精确 16:9、
    `prompt_extend=false`、`watermark=false`、循环段首尾同图 + 交叉淡化；网页视频 5–8 Mbps。
11. **不改范围**：不改 `.env.local`、`lib/`、依赖版本；不 `git commit`；只改当前任务声明的文件。
12. **不编造**：参数、seed、尺寸、模型名、时间线以 `docs/hero-visual/` 与 `assets.json` 为准；
    源方案没有的写「待确认（需客户/环境）」，不虚构数字；密钥不进文档、不打印。

## 路径约定（项目内，产物未生成时按此创建）

| 用途 | 项目相对路径 |
|---|---|
| 只读参考素材 | `design/UI_ref.jpg`（版式参考）、`design/滑板少女.mp4`（角色/场景参考） |
| 抽帧（可选，用于 I2I 参考） | `design/source/frames/` |
| 角色卡定稿 | `design/source/refs/character_front.png` |
| Qwen 图像母版 + 同名参数 txt | `design/source/qwen/` |
| 万相视频母版 + 同名参数 txt | `design/source/wan/` |
| 网页视频 | `public/hero/hero.mp4`、`hero-720p.mp4`、`hero-9x16.mp4`、`hero-1080.webm`（可选）、`poster.jpg` |
| 功能图 / 分享图 | `public/art/feature-parse.jpg`、`feature-templates.jpg`、`feature-future.jpg`、`about-portrait.jpg`、`ui-kit.png`、`public/og-hero.jpg` |
| 提示词 | `docs/hero-visual/prompts/image/*.txt`、`docs/hero-visual/prompts/video/*.txt` |
| 资产清单 | `docs/hero-visual/assets.json`（Lead 合并生成，勿手改） |

## 常用命令

```bash
# S0 环境自检（3 s/项超时；网络探测 8 s；无 FAIL 才继续）
scripts/hero/setup-claude.cmd     # 配置 .claude/settings.local.json 的 key 并实测（首次）
scripts/hero/doctor.cmd
scripts/hero/doctor.cmd -Json
scripts/hero/doctor.cmd -ImageSmoke   # 可选：真实生成 1 张 1024*1024 验证 API（计费很小，默认不跑）

# 资产清单：结构校验 / 下一个待办 / JSON（v2：16 资产 / 8 阶段）
node scripts/hero/assets-check.mjs
node scripts/hero/assets-check.mjs --next
node scripts/hero/assets-check.mjs --json

# 图像批量（DashScope 原生异步）：默认 dry-run（只打印请求，不联网不写盘）；--run 才创建任务并计费
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --run
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --run   # 4 seed 角色卡
node scripts/hero/qwen-image-batch.mjs --run --force                   # 覆盖已有母版（谨慎）

# 视频批量（万相异步）：15s 轮询，单段最长 20min
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run
```

脚本退出码：`0` 通过/仅 pending，`1` 结构或执行错误，`2` 环境/密钥缺失，`3` API 调用失败。
所有脚本从任意 cwd 可运行（自动定位项目根）；`--help` 查看完整参数。

`qwen-image-batch` 的边界：只处理 model 以 `qwen-image` 开头的 image 资产；3.0 系参考图最多 3 张；
`size` 内部按 DashScope 协议发 `宽*高`；已存在母版不加 `--force` 会跳过；旧版非 Qwen 资产会明确跳过。
`qwen-video-batch` 的边界：只处理 `wan2.7-*`；i2v 必须有 `firstFrame`，loop 首尾同图；时长整数秒 2–15。

## 汇报格式

开工时先发 5 行，让人知道你要做什么、是否具备条件：

```text
1. 阶段：S3 / 资产：qwen-02
2. 目标：按 02 文档生成 AI 解析简历图，母版落 design/source/qwen/
3. 输入就绪：doctor 无 FAIL；DASHSCOPE_API_KEY 已配置；参考图 character_front.png / ref_2_t4.jpg 存在
4. 命令：node scripts/hero/qwen-image-batch.mjs --only qwen-02 --dry-run → 确认后 --run
5. 预计验收：10 秒验收 6 项（构图/手/色温/无文字/同角色/参数 txt 落盘）
```

交付时给清单，每条都有证据（文件路径 + 校验方式 + 结论）：

```text
| 资产 | 产出路径 | 证据 | 结论 |
| qwen-02 | design/source/qwen/003-feature-parse_s20261102.png | 1920×1080；同名 .txt 含 task_id/usage | PASS |
```

收尾必须回答：① 本次过了哪个 gate；② 有哪些 WARN/待客户确认；③ 下一阶段入口。
不要用「已完成」三个字代替证据。

## 子代理（`.claude/agents/`）

- `qwen-image-artist`：S2/S3 图片生产，写 `design/source/qwen/`、`design/source/refs/`。
- `qwen-video-artist`：S4/S5 视频生产与剪辑导出，写 `design/source/wan/`、`public/hero/`。
- `hero-frontend`：S6 前端集成，只改 Hero 相关组件与 `app/globals.css`。
- `visual-qa`：S7 只读验收，产出验收记录与 PASS/FAIL 结论，不改文件。

## 警告

- **不要一次性把旧备份方案全文读入上下文**（约 1637 行）。先读 `docs/hero-visual/00-INDEX.md`，
  再按需用 offset/limit 读对应章节；只有排查文档冲突时才回读旧备份。
- **旧备份是历史资料，不是任务书**：旧工具链的参数/节点/价格一律不再适用。
- **结果 URL 仅 24h 有效**：脚本会立即下载；人工在控制台生成也要马上转存。
- **模型有概率性**：同 seed 不保证像素级一致；一致性靠角色卡 + 参考图（≤3 张）+ 固定提示词。
- **计费保护**：任何 `--run` 前先 `--dry-run` + 人工确认；不写具体价格，以百炼控制台为准；
  失败先修因再重跑，不盲目重试计费。
- **角色卡没确认前不要批量出图**：脸定稿是全站一致性的前提（S2 gate）。
- **本机无 ffmpeg 不是阻塞**：S4 出片走 API；S5 用剪映/PR，ffmpeg 仅备选。
