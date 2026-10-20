# Hero 视觉资产 · SD 出图执行手册（02）

> 适用：AUTOMATIC1111 1.10+ / Forge（含 Forge Neo）；底模基准 **Illustrious-XL**（换底模按 §2.1 只换质量 tag + CLIP skip）。
> 源方案：`网站设计提示词/AI简历网站_Hero视觉提示词总方案.md` §4（行 178–800）+ §1.5 + §3 + §7.1/§7.3，版本 v1.1（2026-10-20「无帽」修订）。
> 约定：英文提示词全部已逐字落盘到 `docs/hero-visual/prompts/sd/*.txt`，本文只引用文件、不转抄；所有路径以项目根为基准。
> 参数纪律：参数、seed、尺寸、denoise、CN/IP-Adapter 权重一律照源方案参数表；源方案没给的字段在 `_fragments/sd-assets.json` 里为 `null`，不补、不猜。

> **Lead 修订（2026-10-20，交付版）**：
> ① 新增 `00-character-sheet.expanded.pos.txt`：把 `STYLE` 与 `CH-A` 逐字展开，**可直接粘贴/可直接由 sd-batch 生成**；`assets.json` 的 `sd-00-character.prompt` 指向它，源模板 `00-character-sheet.pos.txt` 保留供溯源（§1.4 的拼接公式仍适用于手搓与理解）。
> ② 全部 img2img 资产在 `assets.json` 中新增 `initImage` 字段（`design/source/input/{hero,parse,templates,future,about,mobile}_base.png`），`sd-batch` 优先用它作 `init_images`；`inputs` 仅作参考帧，不再被当作输入画布。
> ③ `clean` 帧统一导出 **PNG**（IP-Adapter / ControlNet 只读 `.png`，避免二次压缩污染）。

---

## 0. 一页速查

### 0.1 产出一览（1 张角色卡 + 7 张图）

| id | 内容 | 生成尺寸 | SD 母版（`design/source/sd/`） | 网页产物 | 源参考帧 | 依赖 |
|---|---|---|---|---|---|---|
| `sd-00-character` | 角色卡（4 seed 选 1，客户确认后即全站唯一脸） | 1024×1024 | `design/source/refs/character_front.png`（不在 sd/ 下） | —（仅内部参考） | 无输入，txt2img | — |
| `sd-01` | hero 海报（视频 poster / OG 图） | 1536×864 | `hero_poster_16x9_s848812.png` | `public/hero/poster.jpg` + `public/og-hero.jpg`（1200×630） | 00006 主 / 00001 / 00009 | — |
| `sd-02` | 功能图 01 · AI 解析简历 | 1536×864 | `feature_parse_16x9_s848813.png` | `public/art/feature-parse.jpg` | 角色卡 + 00009（姿态） | `sd-00-character` |
| `sd-03` | 功能图 02 · 模板/版式（3 块玻璃面板） | 1536×864 | `feature_templates_16x9_s848814.png` | `public/art/feature-templates.jpg` | 00010 / 00009 + 角色卡 | `sd-00-character` |
| `sd-04` | 功能图 03 · 职业未来 | 1536×864 | `feature_future_16x9_s848815.png` | `public/art/feature-future.jpg` | 00016 主 / 00013 | — |
| `sd-05` | About 人像（抱滑板、3:4） | 896×1152 | `about_portrait_3x4_s848816.png` | `public/art/about-portrait.jpg` | 角色卡（唯一正脸）+ 00009 | `sd-00-character` |
| `sd-06` | UI 元素贴纸页（可切图） | 1024×1024 | `ui_stickers_1x1_s848817.png` | `public/art/ui-kit.png` | 无人物；色彩参考 00016 | — |
| `sd-07` | 移动端封面（9:16） | 768×1344 | `mobile_cover_9x16_s848818.png` | `public/hero/mobile-cover.jpg` | 00009 主 / 00016 | — |

> 网页产物 `public/hero/poster.jpg` 沿用项目现有引用；`public/og-hero.jpg` 为分享卡。资产编号对应源 §3 表：P1 = 资产 1，I1~I6 = 资产 2~7。
> **poster 优先级**：`public/hero/poster.jpg` 优先取成片 B 段 t≈6.5 s 抽帧（与视频连续）；SD P1 仅在无法取得 B 帧时兜底，并另出 `public/og-hero.jpg`（1200×630）作分享卡（裁决见 `01-visual-bible.md` §7.2、`05-acceptance.md` A8/B7）。

### 0.2 阶段与 gate

| 阶段 | 内容 | 完成判定（gate） | 失败就停 |
|---|---|---|---|
| **S1** | 抽帧 → 去水印 → `design/source/frames/clean/` → 16:9 画布 `design/source/input/` | clean 帧无水印、无文字、放大 200% 干净 | 后续所有 img2img 都会被水印/文字污染 |
| **S2** | 角色卡 4 seed 出图 | **客户书面确认** `design/source/refs/character_front.png` | 脸没定死 → 资产 2/3/5 必然返工 |
| **S3** | 7 张资产逐张出图 | 7 张全部通过 §6.5 十秒验收；`sd-01` 另过「与视频首帧无跳变」 | 任一张漂移 → 回退 seed 重跑，不靠后期硬修 |

### 0.3 现状体检（先跑这段，别假装前置已就绪）

```powershell
# 目录/输入（当前 S1 产物均未生成，返回 False 属正常）
Test-Path 'design/source/frames/clean/00006_clean.png'
Test-Path 'design/source/refs/character_front.png'
Test-Path 'design/source/sd'
Test-Path '网站设计提示词/frames/src/00006.jpg'   # 应 True：源抽帧已就位

# 工具（ffmpeg 本机未安装，已核实；不装就先用 VLC 抽帧）
Get-Command ffmpeg -ErrorAction SilentlyContinue
Get-Command node

# A1111 是否在跑
Invoke-RestMethod 'http://127.0.0.1:7860/sdapi/v1/options' -TimeoutSec 3 | Select-Object sd_model_checkpoint
```

- `design/` 已存在（`design/UI_ref.png`、`design/frames/` 等既有产物，已纳入 git），但 **`design/source/**` 尚未创建**（S1 产物）→ 出图前先建目录：

  ```powershell
  New-Item -ItemType Directory -Force design/source/frames/clean, design/source/refs, design/source/input, design/source/sd, design/source/wan
  ```

- `scripts/hero/sd-batch.mjs` 已交付并通过 dry-run 实测（默认 dry-run，`--run` 才提交 A1111）；A1111 未启动时按 §1.5.3 的 A1111 手搓步骤。
- 模型/采样/VAE 就绪检查：A1111 顶栏 checkpoint 是 Illustrious-XL 系，VAE 为模型自带或 `sdxl-vae-fp16-fix`，**不需要 refiner**。

### 0.4 提示词文件清单（32 个，全部逐字取自源方案；角色卡另有展开版）

| 角色 | 文件 | 源行 |
|---|---|---|
| 公共正向风格前缀 STYLE | `00-style.pos.txt` | 234 |
| 玻璃/铬/粉球装修前缀 UI-STAGE | `00-ui-stage.pos.txt` | 243 |
| 公共负向 NEG-BASE | `00-neg-base.neg.txt` | 249 |
| 角色串 CH-A（无帽，全片通用） | `00-ch-a.pos.txt` | 283 |
| 角色串 CH-A2（强风感变体，仍是短发） | `00-ch-a2.pos.txt` | 289 |
| 道具串 PROP-BOARD（芥末黄滑板） | `00-prop-board.pos.txt` | 295 |
| 角色卡正向 | `00-character-sheet.pos.txt` | 306 |
| 角色卡正向（展开版，**交付默认**） | `00-character-sheet.expanded.pos.txt` | 234 + 283 + 306 的 `STYLE`/`CH-A` 逐字展开 |
| 角色卡负向 | `00-character-sheet.neg.txt` | NEG-BASE + 308 追加 |
| 资产 1 正向/负向 | `01-hero-poster.pos.txt` / `.neg.txt` | 411 / NEG-BASE+417 |
| 资产 2 | `02-feature-parse.pos.txt` / `.neg.txt` | 455 / +461 |
| 资产 3 | `03-feature-templates.pos.txt` / `.neg.txt` | 498 / +504 |
| 资产 4 | `04-feature-future.pos.txt` / `.neg.txt` | 541 / +547 |
| 资产 5 | `05-about-portrait.pos.txt` / `.neg.txt` | 584 / +590 |
| 资产 6 整页 | `06-ui-stickers.pos.txt` / `.neg.txt` | 628 / +634 |
| 资产 6 逐元素公共尾部 | `06-element-tail.pos.txt` | 656 |
| 资产 6 逐元素 8 条 | `06a-chrome-ring` 至 `06h-play-button` 共 8 个 `.pos.txt` | 661–668 表 |
| 资产 7 | `07-mobile-cover.pos.txt` / `.neg.txt` | 690 / +696 |

