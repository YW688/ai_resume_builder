# 02 · Qwen-Image 生图手册（S1–S3 + 4 张视频关键帧）

> 版本 v2.0 · 2026-10-20 · 工具链：**Qwen-Image 3.0**（`qwen-image-3.0-pro`，T2I + I2I，参考图 ≤3 张）
> 适用阶段：S1（参考素材/抽帧）→ S2（角色卡）→ S3（7 张网页图 + 4 张视频关键帧）。
> 本文件是**执行手册**：怎么做、跑什么命令、产物落哪、怎么查、怎么验收。完整参数依据与逐字口径见 `_team/part_image.md` / 总方案 §4（Qwen 版）；视觉事实唯一事实源是 `01-visual-bible.md`。
> 路径约定：提示词与文档引用用相对本目录的裸路径（如 `prompts/image/01-hero-poster.pos.txt`）；涉及项目资产的路径相对仓库根（`.`）。
> **状态标记**：文中标「待生成」的路径当前不存在，是目标落盘位置；未标记的均为仓库已存在文件。
> 视觉底线：**棕色短发（无帽）+ 淡蓝宽袖衬衫 + 芥末黄滑板**三锚点、7 色 token、16:9、主体右 1/3、中心 60%×50% 低对比安全区、单一逆光、画面内禁止任何文字/水印/logo/二维码/UI 边框。

---

## 1. 这份文档怎么用

| 你要做的事 | 读这里 | 产物 |
|---|---|---|
| 准备参考帧（S1，可选） | §2.2、§4.0 | `design/source/frames/ref_*.jpg`（待生成） |
| 出角色卡、客户定脸（S2） | §3 | `design/source/qwen/001-character_s*.png`（待生成）→ `design/source/refs/character_front.png`（待生成） |
| 出 7 张网页图（S3） | §4.1–§4.4 | `design/source/qwen/002…008-*_s*.png`（待生成） |
| 出 4 张视频关键帧（S3 生成、S4 用） | §4.5 | `design/source/qwen/009…012-*_s*.png`（待生成） |
| 跑批量脚本 | §5 | `design/source/qwen/*.png` + 同名 `.txt` |
| 查文件/查 JSON/查尺寸 | §7 | 终端输出 |
| 出错/返工 | §8 | — |
| 阶段过关/交接 | §9、§10 | 联系表 + 验收记录 |

**一句话流程**：`doctor` → 抽帧（可选）→ S2 角色卡 4 张 → 客户确认 → S3 七张网页图 + 四张关键帧 → 联系表验收 → 交 S4（视频）/ S6（前端）。

---

## 2. 环境与前置检查

### 2.1 环境

| 项 | 要求 | 检查 |
|---|---|---|
| Node | Node 24（ESM） | `node -v` |
| 密钥 | `DASHSCOPE_API_KEY`（脚本从环境变量读，不写进文档/仓库） | `scripts/hero/doctor.cmd` |
| Base URL | 默认 `https://dashscope.aliyuncs.com`，可用 `DASHSCOPE_BASE_URL` 覆盖；地域与 Key 一致（北京） | `doctor.cmd` 连通性检查 |
| 脚本 | `scripts/hero/qwen-image-batch.mjs`（工具链已交付；用本文件 §4 的 12 个资产跑 dry-run 实测通过，共 15 个请求） | `node scripts/hero/qwen-image-batch.mjs --help` |
| 素材 | `design/UI_ref.jpg`、`design/滑板少女.mp4`（只读） | `doctor.cmd` |

### 2.2 参考帧（S1，可选但推荐）

本机**没有 ffmpeg**，用项目自带 Playwright 脚本抽帧：

```powershell
node scripts/peek_video.mjs "design/滑板少女.mp4" "design/source/frames/ref" 0.5,2,4,6,8
# 产出 design/source/frames/ref_0_t0.5.jpg、ref_1_t2.jpg、ref_2_t4.jpg、ref_3_t6.jpg、ref_4_t8.jpg（2026-10-20 已从 design/滑板少女.mp4 抽出，可直接用）
```

