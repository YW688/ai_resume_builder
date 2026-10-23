# CLAUDE.md — AI 简历编辑器 · Hero 视觉重制（千问原生 API 版）

本项目是面向国内求职者的**中文 AI 简历编辑器**（Next.js 16.4.2 App Router + React 19.3 + Tailwind 4 + TypeScript）。
本文件是给 Claude Code（VS Code 扩展 / CLI，模型固定 **千问3.8-Max**）的项目记忆。与任务无关的改动一律不做。

> **工具链已变更（2026-10-20）**：视觉资产不再使用 SD WebUI / ComfyUI / 本地 GPU，改为**阿里云百炼 DashScope 原生 API**：
> 图像 **Qwen-Image 3.0**（`qwen-image-3.0-pro`，T2I + I2I 参考图），视频 **万相 2.7**（`wan2.7-i2v` / `wan2.7-t2v`，异步任务）。
> 旧 SD/ComfyUI 章节与脚本已作废，看到它们一律忽略（档案在 `docs/hero-visual/_archive/`）。

---

## 0. 模型与接口（已固定，不要改）

- **Claude Code 模型**：`qwen3.8-max`（DashScope 的 Anthropic 兼容端点），项目级 `.claude/settings.json` 已固定。
- **生成 API 密钥**：`DASHSCOPE_API_KEY`（与 `ANTHROPIC_AUTH_TOKEN` 同值），由 `scripts/hero/setup-claude.cmd` 写入 `.claude/settings.local.json`（已 gitignore）。
- 自检：`scripts/hero/setup-claude.cmd`（会补 key 并实测 Anthropic 端点）；`scripts/hero/doctor.cmd`（检查 key / 素材 / 目录 / 可选 API 连通）。
- **不要**把密钥写进任何会被 git 跟踪的文件；**不要**修改用户级 `~/.claude/settings.json`；**不要**切换模型。

## 1. 当前任务：Hero 视觉重制（滑板少女 + 玻璃拟态，千问生成）

- 参考素材（只读）：`design/UI_ref.jpg`（MOONLITE 版式，只学版式/材质）、`design/滑板少女.mp4`（608×1092 / 16.9s，角色与场景事实来源）。
- 产物：**角色卡 1 张 + 7 张网页图 + 4 张视频关键帧 + 4 段视频（3 镜头 + 1 天空 loop）**，再接入前端。
- 完整方案与执行手册在 `docs/hero-visual/`；**不要通读 127KB 旧方案**，按 `00-INDEX.md` 索引读。

## 2. 必读顺序（按需读，不要一次全读）

1. `docs/hero-visual/00-INDEX.md` —— 索引、阶段、命令、当前状态
2. `docs/hero-visual/01-visual-bible.md` —— **唯一事实源**（角色 / 色板 / 构图 / 安全区 / 风格词）
3. 当前阶段文档：`02-qwen-images.md`（S1–S3 + 视频关键帧）｜ `03-qwen-video.md`（S4–S5）｜ `04-frontend-integration.md`（S6）｜ `05-acceptance.md`（S7）
4. `docs/hero-visual/assets.json` —— 机器可读资产清单（批量脚本的输入）
5. `AGENTS.md` —— Next.js 16 有破坏性变更；写代码前先读 `node_modules/next/dist/docs/`
6. `plan.md` —— 产品事实 / 文案 / 合规约束（文案只能基于它，不编造）

## 3. 阶段与 gate（严格按序，gate 不过不进下一步）

| Stage | 内容 | Gate（判定标准） |
|---|---|---|
| S0 | 环境与 API 自检 | `doctor.cmd` 无 FAIL；`setup-claude.cmd` 实测 PASS |
| S1 | 参考素材整理 | `design/UI_ref.jpg`、`design/滑板少女.mp4` 就位；如需参考帧，抽帧到 `design/source/frames/` |
| S2 | 角色卡（4 seed） | **用户/客户确认** `design/source/refs/character_front.png` |
| S3 | 7 张图 + 4 张视频关键帧 | 11 张全部通过 10 秒验收（见 02 文档） |
| S4 | 万相 4 段视频 | 1080P、时长符合（5/6/5/5s）、首尾帧闭合、主体不进中心 |
| S5 | 剪辑 / 导出 | 15–18s、无音轨、H.264、循环无跳帧、体积达标（见 03 文档） |
| S6 | 前端集成 | `node scripts/hero/verify-web-assets.mjs` **0 FAIL** + `npm run build` 通过 + 375/768/1440 三档截图（截图里视频必须真在播，不能只有 poster） |
| S7 | 总验收 | `05-acceptance.md` 清单全过 |