> 上表文件全部位于 `docs/hero-visual/prompts/sd/`（下文简写 `prompts/sd/<文件名>`）；正文沿用源方案的 `STYLE` / `UI-STAGE` / `CH-A` 等简称，指代的就是上表对应文件。
> `.neg.txt` 是「完整可粘贴负向」= `NEG-BASE` + `, ` + 该张追加词；文档里出现的「追加」均指 `.neg.txt` 中 NEG-BASE 之后那一段。

---

## 1. 素材事实与角色锚点

### 1.1 帧里的事实（写提示词前先认这些）

| 项目 | 帧里的事实 | 对提示词的影响 |
|---|---|---|
| 画幅 | 608×1092 视频（抽帧文件实测 608×1104，多约 12px，疑似抽帧缩放），竖屏 16.9 s / 30 fps | 做 16:9 必须重搭画布 + 大面积重绘，不能直接拉伸 |
| 少女 | 棕色短发、略被风吹乱；oversized 淡蓝/灰蓝宽袖衬衫、袖口宽松；深色牛仔短裤；白袜；**白色运动鞋/帆布鞋**（00006、00016 清晰，逆光帧里会显深） | 鞋子固定写 `white sneakers`，不要写深色 |
| 帽子 | **无帽。** 第 9 帧起被看成「宽檐」的，其实是风把短发吹向一侧 + 逆光发丝：5× 放大（`网站设计提示词/frames/head_zoom.jpg`）里 00009 是清晰短发后脑勺，00010–00012 是横向飞起的发丝 + 太阳眩光，00016 同样是短发。**全片无帽、无耳机、无头饰** | 最容易被误读的一处。角色只保留 CH-A（无帽），负向统一压 `hat, cap, beanie, headwear`，防止模型自己加帽 |
| 滑板 | 芥末黄/琥珀色长板面，轮子浅色（帧里偏白/米） | `mustard yellow skateboard, white wheels` |
| 场景 | 下坡海岸公路、浅灰水泥路面、护栏与电线杆、巨大积云、深钴蓝天空、下方城镇与海平线、低角度逆光、镜头光晕、长影投向前景、轻微移轴 | 构图核心：路面透视 + 天空占比 55–70% |
| 镜头 | 低机位背后跟拍，女孩滑远（**全片只有背面/侧背面，没有正脸**） | 本项目最大风险，见 §3 与 §6.6 风险 1 |
| 水印 | 左下角「由 AI 修改」白字灰底，约在 608×1104 的 (20, 995)–(140, 1035) 区域 | 参考图必须先 inpaint 或裁掉，否则会污染 img2img 与 IP-Adapter |
| 调色 | 天蓝高饱和、云白接近纯白、阳光偏金、暗部干净、对比偏强 | 网页上要压对比；源方案要求提示词里给 `soft contrast in the sky area`（**注意**：该 tag 未出现在 STYLE 与七张正向里，见 §7.3 待确认 1，本文按源逐字执行、不自行添加） |

### 1.2 角色锚点（三项不可变，缺一即跑偏）

1. **棕色短发（无帽）**
2. **淡蓝宽袖衬衫（oversized pale blue long-sleeve shirt）**
3. **芥末黄滑板（mustard yellow skateboard）**

- 禁止：换发色、换服装主色、换滑板颜色、加帽子/耳机等抢戏配饰（会破坏与视频的同一性）。
- 任何一张图缺一项 → 视为跑偏，**回退 seed 重跑**。
- 选串只看风大不大：1–8 帧镜头用 **CH-A**，9–16 帧强风镜头用 **CH-A2**（发型变化，不是帽子）。任何图出现帽檐/帽带一律按错误重跑，不后期擦。

### 1.3 与任务描述不一致的 2 处（以帧为准，已修正）

1. **鞋是白色，不是深色**（00006/00016 清晰；逆光帧里会显深）。
2. **全片只有背面、没有正脸素材** → 正脸只能靠 §3 角色卡「再创作」，必须客户确认。

### 1.4 提示词片段与拼接公式

| 片段 | 文件 | 用在哪 |
|---|---|---|
| STYLE | `00-style.pos.txt` | 每张图开头都贴 |
| UI-STAGE | `00-ui-stage.pos.txt` | 资产 2、3、6；资产 4/7 可弱加 |
| NEG-BASE | `00-neg-base.neg.txt` | 全项目复用，每张负向的基底 |
| CH-A | `00-ch-a.pos.txt` | 全片唯一角色卡（无帽） |
| CH-A2 | `00-ch-a2.pos.txt` | 仅强风镜头，接在 CH-A 后 |
| PROP-BOARD | `00-prop-board.pos.txt` | 需要滑板道具时接在后面 |

拼接规则（与源 §4 五 的开头说明一致）：

- **7 张资产的正向已由源方案拼好**，`.pos.txt` 直接整条粘贴，不需要再拼片段。
- **角色卡**的源块以 `STYLE, CH-A,` 开头（见 `00-character-sheet.pos.txt` 原文）——它是**拼装指令**，直接粘贴会把字面量 `STYLE`/`CH-A` 当 tag 发出去。实际操作：把 `STYLE` 替换为 `00-style.pos.txt` 内容、`CH-A` 替换为 `00-ch-a.pos.txt` 内容，其余从 `character sheet, front view, upper body, neutral expression, gentle smile,` 一直到 `clean lineart` 原样保留（完整串见文件原文）。A1111 里一条公式：

```text
[00-style.pos.txt 全文] + ", " + [00-ch-a.pos.txt 全文] + ", character sheet, front view, upper body, neutral expression, gentle smile, looking at viewer, plain soft blue-white gradient background, studio soft light, detailed face, brown eyes, short brown hair, clean lineart
```

- **资产 6 逐元素版**：`00-style.pos.txt` + `06a` 至 `06h` 之一 + `06-element-tail.pos.txt`，三段用 `, ` 连接（源 §4 资产 6：「每条都接在 STYLE 后面 + 下面这条公共尾部」）。

### 1.5 前置 S1：clean 帧与 16:9 画布（不做完不要开 S2/S3）

#### 1.5.1 抽帧

```bash
# 每秒 1 帧，保留原分辨率（约 17 张，和现有 16 张对齐）
ffmpeg -i "滑板少女.mp4" -vf "fps=1" -q:v 2 "frames/src/%05d.jpg"

# 只要指定 16 帧：每 1.056 秒 1 帧
ffmpeg -i "滑板少女.mp4" -vf "fps=16/16.9" -q:v 2 "frames/src/%05d.jpg"
```

> 本机 ffmpeg **未安装**（已核实）。工具脚本必须检测并给安装提示，不能硬失败。已抽好的 16 张在 `网站设计提示词/frames/src/00001.jpg`~`00016.jpg`，可直接复用，不必重抽。

VLC 抽帧（已核对本机 vlc-help 参数名）：

```bat
"C:\Program Files\VideoLAN\VLC\vlc.exe" "滑板少女.mp4" --video-filter=scene --scene-format=jpg --scene-width=608 --scene-height=1092 --scene-ratio=1 --scene-prefix=frame --scene-path="frames\src" --scene-replace vlc://quit
```

- `--scene-ratio=1` 是「每 1 帧存 1 张」，会抽出 500+ 张；只要少量参考图就改成 `30`（每秒 1 张）或 `60`。
- 图形界面更省事：播放到目标位置按 `Shift+S` 截图，多定位几次即可。

#### 1.5.2 去水印（**必须先做**）

- **方案 A：inpaint（推荐，不切画面）** — A1111 → img2img → Inpaint，把左下角水印涂掉（608×1104 下约 x 10–150 / y 985–1045；源 §4 一 另写作 (20,995)–(140,1035)，两处坐标略有出入，按「涂满白字+底色、放大核对」为准），参数：`Mask blur 4`、`Inpaint at full resolution` 勾选、denoise 0.35–0.45，prompt 写 `clean sunlit concrete road, smooth asphalt, even lighting`，负向加 `text, watermark, letters`。
- **方案 B：裁切（快，但要看帧）**

```bash
ffmpeg -i 00016.jpg -vf "crop=608:980:0:0" 00016_clean.jpg
```

  即切掉底部约 124px。**注意**：00013–00016 板尾/轮子靠近画面底部，裁切会切到滑板，这几张只能用方案 A。
- 去完水印另存 `design/source/frames/clean/`，IP-Adapter 和 ControlNet **只读 clean 版本**。

#### 1.5.3 竖屏 → 16:9 画布（A1111 实操，源 §4 4.4）

不要指望 img2img 直接「变宽」，会拉伸。标准流程：