- **不要复用 `design/frames/ref_*.jpg`**：那是上一主题（少年/猫）参考片的抽帧，和本片不是同一素材；本方案只用从 `design/滑板少女.mp4` 新抽的 `design/source/frames/ref_*.jpg`。
- 水印「由 AI 修改」只作参考**不进成片**：I2I 参考图里的水印不会成为画面元素，负向文件已压文字/水印，出图后仍要检查边角。
- 参考帧是竖屏 608 宽，喂给 16:9 资产时以提示词构图为准（`prompt_extend=false`）。

---

## 3. S2：角色卡（定脸）

> 原片全片背面、没有正脸，所以正脸角色卡是「再创作」不是「还原」。这张必须先确认，后面 11 张才有同一张脸。

### 3.1 生成

```powershell
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --dry-run
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --run
```

| 项 | 值 |
|---|---|
| 模型 | `qwen-image-3.0-pro` |
| 尺寸 | `1024x1024` |
| seed | `20261020`、`20261021`、`20261022`、`20261023`（4 张） |
| refs | 无（T2I） |
| prompt_extend | `true` |
| negative_prompt | `prompts/image/00-character.neg.txt` |
| watermark | `false` |
| 正向 | `prompts/image/00-character.pos.txt` |
| 母版 | `design/source/qwen/001-character_s20261020.png` … `_s20261023.png`（待生成） |

### 3.2 选图

1. 4 张拼 2×2 对比（Windows 资源管理器预览即可，不必做联系表）。
2. 标准：邻家、可信、不网红；脸型/眼睛左右对称；**棕色短发、无帽**；淡蓝宽袖衬衫可辨认。
3. 选定后另存（PNG、1024 长边）：`design/source/refs/character_front.png`（待生成）。
4. 把选中的 seed 记进 `assets.json` 的 `qwen-00-character.evidence`（Lead 合并时补）。

### 3.3 Gate

- **客户确认**才算通过 S2；未确认不得批量出 S3。
- 确认后角色卡就是全站唯一面部锚点：不许换发色、换服装主色、换滑板颜色、加帽子/耳机。
- 4 张里 3 张以上出现帽子/帽子状发丝 → 先检查负向文件是否被改，再换 seed 重跑；不要后期抠图修。

---

## 4. 图像资产 runbook（S3）

### 4.0 统一参数与执行顺序

| 参数 | 值 |
|---|---|
| `model` | `qwen-image-3.0-pro`（试稿可临时 `--model qwen-image-3.0`） |
| `n` | `1`（要多候选就换 seed，别堆量） |
| `negative_prompt` | 各资产同名 `.neg.txt` |
| `watermark` | **`false`** |
| `prompt_extend` | T2I（角色卡/贴纸页/天空帧）`true`；I2I（网页图/人物关键帧）`false` |
| `seed` | 见 §4.1 表；固定 seed 只用于同构图复跑，**不保证像素级一致** |

执行顺序（不要乱序，前后有依赖）：

1. 角色卡（S2）→ 客户确认 → 存 `character_front.png`
2. `qwen-01` hero 海报 → 客户确认「与视频首帧无跳变」
3. `qwen-02`、`qwen-03` 功能图（玻璃/铬/粉的「AI 世界」语言）
4. `qwen-04`、`qwen-05`（人物亲和力 + 一致性）
5. `qwen-06` UI 贴纸页 → 交设计切图
6. `qwen-07` 移动端封面（最后做，复用海报结论）
7. `qwen-kf-a/b/c`、`qwen-kf-sky`（S3 末段一次出齐，交 S4）

### 4.1 七张网页图总表

| 资产 | 内容 | size | seed | refs | prompt_extend | 正向 / 负向 |
|---|---|---|---|---|---|---|
| `qwen-01` | hero 海报 | `1920x1080` | `20261101` | 角色卡 + `design/source/frames/ref_3_t6.jpg` | `false` | `01-hero-poster.pos/neg.txt` |
| `qwen-02` | AI 解析简历 | `1920x1080` | `20261102` | 角色卡 + `ref_2_t4.jpg` | `false` | `02-feature-parse.pos/neg.txt` |
| `qwen-03` | 模板/版式（3 块玻璃面板） | `1920x1080` | `20261103` | 角色卡 + `ref_1_t2.jpg` | `false` | `03-feature-templates.pos/neg.txt` |
| `qwen-04` | 职业未来 | `1920x1080` | `20261104` | `ref_4_t8.jpg` | `false` | `04-feature-future.pos/neg.txt` |
| `qwen-05` | About 人像 | `1152x1536` | `20261105` | 角色卡 | `false` | `05-about-portrait.pos/neg.txt` |
| `qwen-06` | UI 元素贴纸页 | `1024x1024` | `20261106` | 无（色彩参考 `design/UI_ref.jpg`） | `true` | `06-ui-stickers.pos/neg.txt` |
| `qwen-07` | 移动端封面 | `1080x1920` | `20261107` | `ref_4_t8.jpg` | `false` | `07-mobile-cover.pos/neg.txt` |

