# 00 · Hero 视觉执行套件 · 总索引（千问原生 API 版 v2）

> 面向：**Claude Code（VS Code 扩展 / CLI，模型固定 千问3.8-Max `qwen3.8-max`）** 与本项目的人类审看者。
> 生成工具链：**阿里云百炼 DashScope** —— 图像 `qwen-image-3.0-pro`（T2I/I2I），视频 `wan2.7-i2v` / `wan2.7-t2v`。
> 当前状态：文档与提示词已按千问 API 重写；**视觉产物为 0**，旧主题 hero 仍在线（新素材验收后再切换）。
>
> ⚠️ **开源仓库说明**：`design/`（参考视频、角色卡、生成母版、QA 截图）因体积与第三方版权原因**未包含在本仓库中**。本文档中的 `design/...` 路径需你自备素材；如需复现，请先阅读 `01-visual-bible.md` 并准备自己的参考素材与 DashScope API Key（按次计费）。`public/hero/*`、`public/art/*` 是已交付的成品，可直接运行站点。

---

## 1. 60 秒上手

### 方式 A：VS Code + Claude Code（推荐）

1. VS Code 打开仓库根目录（`<repo-root>`），首次弹 **Trust this workspace** 时点信任。
2. 输入：`/hero-next`（或「按 docs/hero-visual/00-INDEX.md 开始 Hero 视觉任务」）。
3. Claude 会按 `CLAUDE.md`：先给 5 行方案 → `scripts/hero/doctor.cmd` → 读阶段文档 → dry-run → 经你确认后 `--run`（计费）。

### 方式 B：终端

```powershell
cd <repo-root>
scripts/hero/setup-claude.cmd    # 首次：写 key 并实测
claude
```

### 方式 C：人直接做

- 生图：`02-qwen-images.md`
- 生视频：`03-qwen-video.md`
- 改前端：`04-frontend-integration.md`
- 验收：`05-acceptance.md`

---

## 2. 两个模型，别混

| 用途 | 模型 | 接入 | 计费 |
|---|---|---|---|
| Claude Code 的「大脑」 | `qwen3.8-max` | DashScope Anthropic 兼容端点（`.claude/settings.json` 固定） | 按 token |
| 生图 | `qwen-image-3.0-pro`（备选 `qwen-image-3.0`、`qwen-image-2.1-pro`） | DashScope 异步接口 `/api/v1/services/aigc/image-generation/generation`（创建任务）+ `/api/v1/tasks/{id}` 轮询 | 按输出像素档（1k/2k） |
| 生视频 | `wan2.7-i2v`（图生视频）/ `wan2.7-t2v`（纯天空） | 异步任务 `/api/v1/services/aigc/video-generation/video-synthesis` + 轮询 | 按秒 × 分辨率档 |