1. 在 PS/Figma 新建 **1536×864** 画布，铺一层从参考帧吸的深钴蓝天空色（或直接用 00006 天区镜像拉伸 + 高斯模糊 30px 当底）。
2. 把去水印帧按高度 864 缩放（约 478×864），**放到画面左侧 1/3 或右侧 1/3**，人物完整保留；空出的部分填天空色。
3. 存成 `design/source/input/hero_base.png`，丢进 img2img：`Resize and fill` 不要用，保持 `Just resize` 到 1536×864。
4. denoise 0.55–0.65，让模型把天空/云/公路「接」过去；接缝明显就改用 **Inpaint**：空白区+接缝涂 mask，`Inpaint at full resolution`，denoise 0.85–0.95，只重绘 mask 内。
5. 也可用 A1111 自带 `Outpainting mk2`（Masked content: `fill`，Pixels 64–128，方向 Right/Left），但 SDXL 下逐块扩更稳。
6. **最后一遍**降到 denoise 0.3 统一整体色调，避免左右两块色温不一致。

> 资产 2/5 的输入是「角色卡正脸草图」，资产 4 是「00016_clean 重搭 16:9」，资产 7 是「00009_clean 直接 768×1344」——各自画布按 §4 对应参数表的「输入」行搭建，源方案未给统一文件名，除 `hero_base.png` 外文件名自定、放 `design/source/input/`。

---

## 2. 底模 / 采样 / VAE / CLIP skip 基准

### 2.1 底模三选一（按顺序推荐）

| 底模 | 理由 | 备注 |
|---|---|---|
| **Illustrious-XL 系**（v0.1 / v1.x，社区常叫 Illustrious-XL） | 动漫质感最贴参考帧、光影和云层表现好，对 danbooru tag 响应准 | **首选/本文基准**。质量 tag 用 `masterpiece, best quality, very aesthetic, absurdres` |
| **NoobAI-XL**（v1.1 Epsilon-pred） | 同上，构图想象力更强，适合「悬浮玻璃/铬环」这类非常规物件 | 次选。CFG 可降到 4.5–5.5，sampler 用 Euler a 更稳 |
| **Animagine XL 4.0** | 最「干净」，NSFW 倾向低，交付客户最安全，画风略偏通用 | 商用交付兜底。质量 tag 用 `masterpiece, high score, great score, absurdres`，CLIP skip 2 |

### 2.2 换底模只改两处

三个模型都能跑通本文所有提示词，**切换底模时只换开头质量 tag + CLIP skip，其余不动**。不要混用 SD1.5 时代的 `(masterpiece:1.2)` 堆叠习惯——SDXL 动漫模型对权重过敏感，超过 1.3 容易烧图。VAE：用模型自带或 `sdxl-vae-fp16-fix`；**不需要 refiner**。

- 用 Animagine 4.0 时，把 STYLE 开头改成 `(masterpiece, high score, great score, absurdres:1.1),`（并设 CLIP skip 2）。
- 权重只给风格关键词的 1.0–1.2；`#hex` 只作弱提示，真正锁色靠 IP-Adapter 和后期 LUT。

### 2.3 采样与放大（全项目基准，源 §4 2.5）

| 参数 | 值 | 说明 |
|---|---|---|
| Sampler / Schedule | **DPM++ 2M Karras**（首选）/ Euler a（NoobAI、要更「手绘」时） | SDXL 动漫不需要 SDE 系 |
| Steps | 28–32（Hires 阶段 12–16） | 超过 35 收益很小 |
| CFG | 5.5–7.0；Illustrious 6.0，NoobAI 5.0，Animagine 6.5 | 只调 CFG 解决不了的问题，去调 IP/CN 权重 |
| Hires.fix | 1.5×–2×，Hires denoise 0.25–0.35，upscaler `4x-UltraSharp` 或 `R-ESRGAN 4x+ Anime6B` | 生成 1536×864 的图 Hires 到 2304×1296 再缩回 1536×864，边缘更实 |
| ADetailer | `face_yolov8n.pt` denoise 0.25–0.3；`hand_yolov8s.pt` denoise 0.3–0.35 | 有正脸/手部交互的图必开 |
| Denoise 区间 | 保角色 ≤0.5；换背景/改构图 0.55–0.65；只重绘空白 mask 0.85–0.95 | 见各资产参数表 |
| img2img 缩放 | 同比例用 *Just resize*；比例不同先搭好目标画布再 *Just resize*，**禁止 Crop and resize 拉脸** | 竖屏→横屏必须搭画布 |

### 2.4 色彩 token（画面里允许出现的 6 个色相）

- 天蓝 `#1A6BD6`｜云白 `#F4F8FC`｜阳光金 `#FFE9B0`
- 铬银 `#C9D2D9` / `#8E9AA4`｜粉红 `#E5355B`｜灰蓝背景 `#8E9AA1`
- 超出这 6 个色相的一律视为跑偏，回退 seed 或加负向 `orange skin, purple sky`。

### 2.5 权重纪律

- 负向里**不要**塞 `illustration`、`anime`，那会把风格本身 neg 掉。
- `hat / cap / headwear` 与 `upskirt / from below` 是必须项（角色无帽 + 大量低机位），负向里已经带上，**不要删**。

---

## 3. Stage S2：角色卡 runbook

### 3.1 为什么必须先做角色卡

参考视频**只有背面/侧背面**，直接拿帧做 IP-Adapter 只能学到「背影 + 蓝衬衫」，学不到脸。所以顺序必须是：先定脸（角色卡）→ 客户确认 → 再出资产。这张脸一旦确认，就是全站唯一面部锚点，后续所有图不许再「随机换脸」。

### 3.2 出图步骤（txt2img，1024×1024）

1. 模式：**txt2img**（不要 img2img，没有正脸输入）。
2. 正向：按 §1.4 的拼装公式把 `STYLE` + `CH-A` 展开后拼上角色卡描述段（从 `character sheet, front view, upper body, neutral expression, gentle smile,` 到 `clean lineart`；完整原文见 `00-character-sheet.pos.txt`）。
3. 负向：`00-character-sheet.neg.txt`（= NEG-BASE + `multiple girls, busy background, complex pose`）。
4. 尺寸 1024×1024；sampler/steps/CFG 按 §2.3 基准起步（Illustrious：DPM++ 2M Karras / 30 / CFG 6.0）。
5. 出 **4 张**：
   - seed **848800** 正面
   - seed **848801** 正面
   - seed **848802** 四分之三侧
   - seed **848803** 侧面
6. 挑 1 张脸最「邻家、可信、不网红」的。

### 3.3 客户确认 gate（硬门槛）

- 把 4 张候选（或选中的 1 张 + 备选）发给客户，明确一句：这是**再创作，不是还原**（源片无正脸素材）。
- 客户确认前**不要**开资产 2/3/5（它们靠这张脸做 IP-Adapter）。
- 客户确认后：这张图成为唯一面部锚点，后续不许换脸；客户若要求换脸 = 回到本步重新确认。

### 3.4 存档

- 存成 `design/source/refs/character_front.png`（去水印、1024 长边）。
- 后续资产 2/3/5 的 IP-Adapter 用它；资产 1/4/7 的 IP-Adapter 用原帧（要的是服装+姿态+场景）。
- 所有资产共用同一个 **series seed**（见 §6.3），风格锁死。

### 3.5 失败处理

| 现象 | 处理 |
|---|---|
| 出现帽子/帽檐/头饰 | 负向已含 `hat, cap, beanie, headwear`；仍出现就重跑该 seed，**不后期擦** |
| 脸不一致（4 张像 4 个人） | 固定 STYLE + CH-A，只换 seed，不混用其它角色串 |
| 网红脸/过度妆感 | 追加负向 `heavy makeup, idol, plastic skin`（源方案推荐「no makeup look」基调），重跑 |
| 客户否掉全部 4 张 | 备选：客户提供角色设定图/其它素材，一致性会好一个量级（源 §7.2 风险 1） |

---

## 4. Stage S3：七资产逐张 runbook

### 4.1 通用执行骨架（每张都照这个顺序）

1. **确认依赖**：`sd-02/03/05` 必须先有 `design/source/refs/character_front.png`（S2 gate 已过）；`sd-01/02/03/04/07` 必须先有 clean 帧。
2. **搭输入画布**：按该张参数表「输入」行，把 clean 帧/角色卡贴到目标尺寸画布（§1.5.3），存 `design/source/input/`。
3. **A1111 设置**（img2img 模式，`sd-06` 为 txt2img）：
   - 正向 = 对应 `.pos.txt` 全文；负向 = 对应 `.neg.txt` 全文（两条都完整，不需要手动拼）。
   - 尺寸、denoise、seed、CFG、steps 照参数表。
   - ControlNet 单元：按参数表建 1–2 个单元，预处理器/preprocessor 与模型都用 SDXL 版；`lineart_anime` 用 `controlnet-lineart-anime-xinsir-sdxl`，`depth` 用 SDXL depth，`openpose` 用 SDXL。
   - IP-Adapter：ControlNet 面板里选 IP-Adapter，模型 `ip-adapter-plus_sdxl_vit-h.safetensors`，CLIP Vision `CLIP-ViT-H-14-laion2B-s32B-b79K`，权重照表。**不要用 FaceID**（视频没正脸，FaceID 会自己编一张完全不同的脸）。
   - Hires.fix 按表；ADetailer 按表（face `face_yolov8n.pt` / hands `hand_yolov8s.pt`）。
   - 输出目录 `design/source/sd/`，文件名前缀照 §5.2 的母版名（回溯 seed/参数用）。