## 4. 常用命令

```powershell
scripts/hero/setup-claude.cmd                     # 首次：配置 key 并实测
scripts/hero/doctor.cmd                           # 环境/API/素材自检（Git Bash / PowerShell / cmd 通用）
node scripts/hero/verify-web-assets.mjs            # 网页视频/封面证据化验收（编码/分辨率/音轨/MD5/体积）
node scripts/hero/assets-check.mjs --next         # 下一个待办资产
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run   # 默认 dry-run
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --run       # 真正调用（计费）
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run
npm run build                                     # 必须通过
npm run dev                                       # 本地预览
npx tsc --noEmit                                  # 类型检查
```

- 技能：`hero-visual`；命令：`/hero-status`、`/hero-next`、`/hero-verify`
- 子代理：`qwen-image-artist`（S2–S3）、`qwen-video-artist`（S4–S5）、`hero-frontend`（S6）、`visual-qa`（S7）

## 5. 路径约定（项目内相对路径）

| 用途 | 路径 |
|---|---|
| 参考素材（只读） | `design/UI_ref.jpg`、`design/滑板少女.mp4` |
| 抽帧（可选） | `design/source/frames/` |
| 角色卡定稿 | `design/source/refs/character_front.png` |
| Qwen 图像母版 PNG | `design/source/qwen/`（同名 `.txt` 记录 prompt/refs/参数） |
| 万相视频母版 MP4 | `design/source/wan/`（同名 `.txt`） |
| 网页图片 | `public/hero/{poster.jpg,mobile-cover.jpg}`、`public/og-hero.jpg`、`public/art/{feature-parse,feature-templates,feature-future,about-portrait}.jpg`、`public/art/ui-kit.png` |
| 网页视频 | `public/hero/{hero.mp4,hero-720p.mp4,poster.jpg}`（**已交付**，H.264/无音轨/faststart）；`hero-9x16.mp4` 可选未生成，移动端由 `mobile-cover.jpg` 兜底 |
| 提示词 | `docs/hero-visual/prompts/image/*.txt`、`prompts/video/*.txt` |
| 资产清单 | `docs/hero-visual/assets.json`（v2，Lead 合并，勿手改） |

## 6. 不可违反（硬规则）

1. **角色锚点**：棕色短发（**无帽**）+ 淡蓝宽袖衬衫 + 芥末黄滑板 + 白袜白鞋；负向压 `帽子/头饰/耳机`。发丝可随风变，帽子一律重跑。
2. 生成画面中**不允许文字/字幕/水印/logo/二维码/UI 边框**；文字与 UI 由前端/Figma 叠。Qwen 很会渲染文字，反而更要压住。
3. **构图**：桌面 16:9，主体在右 1/3；中心 60%×50% 安全区只许低对比天空/云/远城。
4. **色板**：只用 `#1A6BD6 / #F4F8FC / #FFE9B0 / #F7F9FA→#C9D2D9→#8E9AA4 / #E5355B / #8E9AA1 / #0E1B2A`；唯一派生色 `--hero-pink-cta: #D01E48` 仅 CTA 底色。
5. **玻璃卡片**：`blur(28px) saturate(1.35)` + 白 10% 底 + 35% 描边 + 内顶高光；正文对底图对比度 ≥4.5:1；`@supports` 兜底。
6. **视频**：1080P（主源）/720P（≤1023px 兜底）、约 13–18s、**无音轨**、**H.264**（HEVC 一律不可交付，Firefox 不可播）、faststart、无缝循环；`prefers-reduced-motion` 暂停并显示 poster；移动端由 `mobile-cover.jpg` 兜底。**任何视频替换后必须跑 `verify-web-assets.mjs`。**
7. **文案**：只能基于 `plan.md` 的产品事实；不编造用户数/融资/评价/客户 logo，不承诺「100% 通过」，示例数据标「示例」。
8. **API 纪律**：`watermark:false`；图像 `size` 在请求里用 `宽*高`（DashScope 协议，`*` 不是 `x`；assets.json 存 `宽x高`，由脚本转换）；参考图 ≤3 张；视频 `duration` 只能是 2–15 的**整数秒**；结果 URL 仅 24h，必须立即下载；不编造价格，按百炼控制台为准。
9. **工程边界**：不改 `.env.local`、`lib/`、`app/api/`、认证/支付/数据库逻辑；不新增依赖（确有需要先说明理由）；不 `git commit/push`；不删除现有文件。
10. **待确认项**：角色卡需客户确认；成片是否全生成 / 是否用源片实拍段；如源方案标注「待确认」，不得自行拍板后批量生产。