- 密钥：`DASHSCOPE_API_KEY`（与 `ANTHROPIC_AUTH_TOKEN` 同值），由 `setup-claude.cmd` 写入 `.claude/settings.local.json`（gitignored）。
- 验证：`setup-claude.cmd` 实测 Anthropic 端点；`doctor.cmd -ImageSmoke` 可选实测 1 张图（会花少量费用，默认不跑）。
- **价格不写死**：所有成本以[百炼控制台价格页](https://help.aliyun.com/zh/model-studio/model-pricing)为准；批量前先各跑 1 张/1 段。

---

## 3. 文件清单

| 路径 | 作用 |
|---|---|
| `CLAUDE.md` | 项目记忆：模型、阶段 gate、10 条硬规则、路径、命令、汇报格式 |
| `.claude/settings.json` | 固定 qwen3.8-max + DashScope 端点 + 权限白名单 |
| `.claude/settings.local.json` | 本机密钥（gitignored，由 setup 脚本生成） |
| `.claude/skills/hero-visual/SKILL.md` | 技能入口：阶段表、硬规则、命令、子代理分工 |
| `.claude/skills/cost-guard/SKILL.md` | 付费生成前的成本闸门：先算钱、先试水、确认后再 `--run` |
| `docs/PROJECT_RETRO_2026-10-20.md` | 项目复盘：花销构成、踩坑、省钱四层策略、部署清单、台账模板 |
| `.claude/commands/{hero-status,hero-next,hero-verify}.md` | 三个斜杠命令 |
| `.claude/agents/{qwen-image-artist,qwen-video-artist,hero-frontend,visual-qa}.md` | 四个子代理 |
| `docs/hero-visual/00-INDEX.md` | 本文件 |
| `docs/hero-visual/01-visual-bible.md` | **唯一事实源**：角色卡、7 色 token、材质、构图/安全区、不可违反清单 |
| `docs/hero-visual/02-qwen-images.md` | 千问生图手册（S1–S3 + 4 张视频关键帧） |
| `docs/hero-visual/03-qwen-video.md` | 万相生视频手册（S4）＋ 剪辑导出（S5） |
| `docs/hero-visual/04-frontend-integration.md` | 前端集成（S6） |
| `docs/hero-visual/05-acceptance.md` | 验收清单（S7） |
| `docs/hero-visual/assets.json` | 机器可读资产清单（12 图 + 4 视频 + 8 阶段），批量脚本唯一输入 |
| `docs/hero-visual/prompts/image/*.txt` | 千问生图提示词（中文自然语言，正向/负向） |
| `docs/hero-visual/prompts/video/*.txt` | 万相生视频提示词（中文自然语言） |
| `docs/hero-visual/_fragments/*.json` | 合并前片段（中间产物，以 assets.json 为准） |
| `docs/hero-visual/_archive/` | 旧 SD/ComfyUI 版文档与脚本归档（**只作历史参考，不要执行**） |
| `scripts/hero/setup-claude.cmd` / `.ps1` | 写 key 并实测 Anthropic 端点 |
| `scripts/hero/doctor.cmd` / `.ps1` | 环境/API/素材自检（`-Json`、`-ImageSmoke` 可选） |
| `scripts/hero/assets-check.mjs` | 资产清单校验 / `--next` / `--json` |
| `scripts/hero/qwen-image-batch.mjs` | 按 assets.json 批量生图（默认 dry-run，`--run` 计费） |
| `scripts/hero/qwen-video-batch.mjs` | 按 assets.json 批量生视频（异步创建+轮询+下载） |

> 参考素材只读：`design/UI_ref.jpg`、`design/滑板少女.mp4`。**旧路径 `网站设计提示词/` 已不存在**，不要再引用。

---

## 4. 阅读地图

| 目的 | 读这些 |
|---|---|
| 直接开工 | `CLAUDE.md` → 本文件 §5 → `/hero-next` |
| 角色/配色/构图 | `01-visual-bible.md` §1–§6 |
| 出 7 张图 + 角色卡 + 关键帧 | `01` §2/§3/§5 → `02-qwen-images.md` → `prompts/image/` |
| 出 4 段视频 | `01` §4/§5 → `03-qwen-video.md` → `prompts/video/` |
| 改前端 | `04-frontend-integration.md` → `AGENTS.md`（Next.js 16 变更） |
| 验收/交付 | `05-acceptance.md` → `assets.json` |
| 回看旧方案 | `docs/hero-visual/_archive/`（仅考古）与工作区 `AI简历网站_Hero视觉提示词总方案_SD-ComfyUI_备份.md` |

---

## 5. 阶段路线与 gate

| Stage | 内容 | Gate | 入口 / 命令 |
|---|---|---|---|
| **S0** | 环境与 API 自检 | `doctor.cmd` 无 FAIL；`setup-claude.cmd` PASS | `scripts/hero/doctor.cmd` |
| **S1** | 参考素材整理 | `design/UI_ref.jpg`、`design/滑板少女.mp4` 就位；需要时抽帧到 `design/source/frames/` | `02` §1 |
| **S2** | 角色卡（4 seed，T2I） | **客户确认** `design/source/refs/character_front.png` | `02` §2 |
| **S3** | 7 张网页图 + 4 张关键帧（I2I） | 11 张全过 10 秒验收 | `02` §3–§4 / `05` A 组 |
| **S4** | 万相 4 段视频（i2v） | 1080P、5/6/5/5s、首帧=关键帧、主体不进中心 | `03` §2–§4 / `05` B 组 |
| **S5** | 剪辑/导出 | 15–18s、无音轨、H.264、循环无跳帧 | `03` §5 |
| **S6** | 前端集成 | `npm run build` 通过 + 三档截图 + 对比度达标 | `04` / `05` C 组 |
| **S7** | 总验收 | `05-acceptance.md` 全过并留证 | `/hero-verify` |

**顺序**：S0 → S1 → S2 → S3（关键帧）→ S4 → S5 → S6 → S7。S2 未确认不得批量生成。

---

## 6. 本轮关键决策（已裁决，不要再纠结）

| # | 问题 | 裁决 |
|---|---|---|
| 1 | 工具链 | **弃用 SD/ComfyUI/本地 GPU**，改百炼 API：图像 qwen-image-3.0-pro、视频 wan2.7 |
| 2 | 资产数量 | **12 图 + 4 视频**：角色卡 1、网页图 7、视频关键帧 4、视频 4（A/B/C/loop） |
| 3 | 为什么多 4 张关键帧 | 万相 i2v 必须有首帧；用 Qwen-Image I2I 生成比从视频抽尾帧更可控、且不依赖 ffmpeg |
| 4 | 视频时长 | API 只收 **2–15 整数秒**：A 5 / B 6 / C 5 / loop 5；剪辑叠化后 ≈15s（15–18s 区间内） |
| 5 | 一致性 | 角色卡定脸 + I2I 参考图（≤3 张）+ 固定提示词；**不追求像素级复现**（模型有概率性） |
| 6 | poster 来源 | `public/hero/poster.jpg` 优先成片 B 段 t≈6.5s 抽帧；SD 时代的 P1 职责改为 `public/og-hero.jpg` 兜底 |
| 7 | 色板 | 7 色 + 唯一派生 `--hero-pink-cta #D01E48`（CTA 底，白字 5.30:1） |
| 8 | 编码 | 本机无 ffmpeg → 主路径**剪映/PR** 导出 H.264 1080p 30fps 无音轨；ffmpeg 仅备选 |
| 9 | 参考素材 | 只用 `design/UI_ref.jpg`（版式）与 `design/滑板少女.mp4`（角色/场景）；水印"由 AI 修改"只作参考不进成片 |
| 10 | 旧套件 | 旧 SD/ComfyUI 文档、提示词、`sd-batch.mjs`、旧子代理归档到 `_archive/`，不执行 |
| 11 | 密钥 | `DASHSCOPE_API_KEY` 只落 `.claude/settings.local.json`（gitignored），不入库、不进文档 |
| 12 | 计费 | 不写具体价格；先单张/单段试水；失败重试每次只改一个变量 |

---

## 7. 源方案 → 本套件 映射

| 源方案章节 | 现在的位置 |
|---|---|
| 阅读指南 / §0 一页结论 / §3 资产清单 | `01` §0、§7；本文件 §5–§6 |
| §1 视觉圣经 | `01-visual-bible.md` §1–§6（保留，未改视觉事实） |
| §2 毛玻璃/CSS/视频规格 | `04-frontend-integration.md` §3–§7；`01` §4/§5 |
| §4 SD WebUI 提示词组 | **已替换为** `02-qwen-images.md` + `prompts/image/` |
| §5 ComfyUI 视频提示词组 | **已替换为** `03-qwen-video.md` + `prompts/video/` |
| §6 协同规则 | `01` §8（改为「角色卡 → 关键帧 → i2v」） |
| §7 验收 | `05-acceptance.md`（视频规格改 1080P/整数秒/剪映导出） |
| §8 交付命名 | `03` §5、`01` §7.3、`assets.json` |

原始 md 的新版在 `E:\Harness_workplaces\提示词优化\AI简历网站_Hero视觉提示词总方案.md`（旧 SD 版备份为 `..._SD-ComfyUI_备份.md`）。

---

## 8. 命令速查

```powershell
scripts/hero/setup-claude.cmd          # 首次：配置 key 并实测
scripts/hero/doctor.cmd                # 环境/API/素材自检
scripts/hero/doctor.cmd -Json          # 机读
scripts/hero/doctor.cmd -ImageSmoke    # 可选：真实生成 1 张图（计费）

node scripts/hero/assets-check.mjs
node scripts/hero/assets-check.mjs --next

node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --run
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --run   # 4 seed

node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run

npm run build
npm run lint
npx tsc --noEmit
```

退出码约定：`0` 通过/仅 pending；`1` 结构错误；`2` 环境/密钥缺失；`3` API 调用失败。

---

## 9. 已知限制

1. **本机无 ffmpeg**：视频剪辑/转码主路径是剪映/PR；`03` 里的 ffmpeg 命令仅给有环境的机器。
2. **按次计费**：图像按像素档、视频按秒计费；先试水再批量。
3. **24h URL**：生成结果链接 24 小时过期，脚本会立即下载；人工在控制台生成也要马上转存。
4. **概率性**：同 seed 也不保证完全一致；角色一致性靠参考图与角色卡，不追求逐像素复刻。
5. **参考素材是竖屏视频**：桌面 16:9 必须重新构图（I2I/扩展），不是直接裁切。
6. **首次 VS Code 需点一次 Trust**，权限白名单才生效（不影响模型与生成）。
7. **模型名/参数可能随百炼升级变化**：脚本均支持 `--model` 覆盖；以官方文档为准。

---

## 10. 维护规则

- **唯一事实源**：`01-visual-bible.md`。改角色/色值/构图，先改它，再同步下游与 `assets.json`。
- **提示词**：`prompts/**/*.txt` 是唯一可粘贴文本；改风格要全部同步，不要只改一张。
- **assets.json** 由 `_fragments/*.json` 合并生成；不要手改结构；每完成一个资产补 `status`/`evidence`。
- **不碰**：`.env.local`、`lib/**`、`app/api/**`、`design/` 参考素材、旧主题产物；不 `git commit`。
- **计费保护**：任何 `--run` 前先 `--dry-run` + 人工确认；批量失败不盲目重试。

---

## 11. 版本记录

| 日期 | 版本 | 内容 |
|---|---|---|
| 2026-10-20 | v1.0 | 旧版：SD WebUI + ComfyUI 提示词套件（已归档 `_archive/`） |
| 2026-10-20 | **v2.0** | 切换千问原生 API：Qwen-Image 3.0 生图（12 张）+ 万相 2.7 生视频（4 段）；新增批量脚本、新提示词、验收与成本纪律 |