4. **生成 → 拼联系表 → 选图 → Hires → 统一色调**（最后一轮 denoise 0.3）。
5. **命名落盘**：母版 `design/source/sd/<name>`；网页产物按 §0.1 导出到 `public/`。
6. **十秒验收**（§6.5 + 本张专有项）；不过就改**一个**变量重跑。

> 批量替代：`scripts/hero/sd-batch.mjs`（tooling 交付后可用，见 §5.5）。它读 `docs/hero-visual/assets.json`，按 `master` 路径存 PNG，并写同名 `.txt` 记录 prompt/negative/seed/params。

---

### 4.2 资产 1 · hero 海报（视频 poster / OG 图）

**用途**：16:9 视频加载前的 poster、无自动播放时的兜底、分享卡片 OG 图；画面与视频首帧同款，保证「点击播放」时无跳变。

**尺寸**：1536×864（16:9），Hires 后缩回 1536×864；OG 另出 1200×630 中心裁切。

**参考帧**：00006（主，无帽）/ 00001（高机位变体）/ 00009（风感版，CH-A2 发丝方向）；IP-Adapter 用它，**不用**角色卡。

**留白**：人物在左 1/3，右侧 38%×45% 的区域是天空，亮度 65–85%、局部对比 ≤15%、无高频细节，给毛玻璃卡片。**本张不要铬环/粉球**，否则 poster 和视频首帧对不上。

- 正向：`prompts/sd/01-hero-poster.pos.txt`
- 负向：`prompts/sd/01-hero-poster.neg.txt`（追加段：`text, letters, logo, watermark, UI elements, chrome ring, pink sphere, buildings too detailed on the right, busy foreground, crowd, cars`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 1536×864 / 1536×864（先搭好画布，见 §1.5.3） |
| 输入 | `design/source/input/hero_base.png`（00006 去水印贴左 1/3 + 天空底） |
| Denoise | **0.5**（接缝重绘那一步 0.6；最后统一色调 0.3） |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.0 |
| Hires | 1.5×，denoise 0.3，4x-UltraSharp，12 steps |
| ControlNet | depth SDXL 0.55 (0→0.8)；可选 lineart_anime 0.35 锁滑板 |
| IP-Adapter | plus_sdxl，ref=`design/source/frames/clean/00006_clean.png`，0.6 |
| ADetailer | 关（中远景背面） |
| Seed | 848812 |
| 变体 | 风感版：IP-Adapter 换 `00009_clean`，正向把 CH-A 换成 CH-A2（强风感发丝 tag），**不要加任何帽类 tag**，负向保持 `hat, cap, headwear` |

**输出**：`design/source/sd/hero_poster_16x9_s848812.png` → `public/hero/poster.jpg`（1536×864）+ `public/og-hero.jpg`（1200×630）。

**10 秒验收（本张专有）**

- [ ] 「**暂停视频时和 poster 无差别**」：太阳位置、云型、路面阴影方向必须和 00006 一致（denoise 不超过 0.55 是底线）。
- [ ] 右侧留白干净到可以盖 `backdrop-filter` 卡片；云边缘别太锐。
- [ ] 画面内无铬环/粉球（视觉语言由功能图承担）。
- [ ] OG 版：1200×630 中心裁切后主体是否被裁半——是就另存主体居中版（同 seed，`subject on the left third` 改 `subject on the right third`），或直接裁右半天空做纯文字 OG。

**失败处理**

| 现象 | 处理 |
|---|---|
| 与视频首帧对不上（太阳/云型/阴影方向漂） | denoise 回到 0.5 以内重跑；仍漂就换 00001 做输入，不再加风格词 |
| 右侧天空出现高频细节 | 负向追加 `busy foreground`（已有）+ 降低该区域重绘 denoise；后期加 5% 高斯兜底（源方案允许，别超） |
| 人物被推到中间 | 检查输入画布人物位置是否真的在左 1/3；只改画布，不堆 tag |
| 出现文字/水印 | 直接重跑（NEG-BASE 已压），不要用后期擦文字 |

**中文要点（源方案，压缩不删事实）**

- 验收标准是「暂停视频时和 poster 无差别」：太阳位置、云型、路面阴影方向必须和 00006 一致，denoise 别超过 0.55。
- 留白不是 SD 里「画出来的空」，而是构图上把主体推走；右侧天空要「干净到可以盖 backdrop-filter 卡片」，云边缘别太锐。
- OG 从 1536×864 中心裁 1200×630 时人物大概率被裁一半——另存一版主体移到正中，或直接裁右半天空做纯文字 OG，更稳。
- 别在这张加铬/粉球：hero 是「真实世界」，功能图才是「AI 世界」。

---

### 4.3 资产 2 · 功能图｜AI 解析简历

**用途**：首页功能区第一张卡：说明「AI 读懂你的简历并给出建议」。

**尺寸**：1536×864（16:9），卡片内显示约 720×405。

**参考帧**：角色卡（正脸）+ 00009（手臂前伸姿态，仅取 pose）；IP-Adapter 用角色卡 0.7。

**留白**：人物/卡片在左 55%，右侧 45% 是虚化天空 + 少量粉光，给文案。

**关键**：SD 不会写简历文字——**玻璃卡片一律「空白」**，文案和图表后期在 Figma 叠。

- 正向：`prompts/sd/02-feature-parse.pos.txt`
- 负向：`prompts/sd/02-feature-parse.neg.txt`（追加段：`text, letters, words, paragraphs, readable document, handwriting, speech bubble, cluttered UI, too many floating objects, extra hands, extra arms, deformed fingers, hand covering face, screen glare, flat 2d UI overlay`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 1536×864 / 1536×864 |
| 输入 | 角色卡正脸 1536×864 草图（人物左置）+ 天空底（画布见 §1.5.3） |
| Denoise | **0.6**（角色靠 IP-Adapter 锁，denoise 高一点让玻璃物件长出来） |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.0 |
| Hires | 1.5×，denoise 0.3 |
| ControlNet | openpose SDXL 0.55（只给「伸手」姿态）+ depth 0.4；**不要** lineart 叠原帧，会把背影抄进来 |
| IP-Adapter | plus_sdxl，ref=`design/source/refs/character_front.png`，0.7 |
| ADetailer | face 0.3 + hands 0.35（必须，手摸卡片是重灾区） |
| Seed | 848813 |

**输出**：`design/source/sd/feature_parse_16x9_s848813.png` → `public/art/feature-parse.jpg`。

**10 秒验收（本张专有）**

- [ ] 玻璃面板**空白**（一个字的 UI 都不许有）；「AI 读懂」靠玻璃面板 + 抽象数据条/对勾 + 粉光点三件事。
- [ ] 手与卡片的关系不崩（放大 200% 看指节数量与遮挡关系）。
- [ ] 右侧 45% 留白虚化、云无锐边，文案能直接叠。
- [ ] 铬环/粉球出现但不过量（本张允许 chrome torus ring + pink glow particles）。

**失败处理**

| 现象 | 处理 |
|---|---|
| 手崩（连续 ≤5 张） | 先 Inpaint 单独修手（denoise 0.35，mask 只包手和卡片边缘）→ ADetailer 再跑一遍 |
| 连续 5 张手都崩 | **换混合方案**：SD 只出人物 + 光效背景，卡片在 Figma 用玻璃组件合成（源方案默认「SD 出人 + 玻璃少而大」就是给混合留余地） |
| 出现可读文字 | 重跑；负向已含 text/letters/paragraphs，不要靠后期擦 |
| 画面把背影抄进来（叠了 lineart 原帧） | 移除 lineart 单元，只留 openpose + depth |

**中文要点（源方案）**

- 表现「AI 读懂」靠三件事：玻璃面板 + 悬浮的抽象数据条/对勾 + 粉色光点；千万不要让模型画 UI 文字，一定糊。
- 手和卡片的关系最容易崩：先出图 → 选一张手型勉强对的 → Inpaint 修手（denoise 0.35，mask 只包手和卡片边缘）→ ADetailer 再跑一遍。
- 右侧留白要「虚」：`shallow depth of field` + 云不要锐边，文案叠上去才读得清。