> 文件名前缀 `design/source/frames/` 省略；提示词前缀 `prompts/image/` 省略。

### 4.2 逐张执行要点（只写操作差异，画面细节看提示词文件）

**qwen-01 hero 海报**
- 跑完先和「视频首帧/关键帧 A」并排看：太阳位置、云型、色温一致才算过；留白亮度 65%~85%。
- 画面里**不要**铬环/粉球（那是功能图语言）；右侧 55%~60% 与中心安全区只放天空。
- 第一版建议 `n: 1`、固定 seed 出 2 次（seed 不变，看模型概率性差异），挑更稳的一张。

**qwen-02 AI 解析简历**
- 玻璃面板必须空白；出现可读字/段落/表格 → 换 seed 重跑（负向已压住，别继续加词）。
- 手与面板接触是重灾区：允许 3–5 次重跑；仍崩就简化（面板更少、手势更简单）。

**qwen-03 模板/版式**
- **恰好三块**面板是硬指标：多/少一块都重跑，不做后期擦除。
- 铬环/粉球各 1 个；堆多了变玩具感。

**qwen-04 职业未来**
- 只锁环境/服装/机位（背向镜头，不需要脸）；要「上升/希望」，不要黄昏告别感。
- 城市与海只留发光剪影，不要写实窗格；左上留白直接压标题与 CTA。

**qwen-05 About 人像**
- 这是客户「认人」的图：脸必须与角色卡一致（并排比对）；脸不像就回 S2 重选，不要单独硬调。
- 抱板姿势反复崩 → 改「滑板立身侧、轻扶板沿」，降低手部交互。

**qwen-06 UI 贴纸页**
- 纯物件页，无人物；4×3 网格、12 元素、不重叠、不切边、统一左上光源。
- 网格不听话 → 元素逐个单独生成再在 Figma 拼；玻璃元素只取形状/高光，真玻璃用 CSS `backdrop-filter`。

**qwen-07 移动端封面**
- 发顶落在 45% 线以下；上方 30%~35% 只有天空（给站点标识），底部 25% 低对比（压毛玻璃卡）。
- 与海报「同一天同一时刻」：云型/太阳高度/色温一致；用同一参考帧 + 相邻 seed。

### 4.3 导出与网页映射

| 母版 | 网页产物（相对仓库根，**待生成**） | 备注 |
|---|---|---|
| `002-hero-poster_s20261101.png` | `public/hero/poster.jpg`、`public/og-hero.jpg` | poster 优先成片 B 段 t≈6.5s 抽帧，本图兜底；OG 1200×630 中心裁切，标题前端叠字 |
| `003-feature-parse_s20261102.png` | `public/art/feature-parse.jpg` | 卡片内显示约 720×405 |
| `004-feature-templates_s20261103.png` | `public/art/feature-templates.jpg` | 三块面板必须清晰 |
| `005-feature-future_s20261104.png` | `public/art/feature-future.jpg` | 左上留白压标题/CTA |
| `006-about-portrait_s20261105.png` | `public/art/about-portrait.jpg` | 3:4，容器 `object-fit: cover` |
| `007-ui-stickers_s20261106.png` | `public/art/ui-kit.png` | 整页切图；单元素 512×512 @2x |
| `008-mobile-cover_s20261107.png` | `public/hero/mobile-cover.jpg` | 9:16 |

- 格式：sRGB、JPEG q88–92（PNG 兜底）；hero 另出 1920×1080 大屏版。
- 毛玻璃覆盖区导出前做局部对比压缩（亮度约 75%、轻微降饱和 5%），否则叠卡片后文字发灰。
- 文件名一旦确定不要改，前端 `04-frontend-integration.md` 按此引用。

### 4.4 S3 验收（七张 + 关键帧一起过）