## 7. 工作方式

- 开工先给 **5 行方案**（当前 S 阶段 / 目标资产 / 输入就绪情况 / 命令 / 预计验收），再执行。
- 每次只推进一个 stage；长任务用子代理并行，但不要并行写同一个文件。
- 每完成一个资产，更新 `docs/hero-visual/assets.json` 中该资产的 `status` 与 `evidence`。
- 遇到环境缺失（无 key / API 402 欠费 / 无 ffmpeg / 无剪映）：`doctor.cmd` 会报，先如实报告并给降级路径，**不要静默跳过或伪造产物**。
- 交付前必须：`assets-check.mjs` 无结构错误、`npm run build` 通过、`05-acceptance.md` 逐条打勾、给出三档截图。
- 汇报格式：改了什么 / 产物路径 / 验证命令与结果 / 风险与未完成（≤3 条）。

## 8. 已知限制（2026-10-20 核实）

- **ffmpeg 已可用**（winget 安装：`C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-9.0.2-full_build\bin`）：转码/抽帧/验收跑脚本时直接用；**逐镜头剪辑主路径仍推荐剪映 / Premiere / DaVinci**（导出 H.264 1080p 30fps、去音轨）。
- 生成是**按次计费**的云 API：先各跑 1 张 / 1 段试水，确认风格与成本后再批量；失败重试每次只改一个变量。
- 生成有概率性：同一 seed 也不保证完全一致；一致性靠「角色卡 + 参考图（I2I）+ 固定提示词」，不追求像素级复刻。
- 旧主题产物（`public/hero/*`、`public/art/*` 旧图）在新资产验收通过前**不删除**，S6 时再切换引用。
- 旧 SD/ComfyUI 文档与脚本已归档到 `docs/hero-visual/_archive/`，只作历史参考，**不要执行**。

## 9. 成本与 token 纪律（每次开工先读）

- **生成前必须**：`--dry-run` 看请求 → 只改一个变量 → 先跑 1 张/1 段试水（图用 1024/1k 档、视频用 720P 5s）→ 人眼验收 → 才批量。
- **任何 `--run` 之前**：输出「预计调用数 × 单价 + 试水方案 + 停止条件」，用户确认后再执行；单任务建议上限：图 ≤10 次、视频 ≤4 段。
- **不抽卡**：同 seed 重跑不超过 2 次；仍不满意就改提示词（如手部改为“手插兜/遮挡”规避），不要连续盲试。
- **本地零成本操作优先**：图片转码/压缩、视频拼接、导出、清理、验收截图全部用脚本（`scripts/hero/*`、剪映），不消耗 API、不让模型现场写代码。
- **省 token**：只读当前阶段文档（不要整读 `docs/hero-visual` 或 127KB 源方案）；大文件用 `grep`/`read offset` 定位；脏活交子代理并只要摘要；长任务阶段间 `/clear`；机械任务换 `qwen3.8-flash` / `qwen3.7-plus`。
- **改文件**：局部用 `edit`，不要整文件 `Write`；内容变了换新文件名（防缓存），再同步引用。
- **环境**：dev（3000）改动不等于生产（3100）生效；生产必须 `npm run build` 后重启 `next start`。
- **记账**：每完成一批，把「模型/尺寸/时长/次数/是否返工」记入 `docs/PROJECT_RETRO_2026-10-20.md` 的台账；每周用百炼账单 + `/cost` 对账。