---

### 4.4 资产 3 · 功能图｜模板 / 版式

**用途**：功能区第二张卡：说明「多种简历版式可选，AI 帮你排版」。

**尺寸**：1536×864。

**参考帧**：00010 / 00009（双手前伸姿态）+ 角色卡（脸）。

**留白**：人物左侧 45%，右侧 55% 给 3 块玻璃面板 + 文案。

**关键**：3 块面板必须「空白/极简抽象」，且**数量明确写 3**（SD 会画 2 或 5 块，用负向和构图反复试）；粉球和铬环是装饰，别超过 2 个。

- 正向：`prompts/sd/03-feature-templates.pos.txt`
- 负向：`prompts/sd/03-feature-templates.neg.txt`（追加段：`text, letters, words, paragraph text, more than three panels, many panels, cluttered composition, duplicate panels, extra hands, extra arms, deformed fingers, wrong hand count, screen glow, flat ui, white background`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 1536×864 / 1536×864 |
| 输入 | 角色侧身草图（左置）+ 天空底 |
| Denoise | **0.62**（要「长出」三块面板，必须敢给） |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.5（面板数量靠 CFG 略高一点更容易听指令） |
| Hires | 1.5×，denoise 0.3 |
| ControlNet | depth 0.5（锁面板与人的前后层次）+ openpose 0.45 |
| IP-Adapter | plus_sdxl，ref=`design/source/refs/character_front.png`，0.65 |
| ADetailer | hands 0.35；face 0.25 |
| Seed | 848814 |

**输出**：`design/source/sd/feature_templates_16x9_s848814.png` → `public/art/feature-templates.jpg`。

**10 秒验收（本张专有）**

- [ ] 面板数量**正好 3 块**（数一遍，2 块/5 块都不行）。
- [ ] 面板之间有明显深度差（前中后层次），方便后期逐块贴模板缩略图。
- [ ] 面板内无文字/无缩略图内容（空白）。
- [ ] 铬环/粉球各 ≤1 个，总装饰 ≤2 个。

**失败处理**

| 现象 | 处理 |
|---|---|
| 面板数量错（2/4/5 块） | 重跑，不后期擦（擦掉一块会留疤）；先试 CFG 6.5→7.0，再试调 `subseed` |
| 三层变一层（全贴在一起） | 降 depth 到 0.45；`fanned in the air at different depths` 已在正向，别再加同类 tag |
| 手/指头数量错 | ADetailer hands 0.35 + Inpaint 修手 |
| 装饰堆成玩具感 | 负向追加 `cluttered composition`（已有）+ 降 UI-STAGE 权重 |

**中文要点（源方案）**

- 三块面板 = 三套模板的隐喻。数量错了就重跑，不要后期擦——擦掉一块会留疤。
- 面板之间的「深度差」比「数量准」更重要：`fanned in the air at different depths` 让画面有层次，也方便后期在每块面板上贴模板缩略图。
- 铬环和粉球各 1 个就够：客户参考稿里的「液态铬字+3D 铬环+粉球」是**视觉语言**，不是要堆满，堆两个以上就变玩具感。
- 图里所有面板最后会由前端/设计替换成真模板截图，所以这里只要「玻璃质感对、位置对、留白对」。

---

### 4.5 资产 4 · 功能图｜职业未来

**用途**：功能区第三张 / CTA 区：说明「AI 简历带你去更好的未来」。

**尺寸**：1536×864。

**参考帧**：00016（城镇全景 + 路灯 + 地平线，无帽）为主，00013 次之；IP-Adapter 用 00016 0.6（要服装+环境，不要脸）。

**留白**：人物右下 1/3，左上 55% 是发光天空 + 地平线，给标题和按钮。

**关键**：要「上升感/希望感」而不是「孤独感」——靠光的方向、城市天际线、微微张开的双臂，以及**不要**背对镜头低头。

- 正向：`prompts/sd/04-feature-future.pos.txt`
- 负向：`prompts/sd/04-feature-future.neg.txt`（追加段：`text, letters, watermark, sad, lonely, dark, gloomy, night, rain, empty void, detailed buildings, crowd, cars, extra limbs, broken skateboard, missing wheels`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 1536×864 / 1536×864 |
| 输入 | `00016_clean` 重搭 16:9（人物右下）+ 天空底 |
| Denoise | **0.55** |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.0 |
| Hires | 1.5×，denoise 0.3 |
| ControlNet | depth 0.55（锁地平线与城市层）+ lineart_anime 0.4（锁人物/发型/滑板） |
| IP-Adapter | plus_sdxl，ref=`design/source/frames/clean/00016_clean.png`，0.6 |
| ADetailer | 关（背面中景）；如发丝糊则开 face 0.25 |
| Seed | 848815 |

**输出**：`design/source/sd/feature_future_16x9_s848815.png` → `public/art/feature-future.jpg`。

**10 秒验收（本张专有）**

- [ ] 太阳在**地平线附近**、光从人物前方/侧前方来、地面有金色反光（太阳在头顶正上方 = 像黄昏告别，退）。
- [ ] 城市天际线「发光但模糊」，不是写实城市（负向已压 `detailed buildings`）。
- [ ] 左上留白亮度 70–85%，没到纯白（纯白上放白字会死）。
- [ ] 姿态是「向前看/微张臂」，不是背对低头。

**失败处理**

| 现象 | 处理 |
|---|---|
| 出图偏「孤独/黄昏告别」 | 检查太阳位置 tag；只改 `sun near the horizon` 相关描述，不堆情绪词 |
| 城市画成写实 | 负向追加 `detailed buildings`（已有）+ 降 denoise |
| 左上过曝到纯白 | 降高调曝光倾向；后期压亮（别把天空抬到发白会把毛玻璃后糊成灰） |
| 客户要更「励志」 | 把 00016 的低头姿态改成 `looking up, chin raised`，denoise 提到 0.6 **只重绘上半身** |

**中文要点（源方案）**

- 「希望感」的物理来源是**光**：太阳压在地平线附近 + 光从人物前方/侧前方来 + 地面有金色反光；不要把太阳放在人物头顶正上方。
- 城市天际线要「发光但模糊」，暗示未来而不是具体某城。
- 这是 CTA 图，左上留白会直接压按钮，天空亮度建议 70–85%，别过曝到纯白。

---

### 4.6 资产 5 · About / 故事区人像

**用途**：About 区块：讲「我们为什么做 AI 简历」时的主视觉人物，建立情感连接。

**尺寸**：896×1152（约 3:4，SDXL 安全尺寸），另出 896×1120（严格 4:5）适配不同容器；Hires 2× 到 1792×2304 再缩。

**参考帧**：**角色卡正脸**（唯一正脸来源）+ 00009 发型/服装；IP-Adapter 0.7。

**留白**：人物右侧 30% 是暖调虚化天空/云，给署名或引言；左侧可压标题。

**关键**：暖调逆光、亲和力，不要摆拍感、不要网红脸。

- 正向：`prompts/sd/05-about-portrait.pos.txt`
- 负向：`prompts/sd/05-about-portrait.neg.txt`（追加段：`text, letters, watermark, ugly face, bad face, extra fingers, fused fingers, deformed hands, holding skateboard wrong, skateboard floating, harsh flash lighting, studio background, formal suit, office, over makeup, plastic skin, symmetrical perfect face, looking away, closed eyes`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 896×1152（3:4）/ 896×1152 |
| 输入 | 角色卡正脸 896×1152 草稿（人物居中偏左） |
| Denoise | **0.55**（保脸型又要换背景与光） |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.0 |
| Hires | 2×，denoise 0.3，R-ESRGAN 4x+ Anime6B |
| ControlNet | depth 0.4（锁半身构图与滑板位置）；lineart 0.35 可选 |
| IP-Adapter | plus_sdxl，ref=`design/source/refs/character_front.png`，0.7 |
| ADetailer | face 0.3 + hands 0.35（抱着板子的手必须修） |
| Seed | 848816 |
| 备选 | 换 896×1120（4:5）时只改生成尺寸，构图 tag 不变 |

**输出**：`design/source/sd/about_portrait_3x4_s848816.png` → `public/art/about-portrait.jpg`（另出 896×1120）。

**10 秒验收（本张专有）**

- [ ] 脸和角色卡是**同一张脸**（不一致就回 S2 重新确认角色卡，不要单独硬调这张）。
- [ ] 板子是芥末黄（颜色错了这张就脱节）。
- [ ] 抱板的手不崩、板子没有漂浮。
- [ ] 暖调逆光成立（不是冷调、不是平光），有亲和力、不像摆拍。

**失败处理**