- [ ] 锚点：短发（无帽）/淡蓝宽袖衬衫/芥末黄滑板；纯物件页、纯天空页除外且已压住人物
- [ ] 构图：主体右 1/3；中心 60%×50% 低对比；留白亮度 65%~85%
- [ ] 光照：单一逆光、积云塔、太阳低角度、长影方向一致
- [ ] 颜色：仅 §1 的 7 色（可含一个 `--hero-pink-cta #D01E48` 派生，但图里不引入新色相）
- [ ] **无文字/水印/logo/二维码/UI 边框**（200% 放大检查玻璃、路牌、衣角）
- [ ] 手/脸/板无结构性错误；无走光、无幼态化
- [ ] 12 张拼联系表：脸/云/太阳位置/色温跨图一致
- [ ] 与角色卡并排：同脸、同发色、同服装、同滑板色

### 4.5 S4 视频关键帧（由图像生成，视频只消费）

> 关键帧**在 S3 与七张网页图一起出**（00-INDEX §5 的 S3 gate 包含这 4 张）；S4 的万相 i2v 只读首帧，不再改图。本章不写视频参数（i2v 的模型/时长/分辨率和提示词见 `03-qwen-video.md` 与总方案 §5）。

| id | 用途 | size | seed | refs | prompt_extend | 母版（待生成） |
|---|---|---|---|---|---|---|
| `qwen-kf-a` | Shot A 首帧（hero 0–5s） | `1280x720` | `20261108` | 角色卡 + `ref_1_t2.jpg` | `false` | `design/source/qwen/009-keyframe-a_s20261108.png` |
| `qwen-kf-b` | Shot B 首帧（5–10s） | `1280x720` | `20261109` | 角色卡 + `ref_2_t4.jpg` | `false` | `design/source/qwen/010-keyframe-b_s20261109.png` |
| `qwen-kf-c` | Shot C 首帧（10–15s） | `1280x720` | `20261110` | 角色卡 + `ref_3_t6.jpg` | `false` | `design/source/qwen/011-keyframe-c_s20261110.png` |
| `qwen-kf-sky` | Loop 首/尾帧（首尾同图） | `1280x720` | `20261111` | 无（T2I） | `true` | `design/source/qwen/012-keyframe-sky_s20261111.png` |

操作要点：

1. 三张人物关键帧必须**精确 16:9（1280×720）**：万相 i2v 的宽高比以首帧为准，尺寸错了视频会被裁/被补边。
2. 画面要能承载「轻微推进/横移/上摇」：主体不贴边、不堵中心；镜头与上一镜无缝（B 比 A 更高更远，C 回眸把天空占比拉大）。
3. 天空关键帧用于 `wan-loop` 首帧与尾帧同图：左右均衡、无消失点、无地面/建筑。
4. 关键帧不做网页导出（`webOutputs: []`）；文件一落盘就通知视频负责人（`design/source/qwen/` 为准）。
5. 关键帧验收 = §4.4 全部 + 「与前后镜头人物/服装/滑板/云型连续」+「主体没被裁、机位不跳变」。首帧构图决定视频成败，问题在 S3 修，不要留到 S4。

---

## 5. 脚本用法

### 5.1 命令

```powershell
# 环境自检（不调付费接口）
scripts/hero/doctor.cmd
scripts/hero/doctor.cmd -Json

# 先看请求字段（默认就是 dry-run，不花钱）
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --dry-run
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run

# 单张真实调用（计费）
node scripts/hero/qwen-image-batch.mjs --only qwen-01 --run

# 角色卡 4 seed
node scripts/hero/qwen-image-batch.mjs --only qwen-00-character --run

# 多张
node scripts/hero/qwen-image-batch.mjs --only qwen-01,qwen-02 --run

# 全覆盖（慎用：确认资产清单后再跑）
node scripts/hero/qwen-image-batch.mjs --run
```

### 5.2 参数

| 参数 | 作用 |
|---|---|
| `--dry-run` | 默认行为：打印 model/size/n/seed/prompt_extend/refs 数量等，不调用 API |
| `--run` | 真实调用（**计费**，先 dry-run + 人工确认） |
| `--only id[,id]` | 只处理指定资产 |
| `--force` | 覆盖已存在母版（默认跳过已存在的，防误烧钱） |
| `--model` | 临时覆盖模型（试稿用 `qwen-image-3.0`） |
| `--root` | 覆盖项目根（默认当前目录） |