| 现象 | 处理 |
|---|---|
| 脸漂（不像角色卡） | 回 S2 重新确认角色卡；同时查 IP-Adapter 是否真指向 `character_front.png` |
| 抱板姿势错 | 先接受「手的位置勉强」→ Inpaint 修手与板子接触处；板色错就重跑 |
| 出图偏冷 | 加 `golden hour color grading` 提权到 1.2，或后期加 `#FFE9B0` 的 15% 柔光层 |
| 网红脸/过度妆 | 负向已有 `over makeup, plastic skin`；确认 `gentle friendly smile + looking at viewer` 还在正向里 |

**中文要点（源方案）**

- About 图是「人」，不是「产品图」：`gentle friendly smile + looking at viewer` 是亲和力的全部来源，别加 `dynamic pose`、`dramatic`。
- 抱板姿势很难一次对：先接受「手的位置勉强」，再用 Inpaint 修手和板子的接触处；板子必须是芥末黄。
- 暖调逆光靠 `warm golden backlight + rim light`；如果出图偏冷，加 `golden hour color grading` 提权到 1.2，或在后期加 `#FFE9B0` 的 15% 柔光层。
- 这是客户会用来「认人」的一张，必须和角色卡是同一张脸；不一致就回 Step 0-2 重新确认角色卡，不要单独硬调这张。

---

### 4.7 资产 6 · UI 元素贴纸页（可切图）

**用途**：给 Figma 切图：铬环、粉色渲光球、玻璃卡片、头像框、箭头/星星/简历图标，用于按钮、图标、装饰。

**尺寸**：1024×1024（1:1），每个元素留 40–60px 安全边。

**参考帧**：无人物；色彩参考 00016 的蓝/白/金 + 客户参考稿的铬/粉。

**底**：平涂 `#8E9AA1` 灰蓝或纯白（二选一）。灰蓝底和网站背景同色，抠图后边缘更自然；纯白底更适合玻璃半透明元素。

**关键**：SD 做「规则网格」不稳定，**先试整页，失败就逐元素生成再拼**；元素之间不要重叠。

- 整页正向：`prompts/sd/06-ui-stickers.pos.txt`
- 整页负向：`prompts/sd/06-ui-stickers.neg.txt`（追加段：`text, letters, labels, captions, numbers, background gradient, noisy background, objects overlapping, cut off objects, uneven spacing, blurry edges, multiple light directions, people, hands`）
- 逐元素 8 条：`06a-chrome-ring`、`06b-pink-sphere`、`06c-glass-card`、`06d-avatar-frame`、`06e-arrow`、`06f-sparkle`、`06g-resume-icon`、`06h-play-button`（均在 `prompts/sd/` 下，`.pos.txt`）
- 逐元素公共尾部：`06-element-tail.pos.txt`

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 1024×1024 / 1024×1024 |
| 输入 | txt2img 即可（也可用空白纯色 1024 图 img2img denoise 1.0） |
| Denoise | txt2img；若 img2img 用 0.9–1.0 |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.5 |
| Hires | 1.5×，denoise 0.25 |
| ControlNet | 不需要 |
| IP-Adapter | 可选：ref=`design/source/frames/clean/00016_clean.png` 0.35 只借色调 |
| ADetailer | 关 |
| Seed | 848817 |

**输出**：`design/source/sd/ui_stickers_1x1_s848817.png` → `public/art/ui-kit.png`（透明/灰蓝底另存）。

**逐元素拼法**：`00-style.pos.txt` + `, ` + 元素 `.pos.txt` + `, ` + `06-element-tail.pos.txt`，三段合起来粘进正向。

**10 秒验收（本张专有）**

- [ ] 边缘干净、光向一致（统一左上光源）、能抠。
- [ ] 元素之间不重叠、不被裁切、间距均匀。
- [ ] 图标里的「文字」全是抽象横线（`minimal abstract lines instead of text`），没有可读字。
- [ ] 单个元素导出 512×512（@2x）就够，别用整页 1024 直接切。

**失败处理**

| 现象 | 处理 |
|---|---|
| 整页网格乱、元素叠在一起 | 换成逐元素生成再拼（源方案给的兜底路线），别死磕整页 |
| 出现可读文字/字母 | 重跑；负向已含 text/letters/labels/numbers |
| 光向不一致 | 逐元素生成时用同一 STYLE + 同一公共尾部；不要混用不同 seed 家族 |
| 玻璃半透明元素抠图丢折射 | 不要整块贴：在 Figma 用真玻璃组件（backdrop-filter）重做，SD 图只取「形状与高光」 |

**中文要点（源方案）**

- **图标里的「文字」一律用抽象横线代替**：`minimal abstract lines instead of text`，SD 写字必糊，后期在 Figma 里换真文字。
- 这张是「素材库」不是「画面」，验收标准是「边缘干净、光向一致、能抠」。光向统一用左上光源。
- 玻璃半透明元素抠图后会丢折射，建议在 Figma 里用真玻璃组件重做，SD 图只取「形状与高光」。
- 客户参考稿的「液态铬字」SD 做不了（字形不可控），**铬字交给 Figma/CSS 渐变描边**，这里只做铬环和铬图标。
- 尺寸上，单个元素导出 512×512（@2x）就够，别用整页 1024 直接切。

---

### 4.8 资产 7 · 移动端封面（9:16）

**用途**：移动端 hero 首屏（桌面 hero 视频在手机端换成这张静图 + 玻璃卡片）。

**尺寸**：768×1344（9:16，SDXL 安全），Hires 1.5× → 缩回 768×1344；另出 1080×1920 高清版。

**参考帧**：00009（风感版，无帽、竖屏原生比例、重绘面积最小）/ 00016。

**留白**：上方 30–35% 是天空，给 logo；下方 25% 给毛玻璃卡片（卡片区亮度压低、无细节）。

**关键**：竖屏原图做 16:9 难，但做 9:16 几乎不用改，这是最省成本的一张。

- 正向：`prompts/sd/07-mobile-cover.pos.txt`
- 负向：`prompts/sd/07-mobile-cover.neg.txt`（追加段：`text, letters, logo, watermark, chrome ring, pink sphere, busy top edge, subject cropped at head, tilted horizon, portrait orientation phone mockup, frame`）

**参数（源方案原样）**

| 项 | 值 |
|---|---|
| 输出 / 生成 | 768×1344（9:16）/ 768×1344 |
| 输入 | `00009_clean` 直接 768×1344（原图 608×1104 等比放大到 740×1344 再补 28px 天空边，或先裁一点再缩） |
| Denoise | **0.42**（重绘面积小，保角色最重要） |
| Sampler / Steps | DPM++ 2M Karras / 30 |
| CFG | 6.0 |
| Hires | 1.5×，denoise 0.28，4x-UltraSharp |
| ControlNet | depth 0.5（锁人物大小与天空比例）；lineart_anime 0.45（锁发型/滑板） |
| IP-Adapter | plus_sdxl，ref=`design/source/frames/clean/00009_clean.png`，0.65 |
| ADetailer | 关（背面中景） |
| Seed | 848818 |
| 变体 | 风感更弱的版本换 `00006`（1–8 帧，风小），CH-A 不变，denoise 0.45 |

**输出**：`design/source/sd/mobile_cover_9x16_s848818.png` → `public/hero/mobile-cover.jpg`（768×1344；另出 1080×1920）。

**10 秒验收（本张专有）**

- [ ] 上方 30% 只有天空；人物最高点（发顶）落在 45% 线以下（不被状态栏/卡片挡脸）。
- [ ] 底部 25% 路面无高对比细节（要压毛玻璃卡片），必要时后期加 8% 深色渐变。
- [ ] 和 `sd-01` 海报「同一天同一时刻」：云型、太阳高度、色温一致。
- [ ] 竖屏没有被拉脸/拉宽（输入必须等比放缩进画布）。

**失败处理**

| 现象 | 处理 |
|---|---|
| 人物顶到状态栏 / 发顶过 45% 线 | 改输入画布的留边比例，降人物在画布中的高度占比，不靠 tag 硬压 |
| 桌面↔手机切换露馅（云/太阳/色温不一致） | 用同一个 IP-Adapter 参考 + 相邻 seed；回 `sd-01` 对齐后再出 |
| 底部路面细节太抢 | 后期 8% 深色渐变（源方案允许）；或换 00006 弱风版 |
| 做成 1080×1920 直接生成导致糊 | 只能 768×1344 生成后 Hires 放大，别直接生成大图 |

**中文要点（源方案）**

- 手机端首屏最怕「人物顶到状态栏/被卡片挡住脸」：确认上方 30% 只有天，人物最高点（发顶）落在 45% 线以下。
- 底部 25% 会压一张毛玻璃卡片，所以下半部路面不要有高对比细节，必要时后期加 8% 的深色渐变。
- 这张和 hero 海报要「同一天同一时刻」：云型、太阳高度、色温必须一致，否则桌面↔手机切换会露馅。用同一个 IP-Adapter 参考和相邻 seed。
- 9:16 的 768×1344 在部分安卓机裁切后仍安全；别做成 1080×1920 直接生成（SDXL 会糊），靠 Hires 放大。

---

## 5. 批量工作流、命名与导出

### 5.1 建议执行顺序（源 §4 6.1）

1. 抽帧 → 去水印 → 存 `design/source/frames/clean/`
2. 角色卡（seed 848800–848803）→ 客户确认 → `design/source/refs/character_front.png`
3. 资产 1（hero）→ 客户确认「和视频首帧无跳变」
4. 资产 2/3（功能图）→ 确认玻璃/铬/粉的「AI 世界」视觉语言
5. 资产 4（未来）+ 5（About）→ 确认人物亲和力与一致性
6. 资产 6（UI 贴纸）→ 交设计切图
7. 资产 7（移动端）→ 最后做，复用 1/4 的构图结论

### 5.2 命名规范（源 §4 6.2）

```text
design/source/sd/
  hero_poster_16x9_s848812.png
  feature_parse_16x9_s848813.png
  feature_templates_16x9_s848814.png
  feature_future_16x9_s848815.png
  about_portrait_3x4_s848816.png
  ui_stickers_1x1_s848817.png
  mobile_cover_9x16_s848818.png
  + 同名 .webp（q 90）与 .avif（可选）
```

A1111 生成时把文件名前缀设成同样的名字，方便回溯 seed 和参数。角色卡例外：`design/source/refs/character_front.png`（不入 `sd/`）。

### 5.3 导出（源 §4 6.3）

- 色彩空间 sRGB，PNG 8bit；网页用 WebP（质量 88–92）+ PNG 兜底。
- `sd-01` 另出 1920×1080（Hires 放大后缩）给大屏，2× 图给视网膜屏；OG 另出 1200×630。
- 毛玻璃卡片覆盖区在导出前做**局部对比压缩**：亮度 75% 左右 + 高斯 2–4px + 轻微降饱和 5%，否则叠卡片后文字发灰。
- 动效：hero 视频 poster 与视频首帧做 200ms 交叉淡入，避免闪一下（由前端/视频组装，不在 SD 阶段）。

### 5.4 效率技巧（源 §4 6.4）

- A1111 用 **X/Y/Z plot** 扫参：`Denoising strength` 0.4/0.45/0.5/0.55 × `IP-Adapter weight` 0.55/0.65/0.75，一次出 12 张定档。
- 同一资产出 8 张选 1 张，别在一张上死磕；选图标准看「手/脸/板/留白」四项。
- 所有图先在 1024 长边看小图选，选中再 Hires，省时间。
- 批量重命名/联系表可用 PowerShell 或 PS 批处理，别手动。

### 5.5 批量脚本（`scripts/hero/sd-batch.mjs`，tooling 交付）

读 `docs/hero-visual/assets.json`（Lead 合并后的总表），逐资产调 A1111 API：

```powershell
# 默认 dry-run：只打印将发送的 txt2img/img2img 关键字段，不发请求
node scripts/hero/sd-batch.mjs --dry-run
node scripts/hero/sd-batch.mjs --only sd-01 --dry-run

# 真正生成（A1111 必须已在 127.0.0.1:7860）
node scripts/hero/sd-batch.mjs --only sd-01,sd-02 --run

# 允许覆盖已有母版
node scripts/hero/sd-batch.mjs --only sd-01 --run --force
```

- txt2img 字段：prompt / negative_prompt / width / height / steps / cfg_scale / sampler_name / seed；img2img 额外 init_images（读 `inputs` 第一张 base64）+ denoising_strength。
- 保存 PNG 到 `master`，同名 `.txt` 写完整 prompt/negative/seed/params；缺输入图或 API 不可达时明确报错，不静默失败。
- **前置未满足判定**：`Test-Path scripts/hero/sd-batch.mjs` 为 False → 只用 A1111 手搓，不要臆测脚本行为。角色卡（`sd-00-character`）使用展开版 `00-character-sheet.expanded.pos.txt`（已把 STYLE/CH-A 展开），**可交给 sd-batch 一次生成 4 个 seed**，再人工/客户挑 1 张定稿为 `character_front.png`。

---

## 6. 一致性与验收

### 6.1 IP-Adapter 策略（源 §4 3.3）

- 模型 `ip-adapter-plus_sdxl_vit-h.safetensors`，CLIP Vision `CLIP-ViT-H-14-laion2B-s32B-b79K`。
- 权重：背影/服装参考 0.5–0.65；正面角色卡参考 0.65–0.75；**超过 0.8 会把构图也一起抄走**。
- **不要用 FaceID**：视频没正脸，FaceID 没参考就会自己编一张完全不同的脸。
- 各张取值见 §4 参数表（0.6 / 0.7 / 0.65 / 0.6 / 0.7 / 0.35 可选 / 0.65）。

### 6.2 ControlNet 策略（源 §4 3.3）

- `lineart_anime`（SDXL，如 `controlnet-lineart-anime-xinsir-sdxl`）权重 0.5，start 0 / end 0.85 —— 锁角色轮廓与滑板。
- `depth`（SDXL depth）权重 0.45–0.6 —— 锁公路透视、天空占比、人物占画面比例。
- `openpose`（SDXL）权重 0.5–0.6 —— 只给功能图 2/3 的手部姿态用，线稿会跟原帧冲突，**二选一**。
- `canny` 只在重绘水印、修滑板轮子时临时用，0.4。

### 6.3 Seed 策略（源 §4 3.3）

- series seed = **848812**；各资产 seed 依次为 848812–848818（01→848812、02→848813、03→848814、04→848815、05→848816、06→848817、07→848818，逐张 +1）。
- 构图锁死后，只改 `subseed` + `subseed strength 0.1–0.2` 出变体，别改主 seed。
- 角色卡 seed 单独一套（848800–848803），不要和资产混。

### 6.4 每轮联系表 6 项检查（源 §4 3.3）

每轮出图后拼一张 4 宫格对比联系表，检查：**脸 / 发型（无帽，发丝方向可变）/ 衬衫颜色 / 滑板颜色 / 云型 / 太阳位置**。任一漂移就回退 seed 重跑，不要靠后期硬修。

### 6.5 每张图的 10 秒验收（源 §4 7.1，全部 8 条）

- [ ] 6 色板之外没有乱入色（尤其橙皮、紫天、荧光绿）
- [ ] 人物：短发（无帽）/淡蓝衬衫/牛仔短裤/白袜白鞋/芥末黄板，六件套齐全；发丝方向可随镜头变，但不得出现帽子/头饰
- [ ] 云是「积云塔」不是「平层云」，太阳在低角度逆光位
- [ ] 留白区亮度 65–85%、无高频细节、能直接叠白字
- [ ] 无文字、无签名、无水印、无 UI 边框
- [ ] 手/脸/滑板轮子无结构性错误（放大 200% 看）
- [ ] 系列内和其它图对比：脸、云、太阳位置一致
- [ ] 无走光、无幼态化倾向（低机位图逐张审）

### 6.6 风险（源 §4 7.2，按严重度排序）

1. **正脸无素材依据（最高）**：视频全片背面，角色卡的正脸是「再创作」，不是「还原」。必须让客户在 S2 gate 确认，否则后面 5 张图会反复返工。备选：客户提供角色设定图/其它素材，一致性会好一个量级。
2. **SD 写不了文字（高）**：所有玻璃面板一律空白，文案后期叠。若客户坚持「图里要有简历文字」，改混合方案（SD 出场景 + Figma 合成 UI）。
3. **手与悬浮物交互易崩（高）**：资产 2/3/5 都要修手。预算里预留「每张 3–5 次 inpaint」的时间。
4. **竖屏转横屏重绘面积大（中）**：hero/功能图右侧天空是重绘出来的，不是原素材，云型可能和视频对不上；用 00006 构图 + 低 denoise + 后期统一色调压住。
5. **风格漂移（中）**：换底模/换 IP 权重都可能让系列图不像一套。锁 series seed + 角色卡 + 统一 STYLE 前缀，每轮拼联系表检查。
6. **水印残留/裁切切到滑板（中）**：00013–00016 底部有板尾，优先 inpaint 而非裁切。
7. **合规（低但必须）**：角色看起来是青少年，避免 `loli/child/young girl` 类 tag，服装保持 `modest outfit`，负向已经压住性化描述；交付前人工过一遍。
8. **参考帧误读（低概率但致命）**：逆光 + 强风下，飞起的发丝极易被看成帽檐——本版曾误判为草帽，已用 5× 放大复核更正为**无帽**。后续补抽帧同样先放大核对头部再落笔，任何新图出现帽子一律重跑。

### 6.7 与其它工种的交接（源 §4 7.3）