### 5.3 行为与退出码

- 读 `docs/hero-visual/assets.json`；`refs` 本地文件自动转 Base64 data URL；响应 PNG 的 24h URL **立即下载**落盘；每张母版旁写同名 `.txt`（prompt/negative/refs/model/size/seed/参数/生成时间）。
- 退出码：`0` 成功/仅跳过；`1` 结构错误（缺字段、JSON 解析失败）；`2` 环境问题（缺 `DASHSCOPE_API_KEY`、缺 prompt/ref 文件）；`3` API 调用失败（HTTP 非 2xx / 返回 `error`）。
- 脚本报「文件不存在」时：确认在项目根运行、`scripts/hero/qwen-image-batch.mjs` 存在；**不要临时写一套请求绕过**，先跑 `--dry-run` 定位是清单还是路径问题。

---

## 6. 输出路径与命名

```text
design/source/
  frames/                      # S1 抽帧（待生成）
    ref_0_t0.5.jpg … ref_4_t8.jpg
  refs/
    character_front.png        # S2 定稿角色卡（待生成）
  qwen/                        # 图像母版（待生成）
    001-character_s20261020.png … _s20261023.png
    002-hero-poster_s20261101.png
    003-feature-parse_s20261102.png
    004-feature-templates_s20261103.png
    005-feature-future_s20261104.png
    006-about-portrait_s20261105.png
    007-ui-stickers_s20261106.png
    008-mobile-cover_s20261107.png
    009-keyframe-a_s20261108.png
    010-keyframe-b_s20261109.png
    011-keyframe-c_s20261110.png
    012-keyframe-sky_s20261111.png
    每个母版旁：同名 .txt
```

- 提示词：`docs/hero-visual/prompts/image/`（已存在，24 个文件：12 组 pos/neg）。
- 网页产物：`public/hero/{poster.jpg,mobile-cover.jpg}`、`public/og-hero.jpg`、`public/art/{feature-parse,feature-templates,feature-future,about-portrait}.jpg`、`public/art/ui-kit.png`（待生成）。
- 命名不得自创：编号与 `assets.json` 的 id 对应，seed 后缀不可省（回溯/复跑要用）。

---

## 7. 检查命令

```powershell
# 1) 文件是否齐全
Get-ChildItem docs/hero-visual/prompts/image -Filter *.txt | Measure-Object
Get-ChildItem design/source/qwen -Filter *.png -ErrorAction SilentlyContinue | Select-Object Name,Length

# 2) JSON 可解析 + id 唯一 + prompt 文件存在（片段自检）
node -e "const fs=require('fs');const p='docs/hero-visual/_fragments/image-assets.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));const ids=new Set();for(const a of j.assets){if(ids.has(a.id))throw new Error('dup '+a.id);ids.add(a.id);for(const k of ['prompt','negative'])if(!fs.existsSync('docs/hero-visual/'+a[k]))throw new Error('missing '+a.id+' '+k);}console.log('OK',j.assets.length,'assets')"

# 3) 合并后的总清单自检
node scripts/hero/assets-check.mjs
node scripts/hero/assets-check.mjs --next

# 4) 单张 dry-run，确认 size/seed/refs 没写错
node scripts/hero/qwen-image-batch.mjs --only qwen-05 --dry-run

# 5) 图片像素尺寸抽查（PNG 头即可；只在母版已生成后跑）
node -e "const fs=require('fs');for(const f of fs.readdirSync('design/source/qwen').filter(x=>x.endsWith('.png'))){const b=fs.readFileSync('design/source/qwen/'+f);console.log(f,b.readUInt32BE(16)+'x'+b.readUInt32BE(20));}"
```

- 网页产物尺寸/体积检查与对比度实测见 `05-acceptance.md`（S6/S7）。
- 每次 `--run` 后把「生成时间 + seed + 文件」记到资产记录里，方便 QA 复跑。

---

## 8. 失败处理