- **给前端**：hero poster 必须和视频首帧像素级接近（太阳位置/云型/色温），否则 poster→video 会跳；移动端封面同理。
- **给设计（Figma）**：毛玻璃卡片 = `backdrop-filter: blur(20px) saturate(140%)` + 1px 白 10% 描边；铬字用渐变描边，不用 SD 生成。
- **给视频组（ComfyUI）**：本套图的 STYLE 前缀、色板、角色 tag 串（**棕色短发、无帽**）和视频提示词共用，别各写各的；负向里的 `hat, cap, headwear` 两边都要带。

---

## 7. 源映射表

### 7.1 章节覆盖

| 本文 | 源方案位置 |
|---|---|
| §0 一页速查 / 0.1 产出一览 | §0 一页结论（20–24）、§3 资产清单（155–172） |
| §0.2 阶段 gate | §4 6.1（725–733）、§7.2 风险 1（782） |
| §1.1 素材事实 | §4 一（197–215） |
| §1.2 角色锚点 | §4 一 锚点段（212–214）、§4 三 3.1（276–298）、§1.1（35–43） |
| §1.3 两处不一致 | §4 一（214） |
| §1.4 片段与拼接 | §1.5（69–78）、§4 2.2/2.3/2.4（231–254）、§4 三 3.1（282–296）、§4 五 开头（396–397）、资产 6 逐元素（652–668） |
| §1.5 S1 前置（抽帧/去水印/画布） | §4 四（349–392） |
| §2 底模/采样基准 | §4 2.1–2.6（218–273） |
| §3 S2 角色卡 | §4 3.2（300–315）、§4 3.3（317–333）、§7.1/§7.2 风险 1 |
| §4.2 资产 1 | §4 五 资产 1（401–440） |
| §4.3 资产 2 | §4 五 资产 2（444–483） |
| §4.4 资产 3 | §4 五 资产 3（487–526） |
| §4.5 资产 4 | §4 五 资产 4（530–569） |
| §4.6 资产 5 | §4 五 资产 5（573–613） |
| §4.7 资产 6 | §4 五 资产 6（617–675） |
| §4.8 资产 7 | §4 五 资产 7（679–719） |
| §5 批量/命名/导出 | §4 六 6.1–6.4（723–764） |
| §6.1–6.4 一致性策略 | §4 3.3（317–333） |
| §6.5 十秒验收 | §4 7.1（769–778） |
| §6.6 风险 | §4 7.2（780–789） |
| §6.7 交接 | §4 7.3（791–795） |
| 文末基准声明 | §4 尾注（799） |

### 7.2 提示词文件 ↔ 源行号（逐字复制，已脚本校验 31/31 一致）

| 文件 | 源行 | 说明 |
|---|---|---|
| `00-style.pos.txt` | 234 | STYLE 公共前缀 |
| `00-ui-stage.pos.txt` | 243 | UI-STAGE 装饰前缀 |
| `00-neg-base.neg.txt` | 249 | NEG-BASE |
| `00-ch-a.pos.txt` | 283 | CH-A |
| `00-ch-a2.pos.txt` | 289 | CH-A2 |
| `00-prop-board.pos.txt` | 295 | PROP-BOARD |
| `00-character-sheet.pos.txt` | 306 | 角色卡正向（含 `STYLE, CH-A` 拼装指令，见 §1.4） |
| `00-character-sheet.neg.txt` | 249 + 308 | NEG-BASE + 追加 |
| `01-hero-poster.pos.txt` / `.neg.txt` | 411 / 249+417 | |
| `02-feature-parse.pos.txt` / `.neg.txt` | 455 / 249+461 | |
| `03-feature-templates.pos.txt` / `.neg.txt` | 498 / 249+504 | |
| `04-feature-future.pos.txt` / `.neg.txt` | 541 / 249+547 | |
| `05-about-portrait.pos.txt` / `.neg.txt` | 584 / 249+590 | |
| `06-ui-stickers.pos.txt` / `.neg.txt` | 628 / 249+634 | |
| `06-element-tail.pos.txt` | 656 | 逐元素公共尾部 |
| `06a-chrome-ring.pos.txt` | 661 | 液态铬环 |
| `06b-pink-sphere.pos.txt` | 662 | 粉色渲光球 |
| `06c-glass-card.pos.txt` | 663 | 玻璃卡片 |
| `06d-avatar-frame.pos.txt` | 664 | 头像框 |
| `06e-arrow.pos.txt` | 665 | 箭头 |
| `06f-sparkle.pos.txt` | 666 | 星星/闪光 |
| `06g-resume-icon.pos.txt` | 667 | 简历图标 |
| `06h-play-button.pos.txt` | 668 | 播放按钮 |
| `07-mobile-cover.pos.txt` / `.neg.txt` | 690 / 249+696 | |

### 7.3 源内不一致 / 待确认项（不自行发明，按源执行并标注）

1. **`soft contrast in the sky area`**：源 §4 素材表（210 行）要求「提示词里给 `soft contrast in the sky area`」，但 STYLE（234）与七张正向里**均未出现该 tag**。本文按逐字复制，不加此 tag；是否追加需客户/方案 owner 确认 —— **待确认（需客户）**。
2. **水印坐标两处不同**：§4 一（209）写 (20,995)–(140,1035)，§4 4.3（373）写 x 10–150 / y 985–1045。按「涂满白字+底色、放大核对」为准 —— **待确认（以实际 inpaint 为准，不影响提示词）**。
3. **角色卡 seed 表述**：§4 3.2 步骤 1 写「seed 固定 848800」，随后写「出 4 张（848800 / 848801 正面、848802 四分之三侧、848803 侧面）」。按 **4 个 seed** 处理，`seeds = [848800, 848801, 848802, 848803]`。
4. **角色卡参数缺失**：源方案未给角色卡的 steps/CFG/sampler/Hires 参数表，`sd-assets.json` 对应字段为 `null`；执行时按 §2.3 全项目基准起步（Illustrious：DPM++ 2M Karras / 30 / CFG 6.0），**这不是源方案给定值，属执行默认**。
5. **模型归属**：源方案未在角色卡段点名底模；`sd-00-character.params.model` 记为 `Illustrious-XL`，依据是 §2.1 首选 + 文末「所有参数以 Illustrious-XL 为基准」。
6. **clean 帧扩展名**：源 §4 4.3 裁切示例输出 `.jpg`，而 IP-Adapter 引用写作 `00006_clean`；`sd-assets.json` 统一用 `.png`（`design/source/frames/clean/00006_clean.png`）。若实际导出为 `.jpg`，需同步改 JSON 中 5 处 ref（01/04/06/07 的 IP-Adapter 与 07 的输入说明）—— **待确认（以实际导出格式为准）**。
7. **clean 帧与角色卡均为「产物（待生成）」**：`design/source/frames/clean/`、`design/source/refs/character_front.png`、`design/source/input/*`、`design/source/sd/*` 当前都不存在，JSON 里的引用是目标路径，不是现有文件。
8. **资产 2/5 的输入尺寸**：源写「角色卡正脸 1536×864 草图 / 896×1152 草稿」，但角色卡生成为 1024×1024；执行时按「用角色卡图搭目标尺寸画布」理解（源未明确说明这一步），属执行细节 —— **待确认（如客户/方案 owner 有指定画布规范以指定为准）**。
9. **资产 1 的 OG 版**：§3 表 P1 为 1536×864，§4 6.3 要求另出 1920×1080 与 2× 图；JSON 的 `master` 用 1536×864，大屏版作为附加导出，不冲突。
10. **资产 6 逐元素文件**：源表里每行是「元素 tag 串」，需与 STYLE + 公共尾部拼接才是完整正向；`06a` 至 `06h` 的 `.pos.txt` 保存的就是元素段原文，拼法见 §1.4/§4.7。
11. **条件性参数在 JSON 里为 `null`**（源参数表给的是条件写法，不是缺失）：`sd-06.params.denoise = null`（txt2img；img2img 才用 0.9–1.0）、`sd-04.params.adetailer = null`（关；发丝糊时开 face 0.25）、`sd-00-character` 的 steps/cfg/sampler/hires 为 `null`（源未给参数表，按 §2.3 基准起步）。源里写「可选」的 ControlNet/IP-Adapter 条目保留为数组元素并标 `"optional": true`（`sd-01` lineart_anime 0.35、`sd-05` lineart_anime 0.35、`sd-06` IP-Adapter 0.35），批量脚本应把 `optional: true` 视为默认不发、由执行人决定是否加。
12. **`00-character-sheet.pos.txt` 的行首缩进**：源块位于编号列表内，原文行首有 3 个 Markdown 排版空格；落盘时去掉了这段缩进（提示词本体逐字未改），其它 30 个文件与源行完全逐字一致。