| 现象 | 先查 | 处理 |
|---|---|---|
| `--run` 直接报缺 key | `DASHSCOPE_API_KEY` 是否在当前终端环境 | `scripts/hero/setup-claude.cmd` 或重新打开终端；不要把 key 写进文档 |
| 退出码 1（结构） | `assets.json` 字段、JSON 是否可解析 | 修 JSON/字段，别改脚本 |
| 退出码 2（环境/文件） | 缺 prompt/ref/输出目录 | 补齐文件；`refs` 路径必须相对仓库根 |
| 退出码 3（API） | `error.code`/HTTP 状态 | 限流/敏感词/尺寸非法分别处理；**不要连续重试**，每次只改一个变量 |
| 尺寸不合法 | `size` 是否在 512×512~2048×2048、比例 1:8~8:1；`assets.json` 里存 `宽x高`（人读），脚本会转成 DashScope 要求的 `宽*高` | 改 assets.json 的 size；不要手改脚本里的分隔符 |
| 出图带文字/水印 | 负向文件是否被删改 | 恢复负向、换 seed 重跑，不后期擦 |
| 人物脸不像 | 第 1 张 ref 是否 `character_front.png` | 换正确 ref；仍不像回 S2 重选角色卡 |
| 构图不听话 | `prompt_extend` 是否 `false`；第 2 张 ref 是否正确 | 改回 `false`；换构图更接近的参考帧 |
| 手崩/多余手 | 是否低机位+手部交互 | 简化动作（板靠身侧、单面板）；换 seed 重跑 3–5 次；仍崩改混合方案 |
| 面板不是三块 | 是否被改词 | 恢复提示词；临时 `n: 2` 选一张；仍不稳改 2 块面板 |
| 24h URL 下载失败 | 是否超时/网络 | 立即重跑该张（已下载的不会重复扣费）；不要手动把 URL 存文档 |
| 玻璃元素抠图丢折射 | — | 只取形状/高光，真玻璃用 CSS `backdrop-filter` |

**通则**：结构问题看退出码；审美问题只能换 seed/参考图/简化描述。同一张连续 5 次不过就停下改方案，别继续烧。

---

## 9. 阶段 gate 与验收清单

| 阶段 | Gate | 判定人 |
|---|---|---|
| S2 角色卡 | 客户确认 `design/source/refs/character_front.png` | 客户 / Lead |
| S3 网页图 | 7 张全过 §4.4 的 10 秒验收 | Lead / visual-qa |
| S3 关键帧 | 4 张全过 §4.4 + §4.5 附加项 | Lead / qwen-video |
| S4 之前 | 关键帧已落盘且 16:9 精确、主体未裁 | Lead |

- 验收留证：12 张联系表（可放 `design/source/qwen/contact-sheet.jpg`，待生成）+ 每张 `.txt` 参数 + 客户确认记录。
- 通过后同步 `docs/hero-visual/assets.json` 的 `status`/`evidence`（由 Lead 统一登记），不要手改结构。

---

## 10. 与其它工种的交接

- **给 S4（视频）**：四张关键帧路径与 id 见 §4.5 / §6；i2v 只读首帧；关键帧一旦改动必须通知视频负责人重跑对应镜头（否则人物/云型断档）。
- **给前端（S6）**：网页产物路径见 §4.3；文件不改名；poster 与视频首帧同一天同一时刻，`prefers-reduced-motion` 只显示 poster。
- **给设计（Figma）**：玻璃面板/简历内容全部空白，文字与图表在 Figma/CSS 叠；铬字用渐变描边，不用生成图。
- **给 QA（S7）**：负向文件已压文字/水印/帽子，但模型概率性仍在，必须逐张放大验收（`05-acceptance.md` A 组）。

---

## 11. 已知限制

1. **Qwen 有概率性**：同 seed 也允许细微差异；一致性靠参考图 + 角色卡，不做像素级承诺。
2. **结果 URL 仅 24h**：脚本立即下载；控制台手动的图也要马上转存。
3. **按像素档计费**：先 `--dry-run`、先单张、再批量；价格以百炼控制台为准。
4. **参考图 ≤3 张**（3.0 系）：再多不会更一致，反而会把参考图里的杂物带进来。
5. **文字能力强 ≠ 可以画字**：本项目画面内一律无文字，出现即返工。
6. **模型/参数可能随百炼升级变化**：脚本支持 `--model` 覆盖；参数以 `_team/QWEN_SPEC.md` §1.2 与官方文档为准。
