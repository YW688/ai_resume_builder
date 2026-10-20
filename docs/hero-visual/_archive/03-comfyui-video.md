# 03 · ComfyUI 视频生产 runbook（Wan2.2 5B · 3 镜头 · 无缝循环）

> 本文是源方案 `网站设计提示词/AI简历网站_Hero视觉提示词总方案.md` §5（ComfyUI 全部：0~13 章 + 附录 A/B）＋ §6 协同规则 ＋ §7 验收 ＋ §8 交付命名的可执行改写版。
> 阶段：**S4（Wan 3 镜头 + 循环）**；前置：S1 素材清理（clean 帧无水印）、S2/S3 可与 SD 图并行。
> 硬件前提：**RTX 3060 Laptop / 约 6 GB 显存**。本地只跑 **Wan2.2 TI2V-5B**（fp8 或 GGUF Q5）；**14B I2V / VACE-14B / FLF2V-14B 全部上云**，不要用 6 GB 硬扛。
> 成片口径：**1920×1080 / 24 fps（网页版补到 30 fps）/ 15~18 s / 无缝循环 / 无音轨**；全画面清晰（供上层毛玻璃 `backdrop-filter`），但中心 60%×50% 安全区低对比。
> 配套资产：英文提示词在 `prompts/comfy/*.txt`（逐字复制源方案，可直接粘贴）＋ 机器可读参数在 `../_fragments/comfy-assets.json`。
> **ffmpeg 本机未安装**：本文所有 ffmpeg/ffprobe 命令按源方案**原样保留**（仅按项目路径映射替换输入/输出文件名），执行前必须先安装并确认 `ffmpeg -version`、`ffprobe -version` 有输出；未安装时命令无法在本机验证，这不是脚本失败。抽帧已用 VLC 完成（见源方案附录 A），不依赖 ffmpeg。

---

## 0. 一页速查

### 0.1 交付结构

| 条目 | 内容 | 首帧 / 参考图 | 生成分辨率 → 成片 | 帧数 @fps | 时长 | 主模型 |
|---|---|---|---|---|---|---|
| **Shot A 延续** | 接源片尾部，低机位背后跟拍，继续滑下坡，云在动 | 源片尾帧（去水印 + 横向扩展成 16:9）→ `design/source/frames/clean/A_start_16x9.png` | 960×544 → 1920×1080 | 121 @ 24 | 5.04 s | Wan2.2 TI2V-5B |
| **Shot B 展开** | 侧移 + 升高拉远，跟拍变宽幅海天全景，少女右下三分之一，左侧留天空 | Shot A 尾帧 | 960×544 → 1920×1080 | 145 @ 24 | 6.04 s | Wan2.2 TI2V-5B |
| **Shot C 收尾/回环** | 慢动作侧身回眸 → 镜头上摇，纯天空/云层收尾 | Shot B 尾帧 | 960×544 → 1920×1080 | 73 @ 24，RIFE 2× 后 146 @ 24（0.5× 慢放） | 6.08 s | Wan2.2 TI2V-5B |
| **Loop 接缝** | C 尾 → A 首的 FLF2V 桥接（或交叉淡化），实现无缝循环 | C 尾帧 / A 首帧 | 1280×704（云 GPU）或直接剪辑 | 19~25 @ 24 | 0.8~1.0 s | Wan2.1 FLF2V-14B（云） |
| **V4 兜底 loop** | 静止天空 + 微动云 + 粒子，无主体，纯天空循环 | 无（T2V） | 832×480 → 1920×1080 | 145 @ 24，循环裁成 121 | 5.04 s | Wan2.2 TI2V-5B |
| **D 变体（可选）** | 黄昏金调 + 极轻粉色反光版（同 Shot B 构图） | Shot B 首帧（A 尾帧，与 B 同一时刻） | 960×544 | 145 @ 24 | 6.04 s | Wan2.2 TI2V-5B |

预算（源方案口径）：本地 GPU **1.5~3 h** 生成 + **半天**剪辑；14B/FLF2V 云上另计。

### 0.2 成片时间线（剪辑后 ≈ 15.41 s）

```text
Shot A 5.04 s ──(0.5 s 叠化)── Shot B 6.04 s ──(0.5 s 叠化)── Shot C 6.08 s
                                                                   │
        ┌──────────── 循环接缝：C 尾 0.75 s 交叉淡化回 A 首 0.75 s ─┘
        ▼
成片 ≈ 16.16 − 0.75 = 15.41 s，1920×1080，24 fps（或补到 30 fps 交付），无音轨
```

- 想稳进 16 s+：Shot B 用 **169 帧（7.04 s）**，成片 ≈ 16.4 s；或 Shot C 生成 **81 帧（3.375 s）再做 0.5×**，得到 6.75 s，成片 ≈ 16.1 s。
- 三条硬约束（任何一条不满足就重跑）：**① 少女始终在左/右三分之一，绝不进中心；② 镜头内无快摇/快推；③ 首尾帧亮度差 ≤ 3%。**

### 0.3 本方案的三个关键取舍（先看结论）

1. **模型**：本地只跑 **Wan2.2 TI2V-5B**（fp8 / GGUF Q5，6 GB 可落地）；14B I2V / VACE-14B / FLF2V-14B 全部放云 GPU。不要用 6 GB 硬扛 14B，时间和画质都输。
2. **只在 Shot A 首帧做一次 16:9 横向扩展**：把源片尾帧扩成 16:9 后，B/C 都从上一镜尾帧续写，天生就是 16:9，**不需要每镜都 outpaint**，这是本方案成本最低、连续性最好的做法。
3. **时长用 24 fps 原生帧率**：5B 原生 24 fps，不要生成 16 fps 再拉时长；慢动作交给 RIFE 补帧 + 0.5× 播放，而不是让模型生成“慢动作”。

### 0.4 路径映射（本文统一用项目内路径）

| 源方案写法 | 本项目路径 | 说明 |
|---|---|---|
| `frames/src/00001.jpg ~ 00016.jpg` | `网站设计提示词/frames/src/` | 只读参考帧，不改不删 |
| `frames/contact_sheet.jpg`、`frames/head_zoom.jpg` | `网站设计提示词/frames/` | 只读核对图 |
| `frames/clean/` | `design/source/frames/clean/` | 去水印/扩画布产物 |
| `source/wan/`、`assets/wan/` | `design/source/wan/` | Wan 母版（含同名 `.txt` 参数） |
| `assets/hero/hero-1080-30fps.mp4` | `public/hero/hero.mp4` | 1080p 网页版（沿用项目现有文件名） |
| `assets/hero/hero-1080.webm` | `public/hero/hero-1080.webm` | VP9 兜底 |
| `assets/hero/hero-1080.av1.webm` | `public/hero/hero-1080.av1.webm` | AV1 兜底（可选） |
| `assets/hero/hero-9x16.mp4` | `public/hero/hero-9x16.mp4` | 移动端（源片 9:16 裁切 + 设计层，非 Wan 产物） |
| `assets/hero/hero-poster.jpg` | `public/hero/poster.jpg` | `<video poster>`，沿用现有引用 |
| `assets/hero/hero-1080-24fps-master.mp4` | `design/source/wan/hero-1080-24fps-master.mp4` | 母版单独留档，**不进 public** |

- 720p 网页档 `public/hero/hero-720p.mp4` 为项目既有文件名（源方案未单列该档），由 1080p 成片降采样；码率未在源方案给出 → `待确认（按 1080p 网页档同比例收敛）`。

---

## 1. 素材事实与清理

### 1.1 源片事实

| 项 | 实测 / 观察 | 对方案的影响 |
|---|---|---|
| 画幅 | 608×1092 竖屏（抽帧文件为 608×1104，抽帧工具可能补了边，**扩展前用 mp4 原帧核对首末行有无黑边**） | 必须处理竖屏 → 16:9 |
| 时长/帧率/码率 | 16.9 s / 30 fps / 约 2.9 Mbps | 源片本身不够长，且 30 fps 与 5B 24 fps 不同，需统一时间线 |
| 风格 | 动漫/插画质感、手绘背景、巨大积云、逆光、镜头光晕、移轴微缩感 | 提示词按 “anime illustration / painterly / tilt-shift” 锁定 |
| 角色 | 棕色短发少女（**不是草帽**，头部是短发 + 逆光轮廓，抽帧放大已核对）、oversized 淡蓝宽袖衬衫、牛仔短裤、白袜、运动鞋、芥末黄滑板 | 角色卡按短发锁定，全片禁止帽子/耳机 |
| 滑板 | 芥末黄板面，轮子在逆光下偏暖橙（角色卡写白轮时模型会被光染成暖色，属正常；不要为此改色） | 提示词写 `cream-white wheels`，接受暖光染色 |
| 场景 | 下坡海岸公路、左侧护栏 + 电线杆 + 下垂电线、下方城镇与海、深蓝天空、积云、太阳在她身后偏右上、长影子落在路面 | 世界锁定块固定这些元素 |
| 镜头 | 低机位、广角、背后跟拍，她滑远；镜头有轻微前推和左移 | A 延续这个机位，但把主体逐步让到右三分之一 |
| 水印 | 左下角“由 AI 修改”，屏幕固定位置，抽帧坐标约 **x≈24~158、y≈998~1062**（608×1104 坐标；按 608×1092 原帧等比微调），白字 + 深色底衬 | 必须在喂给 I2V 之前去掉，否则模型会把字“续写”成乱码 |
| 曝光 | 抽检帧：天空暗部 RGB≈(27,78,120)、路面中间调≈(95,102,94)、云/高光≈(120~160)。**整体不是过曝高调**，是“深蓝天 + 暖逆光 + 中间调路面” | 扩展时保持这个曝光基线，**不要为了“明亮”把天空抬到发白**，否则毛玻璃后全糊成灰 |

补充事实（源方案附录 A/B）：

- 源片 mp4 **不在仓库内**（源方案附录 A 记录在外部盘），仓库里只有抽帧副本；执行清理前把 `滑板少女.mp4` 放到项目根或工作目录，**不要提交进 git**。
- 抽帧清单：`网站设计提示词/frames/src/00001.jpg ~ 00016.jpg`（VLC scene 滤镜，约 1 帧/秒）；联系表 `网站设计提示词/frames/contact_sheet.jpg`；头部 5× 放大核对图 `网站设计提示词/frames/head_zoom.jpg`（只读，不修改）。
- 全片无正脸（只有背面/侧背面）——这是 SD 组必须先做「正面角色卡」的原因；视频侧 `Shot C` 的侧身回眸是**唯一**给“脸”的镜头，验收要求至少 2 个镜头能看清脸。
- 无帽修订（源方案附录 B.1）：所谓“宽檐草帽”是风吹短发 + 逆光发丝（5× 放大见 `网站设计提示词/frames/head_zoom.jpg`）；负向词必须保留 `hat, cap, headphones`。
- 源片（竖屏 / 608 宽 / 30 fps / 带水印）**不进桌面成片**；桌面 hero 全部为生成画面，源片只用于移动端 9:16 兜底（见 §10.1）。

### 1.2 抽帧结论（00001 → 00016 的时间演进）

- 前 8 帧：她还在坡上段，电线杆/电线从画面左上斜穿，天空占约 50%，城镇在左下方，路面占下 35%。
- 第 9~12 帧：太阳进入画面中部偏右，逆光光晕最强，路面反光最亮，是**全片最好看的光**，适合做 Shot A 的起点参考。
- 第 13~16 帧：镜头随她下坡，电线杆换成路灯杆，城镇铺满中景，天空仍占 45~55%，她位于画面中偏左、板在左下方，水印压在她影子/板尾附近。
- **结论：源片尾帧的天空占比约 50%，可以直接做 A 的首帧；A 的尾帧再交给 B。** 整条片子的“明亮 + 逆光 + 大天空”基因来自 9~16 帧，不要用 1~4 帧的偏暗段当基准。

### 1.3 清理命令（生成前必做）

```bash
# 工作目录：项目根；源片 滑板少女.mp4 需先放到项目根（不入库）。除输入/输出路径外，滤镜与参数与源方案逐字一致。
# 1) 抽真正的尾帧（不要用 00016.jpg 代替，抽帧点与真实末帧差 0.2~0.5 s）
ffmpeg -sseof -0.15 -i "滑板少女.mp4" -frames:v 1 -q:v 1 design/source/frames/clean/end_raw.png

# 2) 去水印（推荐裁切；水印在底部 80 px 内，裁掉后 608×1024）
ffmpeg -i design/source/frames/clean/end_raw.png -vf "crop=608:1024:0:0" design/source/frames/clean/end_clean.png

# 备选：不裁切，用 delogo 抹掉（会损失一点路面细节，但保留构图）
ffmpeg -i design/source/frames/clean/end_raw.png -vf "delogo=x=16:y=994:w=150:h=76" design/source/frames/clean/end_delogo.png

# 3) 检查末帧有没有运动模糊：如果糊，向前取 0.3 s 的帧做 A 首帧
ffmpeg -ss 16.5 -i "滑板少女.mp4" -frames:v 1 design/source/frames/clean/end_alt.png
```

- 若最终成片**不直接使用源片画面**（本方案推荐：只把源片当故事/角色参考，成片全部为生成画面），则只需要清理“A 首帧”这一张关键帧；**千万不要把带水印的帧喂给 I2V**。
- **源片不进成片的原因**：竖屏、608 宽、30 fps、带水印，四项都要额外处理；把它当“故事起点”而不是“素材片段”最划算。若客户坚持要“真人实拍感”的开头，则源片只用于**移动端 9:16 兜底版**，桌面 hero 仍用生成版；两边共用同一角色卡和 LUT，观感才统一。
- 若客户坚持成片开头要放源片实拍段，则必须逐帧去水印（静态 mask 即可，水印是屏幕固定位置），且要先用 §5 的 VACE 做整段 16:9 扩展——成本和风险都上一个台阶（见 §10.1 策略对比）。

### 1.4 水印处理（必须先处理，源方案 §11.1）

- 位置：左下，屏幕固定；约 **x 24~158、y 998~1062**（608×1104 抽帧坐标）。内容“由 AI 修改”，白字 + 深色衬底。
- 三种处理，按代价排序：
  1. **裁切**（推荐，最干净）：裁掉底部 80 px，`crop=608:1024:0:0`；损失一点路面/板尾，但扩展时会补回来。
  2. **delogo 抹除**：`delogo=x=16:y=994:w=150:h=76`；适合不想改构图时，边缘会有一点糊，后续 VACE 扩展可盖住。
  3. **inpaint**：ComfyUI 里用 LaMa/VACE 对静帧 inpaint，mask 盖住水印 + 外扩 8 px；只对关键帧做，不要逐帧做（会闪）。
- **绝对不要**：带水印的帧直接喂 I2V——模型会把“由 AI 修改”续写成乱码/花纹，且会跟着镜头动，后期救不回来。
- 水印进了生成画面就无法后期擦除（源方案 §11.2“水印复活”）：已污染的镜头只能重跑。

---

## 2. 共用锁定块

### 2.0 写法原则（Wan 与 SD 不同）

- **Wan 的文本编码器吃自然语言长句，不要堆 Danbooru tag。** 一条提示词 = 主体 + 动作 + 镜头怎么动 + 光 + 风格，控制在 **70~130 个英文单词**。
- 负向词只放“不要什么”，不要在正向里写 `no xxx`。
- 英文提示词**逐字粘贴**：不改大小写、权重、括号、逗号；不翻译；中文说明不要粘进 `CLIPTextEncode`。
- Wan 对大小写不敏感，但**保留英文标点与完整句子**比堆 tag 更有效（源方案 §13 注）。

### 2.1~2.5 锁定块文件（直接复制，不要手打）

| 块 | 文件 | 用法 |
|---|---|---|
| 角色卡（正向） | `prompts/comfy/00-character.pos.txt` | 逐字复用，只改动作段；三处硬锚点“短发 / 淡蓝宽袖 / 芥末黄板”一条都不能改 |
| 世界卡（正向） | `prompts/comfy/00-world.pos.txt` | 固定海岸公路、护栏/电线杆、远城与海、积云、逆光方向 |
| 风格尾巴（正向） | `prompts/comfy/00-style.pos.txt` | 接在每条提示词最后；源方案各镜头英文块已自带同一尾巴 |
| 通用负向（NEG-BASE） | `prompts/comfy/00-neg-base.neg.txt` | 全片统一，整段粘贴 |
| 运动负向 | `prompts/comfy/00-neg-motion.neg.txt` | 追加到涉及移动镜头的负向里 |

**合并规则（已按此落盘，可直接整段粘贴）**：

- 每镜 `.pos.txt` = 角色卡 + 世界卡 + 该镜头源块（源块本身已含动作段与风格尾巴），**顺序与源方案一致**，三段之间用一个换行连接；文件内不做任何改写。
- 每镜 `.neg.txt` = 源方案该镜头负向整段：Shot A 即 NEG-BASE + 运动负向；Shot B = NEG-BASE + 运动负向 + B 专属；Shot C 为源方案原样（并非简单相加，照抄）；D 变体 = Shot B 负向 + ", " + D 追加词。
- 源方案每镜英文块本身已是 70~130 词的“自洽完整版”；本目录的 `.pos.txt` 为规范要求的“全量版”（实测 220~306 词）。若实测长提示词让镜头运动变弱，可临时只贴文件的第 3 段（即源块全文）——**不要删词或改词**。

### 2.6 中文要点（源方案 §2.6，原样保留）

- **“同一个人”靠图不靠词**：I2V 的首帧已经给了脸/衣服/板，提示词只补动作和镜头；角色卡的三处硬锚点是“短发 / 淡蓝宽袖 / 芥末黄板”，任何一条都不能改。
- **光的方向永久锁死**：太阳永远在她身后偏右上，影子永远朝画面左下/前方。B、C 如果光向变了，剪在一起会像两部片。
- **色板**：天蓝 `#1A6BD6`、云白 `#F4F8FC`、阳光金 `#FFE9B0`、铬银 `#C9D2D9`、粉红 `#E5355B`。视频里粉红只允许出现在**镜头光晕/皮肤边缘的一点点暖粉**，不做大面积霓虹；铬银只做滑板桥/护栏的冷反光。
- 不要在提示词里写 hex 值（Wan 不理解），用 `deep cobalt sky / creamy white clouds / warm gold sunlight / coral pink flare` 这类词表达。

---

## 3. 三镜头 runbook

### 3.0 通用 I2V 节点链（A/B/C 共用）

```text
LoadImage(A_start_16x9.png)
  → ImageScale（lanczos，960×544，crop=center）
  → [VAE] ─┐
            ├→ Wan22ImageToVideoLatent（width 960, height 544, length 121/145/73, batch 1, start_image）
[UNETLoader] → ModelSamplingSD3(shift 8.0) → KSampler ← [CLIPLoader → CLIPTextEncode 正/负]
            └→ VAEDecodeTiled → SaveImage / VHS_VideoCombine(24 fps)
```

- 认**节点类型 + 连线关系**，不要死记节点标题：不同 ComfyUI 版本原生 Wan 节点名略有差异（如 `Wan22ImageToVideoLatent` 在部分版本带 `(Tiled VAE encode)` 后缀、`WanImageToVideo` 与 `WanFirstLastFrameToVideo` 的输入口顺序会变）。
- 5B 必须配 Wan2.2 的 VAE（`wan2.2_vae.safetensors`），**不能**用 Wan2.1 的 VAE，也不要用 Wan2.1 的 `WanImageToVideo` 配 5B 模型（VAE/通道不匹配会报错）。

### 3.1 Shot A「延续」——接源片尾部，低机位跟拍继续下坡

- **用途**：hero 0~5 s；让用户一眼认出“就是源片那个少女”。
- **首帧输入**：`design/source/frames/clean/A_start_16x9.png`（由 §5 VACE 扩展；她位于画面右三分之一，天空占左/中上部）。
- **时长/帧数**：121 帧 @ 24 fps = **5.04 s**（Wan2.2 VAE 要求 4n+1，121 合法）。
- **生成分辨率 → 成片**：960×544，超分后 1920×1080。
- **机位**：低机位、广角（约 24~28 mm 等效）、镜头在她身后 2~3 m、略偏左，视线稍仰。
- **运动**：她继续滑下坡远去；镜头极慢前推 + 轻微左移（整段累计横移不超过画面宽 8%）；云缓慢漂移；衬衫下摆和短发被风吹起；轮子滚过路面。
- **安全区**：她 + 滑板 + 影子全部落在 **x 62%~82%**；画面中心 60%×50% 只有天空、云、远城雾化；地平线压在 **y 52%~58%**。
- **中文要点**：这一镜是“信任状”，动作宁慢勿快；镜头只做“跟着滑”的微动，不做任何运镜花活。画面右侧保留她，左侧给玻璃卡片留干净天空。
- **提示词**：
  - 正向：`prompts/comfy/shot-a.pos.txt`（= 角色卡 + 世界卡 + 源块）
  - 负向：`prompts/comfy/shot-a.neg.txt`（= NEG-BASE + 运动负向）
- **参数**：Wan2.2 TI2V-5B fp8 / GGUF Q5，960×544，121f，24 fps，steps 28，CFG 5.0，sampler `uni_pc`，scheduler `simple`，shift 8.0，denoise 1.0，seed `20261020`（全量见 §6.4）。
- **节点链关键设置**：`LoadImage(A_start_16x9.png)` → `ImageScale`（lanczos 960×544，crop=center）→ `Wan22ImageToVideoLatent`（length 121，start_image）＋ `ModelSamplingSD3(shift 8.0)` → `KSampler`（steps 28 / CFG 5.0 / uni_pc / simple / denoise 1.0）→ `VAEDecodeTiled` → `VHS_VideoCombine`（24 fps）。
- **输出**：
  - 母版：`design/source/wan/shot-a_v1_960x544_s20261020.mp4` ＋ 同名 `.txt`（正向/负向/seed/steps/cfg/sampler/shift/模型 hash）
  - 网页：并入成片后导出 `public/hero/hero.mp4`（A→B→C 拼接，见 §9）
- **验收（10 秒）**：
  - [ ] 少女 + 板 + 影子在 x 62%~82%，中心 60%×50% 无主体、无文字、无电线杆穿中心。
  - [ ] 地平线 y 52%~58%；光向：太阳在她身后偏右上，影子朝左下。
  - [ ] 首帧与尾帧亮度差 ≤ 3%，尾帧无运动模糊；抽尾帧准备给 Shot B。
- **失败处理**（只改一个变量；最多重试 2 次——**这是本文执行约定，源方案未给重试次数**，第 3 次仍不过就回退首帧/换 seed）：
  - 人物漂移/衣服变色：先查 A 首帧曝光与清晰度，负向确认含 `changing clothes, changing hairstyle`；seed 保持，换 seed 只 `+1`。
  - 镜头过快、叠玻璃后闪：去掉提示词里的 `follow`/`fast` 类词，加 `very slow, steady`；必要时成片放慢到 0.95×。
  - 出现第二个她：负向补 `duplicate girl, second person, reflection`，检查首帧是否含镜子/水面。

### 3.2 Shot B「展开」——侧移 + 升高拉远，宽幅海天全景

- **用途**：hero 5~11 s；把“竖屏跟拍”升级成“电影宽幅”，给玻璃卡片腾出左侧干净天空。
- **首帧输入**：**Shot A 的最后一帧** （已 16:9，不需要再 outpaint）。这是本方案的关键：A 尾 = B 首，同一时刻换广角镜头，A→B 是一个“镜头切”而不是“场景跳”。
- **时长/帧数**：145 帧 @ 24 fps = **6.04 s**（4n+1 合法）。
- **生成分辨率 → 成片**：960×544，超分后 1920×1080。
- **机位**：从 A 的低机位背后跟拍，**升高 + 后拉 + 向左横移**，变成高一点的宽幅 establishing；太阳仍在画面深处偏右。
- **运动**：单次连续 crane（升 + 退 + 左移），速度一条曲线，不要中途反向；少女快速变成“右下角小人”；左侧 55% 铺开天空、积云和远海；城镇与海平线在下方 1/4 展开。
- **安全区**：少女落在 **x 66%~78%，y 72%~92%**；中心 60%×50% 只有天空/云/雾化海面；**地平线压到 y 66%~70%**，避免高对比海平线穿过卡片中心。
- **中文要点**：这一镜决定“hero 像不像电影海报”。提示词必须出现指定短语 `coastal cliff road, harbor town below, sea horizon, wide establishing shot`，同时用 `very slow, steady crane, no shake` 压制模型自作主张的快摇。16:9 横向扩展的三种做法见 §5.3：① VACE outpainting（推荐，透视统一）；② I2V + 16:9 宽画布 + 左右补景（最快，但易重画）；③ SDXL/Flux Fill 先扩静帧再 I2V（与图组共用流程）。本镜首帧已是 16:9，无需再扩；只有“从源片直接起 B”时才需要 VACE 横向重绘。
- **提示词**：
  - 正向：`prompts/comfy/shot-b.pos.txt`
  - 负向：`prompts/comfy/shot-b.neg.txt`（= NEG-BASE + 运动负向 + B 专属）
- **参数**：同 A，帧数 145，seed `20261021`，其余不变（steps 28 / CFG 5.0 / uni_pc / simple / shift 8.0 / denoise 1.0）。
- **节点链关键设置**：同 §3.0，`Wan22ImageToVideoLatent` length 改为 145，`start_image` = A 尾帧转出的 960×544 PNG，其余连线不变。
- **输出**：
  - 母版：`design/source/wan/shot-b_v1_960x544_s20261021.mp4` ＋ 同名 `.txt`
  - 网页：poster 从成片 **t≈6.5 s（B 段中段）**抽帧 → `public/hero/poster.jpg`（1920×1080、≤180 KB，另出 1080×1920 移动版）
- **验收（10 秒）**：
  - [ ] 少女 x 66%~78%、y 72%~92%，明显比 A 小；中心 60%×50% 只剩天空/云/雾化海面。
  - [ ] 地平线 y 66%~70%，无高对比海平线穿中心；crane 单向、无快摇。
  - [ ] A 尾 → B 首亮度差 ≤ 3%；B 尾帧抽出来准备给 C。
- **失败处理**（只改一个变量；最多重试 2 次）：
  - **145 帧略超官方 121 帧训练长度**：如果尾段出现人物/云崩坏，退回 121 帧生成（5.04 s），再用 RIFE 0.85× 慢放补到约 5.9 s；宁可短一点，不要尾段发散。
  - **拉远幅度不够**（I2V 容易“舍不得”缩小主体）：用合成首帧——把 A 尾帧缩到 **70%**、贴到 16:9 画布右下三分之一，左侧用 VACE 补天空/海，跑同一提示词；此时 A→B 从叠化改成**硬切**（0.5 s 叠化会露出两套透视）。这是唯一允许的“剪辑上做假”的地方，优先还是靠提示词跑出来。
  - 透视断裂/第二个城镇：负向保留 `tilted horizon, warped horizon, floating buildings, melting town, duplicated rooftops, distorted power lines`。

### 3.3 Shot C「收尾 / 回环」——慢动作回眸 → 天空收尾

- **用途**：hero 11~17 s；给用户一个“脸”的记忆点（验收要求至少 2 个镜头能看清脸），并落到干净天空准备循环。
- **首帧输入**：**Shot B 的最后一帧**（宽幅、她很小、天空大）。
- **时长/帧数**：生成 **73 帧 @ 24 fps = 3.04 s**；RIFE 2× → 146 帧，按 24 fps 播放 = **6.08 s、0.5× 慢动作**。
- **生成分辨率 → 成片**：960×544，超分后 1920×1080。
- **机位**：从 B 的远景**缓慢推近 + 轻微下压**到她的侧后方，再**上摇**离开她，画面被天空填满。
- **运动**：0.5× 慢动作；她做一个很轻的侧身回眸（只转上半身，身体不甩），头发/宽袖被风带起，短促地看一眼镜头方向；随后镜头缓慢上摇，她变成右下角一个小剪影，最后 1 s 画面几乎只有云。
- **安全区**：回眸时她的脸落在 **x 60%~72%、y 22%~45%**（避开中心正中央）；上摇后天空占 ≥ 85%，她在右下且高度 ≤ 画面 10%，地平线退到最底部或画外。
- **尾帧构图要求（循环接缝用，4 条全过）**：
  1. 天空占比 **≥ 80%**，只保留积云和光晕；
  2. 少女剪影存在但很小，**中心 x 与 A 首帧少女中心 x 对齐（都约 68%）**，这样交叉淡化时是“同位置放大”，不会出现两个少女；
  3. 尾帧平均亮度与 A 首帧差 **≤ 3%**，色温同一侧（暖）；最后 6 帧亮度曲线平稳，不要突然变亮/变暗；
  4. 没有任何新物体（电线杆、鸟、粉球）进场。
- **中文要点**：**回眸不要做成“转身看镜头”**——Wan 很容易把脸转正然后脸崩；写成 `looks back over her shoulder toward the camera`，并且用慢动作、侧脸，成功率最高。生成 73 帧就够，剩下的“慢”交给 RIFE，不要用 121 帧再慢放（会 12 s，太长）。
- **提示词**：
  - 正向：`prompts/comfy/shot-c.pos.txt`
  - 负向：`prompts/comfy/shot-c.neg.txt`（源方案原样，含 `profile morphing into front view, extra face` 等 C 专属）
- **参数**：生成 73f，seed `20261022`，steps 28、CFG 5.0、`uni_pc` / `simple` / shift 8.0、denoise 1.0；后期 RIFE 2× + 0.5× 播放（§7.1）。
- **节点链关键设置**：同 §3.0，`Wan22ImageToVideoLatent` length 改为 73；后期 `RIFE`（2×）在独立进程跑。
- **输出**：
  - 母版：`design/source/wan/shot-c_v1_73f_s20261022.mp4` ＋ 同名 `.txt`
  - 网页：并入成片（C 段按 0.5× 慢放播放，见 §9.1）
- **验收（10 秒）**：
  - [ ] 回眸是侧脸/侧后方，不是正脸对镜头；脸在 x 60%~72%、y 22%~45%，脸不崩。
  - [ ] 尾帧天空 ≥ 80%，少女中心 x≈68%，无新物体；尾帧与 A 首帧亮度差 ≤ 3%（用示波器/吸管）。
  - [ ] 0.5× 慢放后无 RIFE 双重轮廓（尤其回眸那 0.5 s）。
- **失败处理**（只改一个变量；最多重试 2 次）：
  - 脸被转正/变形：确认提示词为 `looks back over her shoulder toward the camera`，负向含 `profile morphing into front view, melting face, extra face`；缩短回眸幅度（只转上半身）。
  - 尾帧天空不足 80%：把上摇写成 `tilts up and pulls away`，或把 B 尾帧的构图再压低地平线后重跑。
  - 回眸不够清晰：73 帧不够就试 81 帧（3.375 s → 0.5× 后 6.75 s，成片 ≈ 16.1 s，仍在 15~18 s 内）。

---

## 4. 循环版（接缝 + 兜底）

### 4.1 接缝设计（先定“循环锚点”）

- **循环锚点 = Shot A 首帧**：明亮逆光、天空占 50~55%、少女在右三分之一、无高对比物体。
- **Shot C 尾帧**必须收敛到这个锚点：天空 ≥ 80%、少女小剪影在右下、中心 x ≈ 68%、暖调、亮度接近。
- 两条路线，按预算二选一：
  - **路线 1（推荐，最稳）**：FLF2V 生成 0.8~1.0 s 桥接镜头，把 C 尾“接”到 A 首，再在剪辑里用 6~8 帧叠化藏住 FLF2V 的两端。
  - **路线 2（零 GPU，剪辑解决）**：C 尾 18 帧（0.75 s）与 A 首 18 帧做交叉淡化；因为两者少女中心 x 对齐，观众看到的是“同一个她由小变大”，不是两个主体。

### 4.2 FLF2V 接缝提示词（路线 1，云 GPU）

- **模型**：Wan2.1 FLF2V-14B（720p，fp8；6 GB 本地不可行，云 GPU 24 GB 起）。
- **帧数**：25 帧 @ 24 fps ≈ 1.04 s（4n+1 合法；13 帧 ≈ 0.54 s 也行）。
- **首帧**：`C_last_960x544.png`；**尾帧**：`A_start_960x544.png`。两端必须是 4n+1 同尺寸图，不要混分辨率。
- **机位**：锁定不动的轻微上摇延续，只有云动 + 她由远及近的一点点。
- **中文要点**：桥接镜头不要“重新构图”，只做“同一个镜头继续呼吸”：云继续漂、光晕继续呼吸、她只是轻轻放大。这样两端才能对得上。
- **提示词**：
  - 正向：`prompts/comfy/seam-flf2v.pos.txt`
  - 负向：`prompts/comfy/seam-flf2v.neg.txt`
- **参数**：FLF2V-14B（云），1280×704，25 f，24 fps，steps 24，CFG 5.0，`uni_pc` / `simple`，shift 8.0，denoise 1.0，seed `20261025`。
- **节点链关键设置**：

```text
LoadImage(C_last) → 起帧
LoadImage(A_start) → 止帧
WanFirstLastFrameToVideo（width 1280, height 704, length 25, batch 1）
  → KSampler（steps 24, cfg 5, uni_pc, shift 8）→ VAEDecodeTiled → SaveVideo 24 fps
```

- 版本提醒：`WanFirstLastFrameToVideo` 在部分版本叫 `WanFirstLastFrameToVideo` 或带 `Wan2.1` 前缀；按节点类型和输入口关系识别（首帧/尾帧/positive/negative/vae/width/height/length）。
- **输出**：`design/source/wan/seam-c2a_v1_1280x704_s20261025.mp4`；两端各 4 帧叠化后并入成片。
- **验收**：两端各 4 帧叠化后肉眼无跳变；桥接段内无新物体、无重新构图；不用 FLF2V 时改走 §4.3。

### 4.3 交叉淡化参数（路线 2，剪辑软件里做）

- 重叠 **18 帧 @ 24 fps = 0.75 s**；A 首帧在这 0.75 s 内从 0% 渐显到 100%。
- 叠化曲线用 **ease-in-out**，不要线性；叠化期间加一层 10~15% 的暖色光晕/漏光（opacity 12%），可以掩盖少女轮廓的重影。
- 叠化后成片**总长 = 16.16 − 0.75 = 15.41 s**；播放器 `loop` 时不会出现黑帧/跳帧。
- 检查：把成片首尾各 1 s 抽帧对比，亮度差 ≤ 3%，SSIM（首帧 vs 尾帧同位置）≥ 0.80 即肉眼无感。

> 精确的“尾叠首”做法（不依赖剪辑软件）：把整条线性片（L=16.16 s）拆成 head[0, d]、mid[d, L−d]、tail[L−d, L]，用 `xfade` 把 tail 叠到 head 上，再拼 mid，输出长度 L−d。ffmpeg 示例（命令按源方案原样保留；本机未安装 ffmpeg）：

```bash
# d=0.75s, L=16.16s, 24fps
ffmpeg -i hero_linear_24fps.mp4 -filter_complex "
[0:v]split=3[h][t][m];
[h]trim=start=0:end=0.75,setpts=PTS-STARTPTS[head];
[t]trim=start=15.41:end=16.16,setpts=PTS-STARTPTS[tail];
[m]trim=start=0.75:end=15.41,setpts=PTS-STARTPTS[mid];
[tail][head]xfade=transition=fade:duration=0.75:offset=0[blend];
[blend][mid]concat=n=2:v=1:a=0[out]" -map "[out]" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero_loop_v1.mp4
```

### 4.4 「静止天空 + 微动云 + 粒子」兜底 loop（V4）

- **用途**：视频加载前/低性能设备/`prefers-reduced-motion` 的静态化替代；也可当网站二级区块背景。
- **模型**：Wan2.2 TI2V-5B，T2V（无首帧），832×480，145 帧 @ 24 fps = 6.04 s；循环裁成 121 帧 = 5.04 s（`d=1 s` 尾叠首，见 4.3 公式）。
- **机位**：完全锁定（locked-off static），无推拉摇移，三脚架感。
- **运动**：云以“几乎察觉不到”的速度横向漂移；灰尘/花粉粒子在逆光里缓慢上浮；光晕强度缓慢呼吸（±5%）；无任何主体入画。
- **中文要点**：**镜头完全锁死**，只让云极慢漂、粒子微动；中心亮度均匀偏低对比，方便任何位置压字。这条不建议放少女，纯环境；它是“视频加载前/低性能设备”的兜底，不是主片。
- **提示词**：
  - 正向：`prompts/comfy/v4-loop.pos.txt`（**不合并角色卡/世界卡**：源块明确要求“无主体、无地面”，负向含 `subject, person, ground`，合并会自相矛盾；源块本身已含风格尾巴）
  - 负向：`prompts/comfy/v4-loop.neg.txt`
- **参数**：832×480，145 f，24 fps，steps 24，CFG 4.5，`euler` / `simple`，shift 8.0，denoise 1.0，seed `20261023`。
- **输出**：`design/source/wan/loop-sky_v1_832x480_s20261023.mp4`（超分到 1920×1080 后使用）。
- **验收**：镜头完全锁死；中心亮度均匀低对比；循环无黑帧；不出现地平线/建筑/鸟/飞机。

### 4.5 可选加映：D 变体「黄昏金调 + 极轻粉反光」

- **用途**：给客户二选一；或做 OG 图/分享图的动态版。
- **首帧**：`A_last_960x544.png`（与 B 同一时刻，保证是同一世界）+ 黄昏重打光。
- **时长/帧数**：145 帧 @ 24 fps = 6.04 s（与 B 同构图、同运镜，方便 A/B 对比）。
- **机位**：同 Shot B（低机位转高机位、后拉 + 左移的 single crane）。
- **运动**：同 Shot B 的速度曲线，但整体更慢一点（黄昏光线更“黏”）；云层只做缓慢翻涌，不做时间流逝。
- **参数微调**：steps 28、CFG 4.5（降一点防过饱和）、seed `20261024`；后期暖调 LUT + 粉光只加在光晕和皮肤边缘。
- **中文要点**：**不要整屏粉**。粉红 `#E5355B` 在这条里只作为“镜头光晕里的一点珊瑚粉”和“滑板桥/护栏的冷铬反光旁边的一点暖粉”，面积 < 5%，否则和网站玻璃 UI 抢戏。
- **提示词**：
  - 正向：`prompts/comfy/d-variant.pos.txt`
  - 负向：`prompts/comfy/d-variant.neg.txt`（= Shot B 负向 + D 追加词，以 `, ` 连接）
- **输出**：`design/source/wan/shot-d_v1_960x544_s20261024.mp4`。

---

## 5. 竖屏 → 16:9：VACE 链路与首帧验收

### 5.1 总体流程（只扩一次，后面全部继承）

```text
源片尾帧（608×1092，已去水印 → 608×1024）
  → 缩放至高 704（≈418×704），贴到 1280×704 画布右侧三分之一（她落在右三分之一）
  → VACE 横向 outpainting（左/上/下补景：天空、云、公路、护栏、远城、海）
  → 得到 A_start_16x9.png（1280×704 或 960×544）
  → Wan2.2 TI2V-5B I2V 生成 Shot A
  → A 尾帧 → Shot B 首帧 → B 尾帧 → Shot C 首帧（后面全是 16:9，无需再扩）
```

- **为什么只扩一次**：竖屏扩展的难点是“左右补什么”，而 B/C 的构图本来就要重新安排（她变小、天空变大），从上一镜尾帧续写比从源片重新扩更稳、更省。
- **扩展的分辨率**：6 GB 本地用 **VACE-1.3B @ 960×544** 做首帧即可；要 1280×704 高质量首帧，用云上的 **VACE-14B fp8**。首帧后续会被 5B 再编码，**不要拿 4× 放大的源图硬喂**（压缩噪点会被 I2V 放大）。
- 产物路径：`design/source/frames/clean/A_start_16x9.png`（本项目约定；源方案写作 `frames/clean/A_start_16x9.png`）。

### 5.2 VACE 横向重绘（ComfyUI 原生节点链，6 GB 可跑 1.3B）

> 节点：`LoadImage` → `ImageScale`（把 608×1024 缩到高 704，约 418×704）→ `ImagePadForOutpaint` / 手工合成到 1280×704 → `WanVaceToVideo`（`control_video`=合成图，`control_masks`=补全区白/原图黑，`strength` 1.0）→ `KSampler` → `VAEDecodeTiled` → `SaveImage`。不同版本 `WanVaceToVideo` 的输入名可能略有不同，认准 “positive / negative / vae / control_video / control_masks / width / height / length / strength”。

- **模型**：Wan2.1 VACE-1.3B（fp8/fp16 均可，约 4~5 GB 显存）或 VACE-14B（云）。
- **参数**：1280×704（1.3B 若 OOM 降到 960×544），长 1 帧（静帧扩展）或 5 帧（更稳），steps 30，CFG 5.0，sampler `uni_pc`，scheduler `simple`，shift 8，denoise 1.0；`strength` 1.0。
- **mask**：原图区域黑（保留），新增区域白（重绘），羽化 24~32 px；**mask 要盖住“画面最左/最右各 15%”防止接缝**。
- **中文要点**：VACE 补出来的左侧必须是“同一条公路的延续 + 低对比天空”，不要补出第二个城镇或第二个人。提示词只描述补全区该有什么，不要重复描述少女。
- **提示词**：
  - 正向：`prompts/comfy/vace-extend.pos.txt`
  - 负向：`prompts/comfy/vace-extend.neg.txt`
- **节点链关键设置**：

```text
LoadImage(源片尾帧清洗版) → ImageScale(高 704) → 合成到 1280×704（右侧三分之一）
  → 生成 control_video（同一张图重复或 5 帧） + control_masks（补全区白）
  → WanVaceToVideo（width 1280, height 704, length 1/5, strength 1.0）
  → KSampler（steps 30, cfg 5, uni_pc, simple, shift 8, denoise 1.0）
  → VAEDecodeTiled → SaveImage(A_start_16x9.png)
```

### 5.3 备选路线对比（同一件事的三种做法）

| 做法 | 工具 | 成本 | 质量 | 适用 |
|---|---|---|---|---|
| VACE 横向重绘 | Wan2.1 VACE-1.3B（本地）/ 14B（云） | 中 | 高，透视统一 | **推荐**，本方案默认 |
| I2V + 宽画布 + 左右补景 | Wan2.2 TI2V-5B，把竖屏图贴在 16:9 画布中央直接 I2V | 低 | 中，模型会“重画”两侧，易出第二个她 | 赶时间/试构图 |
| SDXL / Flux Fill 先扩图，再 I2V | ComfyUI 的 SDXL inpaint / Flux Fill | 低（图组已有 SD 流程） | 中高，静帧质量好，但风格可能偏写实 | 与 SD 图组共用工作流时 |

### 5.4 A 首帧验收（不通过就不要开生成）

- [ ] 没有文字/水印/UI 残留（把图放大 200% 看左下角）。
- [ ] 公路的透视线、护栏、电线杆走向连续，没有“折线”。
- [ ] 光向一致：太阳在右上，影子朝左下；扩展区不能出现第二个高光。
- [ ] 少女中心 x 在 **62%~78%**，头顶距上边缘 ≥ 6%，滑板完整可见。
- [ ] 天空没有色带；新补的天空与源图天空色差 ΔE ≤ 5。
- [ ] 输出尺寸严格 960×544（或 1280×704），不要 963×541 这种非 16 倍数（VAE 会裁）。

---

## 6. 6 GB 工作流与参数总表

### 6.1 硬件现实（RTX 3060 Laptop ≈ 6 GB）

| 项 | 数值/做法 |
|---|---|
| 可用显存 | 约 5.6~5.9 GB（Windows 桌面 + 浏览器会吃掉 0.5~1 GB，跑之前关浏览器/游戏） |
| 主力模型 | Wan2.2 TI2V-5B：`wan2.2_ti2v_5B_fp8_scaled.safetensors`（约 5 GB 权重）或 GGUF `Q5_K_M`（约 4.3 GB）/ `Q4_K_M`（约 3.6 GB） |
| 文本编码器 | `umt5_xxl_fp8_e4m3fn_scaled.safetensors`（约 5 GB）→ **CLIPLoader 的 device 设为 `cpu`**，编码完再卸载，别和 UNet 同时驻显存 |
| VAE | `wan2.2_vae.safetensors`（5B 专用，**不能**用 Wan2.1 的 VAE） |
| 解码 | `VAEDecodeTiled`：tile 256、overlap 64、temporal_size 16、temporal_overlap 4；121 帧 960×544 能过，OOM 就把 tile 降到 192 |
| 启动参数 | `--reserve-vram 0.8`；环境变量 `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`；不要开 `--highvram` |
| 预期速度（粗估） | 5B fp8 960×544×121：**12~20 min/条**；GGUF Q5 约 10~16 min；832×480 约 7~12 min。1280×704 在 6 GB 上基本不可行（就算 Q4 也要分块解码 + 30 min+，不建议） |

### 6.2 模型路线与取舍

| 路线 | 模型/文件 | 本地 6 GB | 分辨率/帧数 | 用途 | 取舍 |
|---|---|---|---|---|---|
| **首选** | Wan2.2 TI2V-5B（fp8 / GGUF Q5） | ✅ 可跑 | 960×544×121/145（超分到 1920×1080） | A/B/C/V4/D 全部 | 画质够 hero、速度可接受；1280×704 本地放弃 |
| 14B I2V | Wan2.2 I2V-A14B 高/低噪双专家（fp8） | ❌ 权重就 >14 GB | 832×480×81 @16 fps 或 1280×704×81（云 24~40 GB） | 只在对画质有极致要求时，云 GPU 跑 | 双专家要两段采样，参数更复杂；本地别试 |
| VACE | Wan2.1 VACE-1.3B（本地）/ VACE-14B（云） | ✅ 1.3B，960×544 | 静帧/短视频 outpaint | A 首帧扩展、拆水印 inpaint | 1.3B 细节一般但透视够用；14B 效果最好 |
| FLF2V | Wan2.1 FLF2V-14B（720p fp8） | ❌ | 1280×704×25 | C→A 循环桥接 | 只跑 1 s 桥接，云上几分钟；本地用交叉淡化替代 |
| 超分 | Real-ESRGAN（anime 6B / Remacri）、RIFE | ✅ | 逐帧 | 清晰度链路 | 见 §7 |
| 加速（可选） | Wan2.2 5B 4-step distill LoRA（lightx2v 类） | ✅ | 同分辨率 | 出草稿/试构图 | 4~8 步出片，云会偏糊/闪；定稿仍用 20~30 步 |

> 官方 5B 模板的基准参数：`Wan22ImageToVideoLatent` 1280×704 / 121 帧，KSampler steps 20、CFG 5、`uni_pc`、`simple`，`ModelSamplingSD3` shift 8，`CreateVideo` 24 fps。本文在此基础上为“连续性/清晰度”把 steps 提到 28。参考：[ComfyUI 官方 Wan2.2 5B 工作流](https://comfy.org/workflows/video_wan2_2_5B_ti2v-f83ee3caa04e/)。

### 6.3 节点链（ComfyUI 原生 Wan 节点）

**A/B/C 通用（I2V）**

```text
LoadImage(A_start_16x9.png)
  → ImageScale（lanczos，960×544，crop=center）
  → [VAE] ─┐
            ├→ Wan22ImageToVideoLatent（width 960, height 544, length 121/145/73, batch 1, start_image）
[UNETLoader] → ModelSamplingSD3(shift 8.0) → KSampler ← [CLIPLoader → CLIPTextEncode 正/负]
            └→ VAEDecodeTiled → SaveImage / VHS_VideoCombine(24 fps)
```

**首帧 16:9 扩展（VACE）**

```text
LoadImage(源片尾帧清洗版) → ImageScale(高 704) → 合成到 1280×704（右侧三分之一）
  → 生成 control_video（同一张图重复或 5 帧） + control_masks（补全区白）
  → WanVaceToVideo（width 1280, height 704, length 1/5, strength 1.0）
  → KSampler（steps 30, cfg 5, uni_pc, simple, shift 8, denoise 1.0）
  → VAEDecodeTiled → SaveImage(A_start_16x9.png)
```

**循环桥接（FLF2V，云）**

```text
LoadImage(C_last) → 起帧
LoadImage(A_start) → 止帧
WanFirstLastFrameToVideo（width 1280, height 704, length 25, batch 1）
  → KSampler（steps 24, cfg 5, uni_pc, shift 8）→ VAEDecodeTiled → SaveVideo 24 fps
```

> 版本提醒：`WanFirstLastFrameToVideo` 在部分版本叫 `WanFirstLastFrameToVideo` 或带 `Wan2.1` 前缀；`Wan22ImageToVideoLatent` 是 5B 专用（内部用 Wan2.2 VAE），**不要**用 Wan2.1 的 `WanImageToVideo` 配 5B 模型，会报 VAE/通道不匹配。节点标题以本机安装版本为准，接线以本文描述为准。

### 6.4 参数总表（直接照抄）

| 镜头 | 模型/精度 | 生成分辨率 | 帧数 | fps | 成片时长 | steps | CFG | sampler / scheduler | shift | denoise | seed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | TI2V-5B fp8（或 Q5） | 960×544 | 121 | 24 | 5.04 s | 28 | 5.0 | uni_pc / simple | 8.0 | 1.0 | 20261020 |
| B | 同上 | 960×544 | 145 | 24 | 6.04 s | 28 | 5.0 | uni_pc / simple | 8.0 | 1.0 | 20261021 |
| C | 同上 | 960×544 | 73 | 24 | 3.04 s → 0.5× 后 6.08 s | 28 | 5.0 | uni_pc / simple | 8.0 | 1.0 | 20261022 |
| V4 | 同上（T2V） | 832×480 | 145 | 24 | 6.04 s → 循环裁 5.04 s | 24 | 4.5 | euler / simple | 8.0 | 1.0 | 20261023 |
| D | 同上 | 960×544 | 145 | 24 | 6.04 s | 28 | 4.5 | uni_pc / simple | 8.0 | 1.0 | 20261024 |
| A 首帧扩展 | VACE-1.3B | 960×544（或 1280×704） | 1~5 | — | 静帧 | 30 | 5.0 | uni_pc / simple | 8.0 | 1.0 | 20261019 |
| 循环桥接 | FLF2V-14B（云） | 1280×704 | 25 | 24 | 1.04 s | 24 | 5.0 | uni_pc / simple | 8.0 | 1.0 | 20261025 |
| 超分 refine（可选，云） | 同 5B 低噪 | 1920×1088 | 分段 33 | 24 | — | 15 | 4.5 | euler / normal | 8.0 | 0.35 | 同段 |
| 超分（本地推荐） | Real-ESRGAN 4× → 降采样 | 3840×2176 → 1920×1080 | 逐帧 | — | — | — | — | — | — | — | — |
| 补帧 | RIFE 2× | — | — | — | 48 fps 母版 | — | — | — | — | — | — |

> 帧数换算备忘：5B 原生 **24 fps**，`121f = 5.04 s`；14B I2V 原生 **16 fps**，`81f = 5.06 s`；两种不要混用同一时间基。5B 的 121/145/73 帧都满足 4n+1（VAE 时间压缩 4×）。steps 建议 **20~30**（本方案 28；草稿 20）、CFG **3.5~5**（本方案 5.0；14B 用 3.5~4.5）。

**sampler 怎么选**

- `uni_pc`：官方默认，稳定、云层干净，**默认用它**。
- `euler`：快一点，云更柔，适合 V4 纯天空。
- `dpmpp_2m`：细节多，但慢动作/云边容易闪，**不建议 hero 用**。

**denoise 怎么用**

- I2V 生成永远 **1.0**（latent 里已经含首帧，denoise 低了人物会“粘”住不动）。
- 只有两种场景用低 denoise：① 超分后的 latent refine（0.30~0.40，且要分段跑防 OOM）；② 接缝帧的微调（0.15~0.25，只修 1~2 帧，别整段）。
- 本地 6 GB 更推荐走 **Real-ESRGAN 逐帧超分**，不跑 latent refine——省显存，也不会把噪点放大成“油彩”。

**seed 策略**

- 同一段固定 seed 重跑只改 prompt；要换运动就 `+1`，不要乱跳。
- 换镜头时 seed 可以不同（B/C 靠“上一镜尾帧”保证连续），但建议 `+1` 递增方便回溯。
- 每个最终采用的 seed 写进同名 `.txt`，和提示词、模型 hash 一起归档（见 §9.4）。

### 6.5 6 GB 显存操作要点（踩坑清单）

1. **CLIP 放 CPU**：`CLIPLoader` 的 device 选 `cpu`，prompt 编码慢 10~20 s，但省 4~5 GB。
2. **VAE 分块解码**：121 帧 960×544 不 tiled 解码大概率 OOM；tile 256/overlap 64 起步，OOM 再降 192。
3. **GGUF 救急**：fp8 版 OOM 就换 `Q5_K_M`；画质差异在 hero 尺寸下肉眼几乎不可见，但**云的高光边缘**会稍软，可接受。
4. **一次只挂一个模型**：生成前重启 ComfyUI，避免上一轮残留；跑之前关浏览器/微信/游戏。
5. **不要开 `--highvram`**；`--reserve-vram 0.8` 给系统留余量；Windows 虚拟内存设到 16 GB+（防溢出崩溃）。
6. **单段跑、不要 batch**：batch >1 必 OOM；一次一条，分三条跑完再剪。
7. **超分/补帧放到最后**：ComfyUI 里先只做生成，超分用独立进程/脚本逐帧跑，崩了不会毁掉整段。

### 6.6 提词实操顺序（同一 seed 下迭代）

1. 先用 4-step LoRA 或 832×480 快速出 3 版构图，**只验构图/主体位置**（不看画质）。
2. 选定首帧和 seed，升到 960×544、28 步出正式版；每条跑 2 个 seed（如 `20261020` / `20261021`）挑一个。
3. 尾帧出来先做“接缝预检”：把尾帧和下一镜首帧并排看，亮度/色温/地平线差多少，差太多就先调提示词，不要等剪完再救。
4. 三条都满意后再进超分/补帧，避免“超分了才发现要重跑”。

---

## 7. 清晰度链路（清晰是毛玻璃质感的前提）

> 原则：**生成阶段分辨率够 + 超分只放大一次 + 补帧在超分之后 + 最后才锐化**。任何一步反过来都会把噪点/压缩块放大。

### 7.1 推荐链路（本地 6 GB 可执行）

```text
5B 生成 960×544×121/145/73
  → VAEDecodeTiled 出 PNG 序列
  → Real-ESRGAN 4×（anime 6B 或 Remacri，逐帧；3840×2176）
  → Lanczos 降采样到 1920×1080（先 4× 再降，比直接 2× 干净）
  → RIFE 2× 补到 48 fps（只对 A/B；C 直接用 2× 做 0.5× 慢放）
  → 去闪烁 + 轻时域降噪（ffmpeg deflicker + hqdn3d，见 7.2）
  → 轻锐化（unsharp，见 7.2）
  → 统一调色 LUT + 1%~3% 颗粒
  → 输出母版 / 网页版
```

- **ESRGAN 模型选择**：
  - `RealESRGAN_x4plus_anime_6B`：线稿/人物边缘最干净，**默认**。
  - `4x_foolhardy_Remacri`：云层/绘画感更好，但人物边缘略软；如果 hero 以云为主可以试。
  - 不要用 `4x-UltraSharp` 之类强锐化模型，天空会出“油彩块”，毛玻璃后非常明显。
- **要不要 latent 超分 refine**：云 GPU 上可以做 `LatentUpscale 1920×1088 + KSampler denoise 0.30~0.35（分段 33 帧）`，云会更立体；**6 GB 本地不要做**，OOM 风险高且容易把噪点 refine 成纹理。
- **补帧注意**：RIFE 在**电线、护栏、头发丝**上容易撕裂；hero 镜头运动慢，2× 足够；如果撕裂明显，改用 FILM 或直接 24 fps 交付（见 §7.4）。

### 7.2 去闪烁 / 降噪 / 锐化 / 调色（ffmpeg，命令按源方案原样保留；本机未安装 ffmpeg）

```bash
# 去闪烁 + 轻时域降噪（先做这个，再做锐化）
ffmpeg -i in_1080p24.mp4 -vf "deflicker=size=10:mode=pm,hqdn3d=1.0:1.0:4:4" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p tmp_denoise.mp4

# 轻锐化（宁轻勿重：0.3~0.5 之间；超过 0.8 毛玻璃后会“发脏”）
ffmpeg -i tmp_denoise.mp4 -vf "unsharp=5:5:0.4:5:5:0.0" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p tmp_sharp.mp4

# 统一调色（.cube LUT；没有 LUT 时用 eq/curves 做等效）
ffmpeg -i tmp_sharp.mp4 -vf "lut3d=hero_grade_v1.cube" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p graded.mp4
```

- **LUT 目标**：暗部轻微压蓝（往 `#1A6BD6` 的冷蓝走一点）、高光保云白 `#F4F8FC` 不过曝、中间调保持路面暖灰；整体对比不要拉太高（中心安全区要低对比）。
- **颗粒**：1%~3%（`noise=alls=6:allf=t+u` 或后期软件加），**必须有**：大范围天空在 8-bit H.264 里没有颗粒会出色带，毛玻璃一糊就是“脏玻璃”。
- 颗粒要**统一加在成片**，不要每段单独加（强度不同会在转场处闪）。

### 7.3 超分/补帧的质检

- [ ] 1080p 下头发/电线/护栏边缘没有“锯齿爬行”（逐帧播放看）。
- [ ] 云的暗部没有块状色带（用示波器/吸管看天空渐变）。
- [ ] RIFE 补帧后没有“双重轮廓”（尤其她回眸那 0.5 s）。
- [ ] 中心安全区放大到 200% 看：没有噪点被锐化成“沙粒”。

### 7.4 24 → 30 / 60 fps 交付（按客户要求选）

- **默认建议**：母版 24 fps 留档；网页版按项目规格交 **30 fps**（24→30 只多 25% 帧，文件可控）。
- **30 fps 做法（推荐）**：

```bash
# 方案 1：运动补偿插帧（质量最好，1080p/15 s 约 3~8 min）
ffmpeg -i graded_24fps.mp4 -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero_30fps.mp4
# 方案 2：不插帧，直接重采样（最快，天空/慢动作几乎看不出；有快速横移会轻微顿）
ffmpeg -i graded_24fps.mp4 -vf "fps=30" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero_30fps.mp4
```

- **60 fps 做法**：Wan 24 fps → RIFE 2× = **48 fps** 已经是镜头运动的舒适区，直接按 48 fps 交付即可；硬凑 60 再从 48 `minterpolate=fps=60`，码率约 ×1.5~2，hero 不建议。
- **顺序不能反**：**生成 → 超分到 1080p → 补帧/改帧率 → 去闪烁/降噪/锐化 → 调色加颗粒 → 编码**。先补帧再超分，RIFE 的糊边会被 ESRGAN 放大成“油画笔触”。
- **时长不变**：无音轨，改帧率只改帧数不改时长（15.41 s 仍是 15.41 s）；loop 首尾帧号在 24 fps 时间基上算好，再转 30 fps，不要在两套时间基里混剪。
- **命名**：`hero-1080-24fps-master.mp4` / `hero-1080-30fps.mp4` 都留档，网页引用 30 fps 版；`.txt` 里注明“母版 24fps / 交付 30fps”。本项目落盘位置见 §9.4（母版进 `design/source/wan/`，网页版进 `public/hero/`）。

---

## 8. 适配毛玻璃：构图 / 运动 / 安全区规则

> 玻璃卡片是 `blur(28px) saturate(1.35)`（见 `01-visual-bible.md`），它会把底层任何高频/高对比/快速变化放大成“脏”。所以视频要**清晰但克制**。

### 8.1 安全区与构图（1920×1080 坐标）

| 规则 | 数值 |
|---|---|
| 中心安全区 | x 384~1536（20%~80%），y 270~810（25%~75%），即 **60%×50%** |
| 中心允许的内容 | 天空、云、远海/远城雾化、浅景深虚化；**不允许**文字、电线杆、高对比建筑、第二个主体 |
| 少女位置 | 中心 x **62%~78%**；A/B 全身在画面内，C 回眸时脸在 x 60%~72% |
| 地平线 | A：y 52%~58%；B：y 66%~70%（压低，让中心是天空）；C 尾：y ≥ 92% 或画外 |
| 中心区亮度标准差 | 抽 3 帧测中心裁切，**std ≤ 15/255**；局部最大梯度 ≤ 25/255（可用 Python/OpenCV 一行测） |
| 中心区运动 | 逐帧位移 **≤ 2 px（1080p）**；云可以动，但不能有物体快速穿过 |
| 镜头角速度 | **≤ 8°/s**；横移 ≤ 画面宽 2%/s；crane 高度 ≤ 画面高 1.5%/s |
| 禁止 | 快速横摇、甩镜、手持抖动、变速变焦、画面内出现文字/UI/粉球/铬环大特写 |

### 8.2 镜头内运动的写法（Wan 提示词层面）

- 用 `very slow, steady, continuous` 开头限定速度；用 `one slow continuous crane move` 限定“只做一个动作”。
- 不要写 `fast`、`dynamic`、`whip`、`spin`；也不要写 `camera follows her closely`（容易变成第一人称追逐）。
- 云单独给一句 `clouds drift slowly`，让模型知道“动的只有云和她”，背景几乎静止——这是循环和毛玻璃都友好的关键。

### 8.3 毛玻璃自检（生成后、交付前各做一次）

1. 把成片抽 3 帧（A/B/C 各一），在 Figma/PS 里叠相同 CSS：`blur(28px) saturate(1.35) brightness(1.04)` + 白色 12% 玻璃 + 35% 描边。
2. 在玻璃上放标题/输入框/按钮，检查：
   - 正文对底层对比度 ≥ 4.5:1（不够就加 10%~15% 底部 scrim，见 `01-visual-bible.md`）；
   - 玻璃后能**辨认出“云在动、她在滑”**，但不会看到噪点/色带/块效应。
3. 若玻璃后出现“脏斑”：90% 是①中心有高频细节 ②超分锐化过度 ③压缩码率太低。按顺序排查。

---

## 9. 拼接剪辑与导出

### 9.1 时间线（24 fps 时间基）

| 段落 | 素材 | 入点 | 出点 | 时长 | 与下一段关系 |
|---|---|---|---|---|---|
| A | shot-a_v1 | 0 | 5.04 s | 5.04 s | 尾 12 帧与 B 首 12 帧叠化（0.5 s） |
| B | shot-b_v1 | 0 | 6.04 s | 6.04 s | 尾 12 帧与 C 首 12 帧叠化（0.5 s） |
| C | shot-c_v1（0.5× 慢放后） | 0 | 6.08 s | 6.08 s | 尾 18 帧与 A 首 18 帧做循环叠化（0.75 s） |
| 循环 | 尾叠首（§4.3 公式） | — | — | −0.75 s | 成片 **≈15.41 s** |

- **A→B 的 0.5 s 叠化**：因为 B 首帧 = A 尾帧，本质是“换镜头”，叠化几乎看不见；不要用 18 帧长叠化（会糊）。
- **B→C 的 0.5 s 叠化**：B 尾她很小、C 首也是远景，叠化安全。
- **C→A 循环 0.75 s**：参见 §4.1，靠“同位置放大 + 暖光晕”藏重影；不行就上 FLF2V 桥接。
- **速度匹配**：A/B 保持 1.0×；C 用 RIFE 2× 后按 24 fps 播放 = 0.5×；如果 B 的 crane 让画面“显得快”，把 B 放慢到 0.95×（改动 0.3 s 以内，不影响总长）。
- **色温/曝光匹配**：三段用同一个 LUT；每段首尾各取 1 帧，用示波器对齐黑位/白位（白位 235~245，黑位 18~30，别到 0/255）；段间平均亮度差 ≤ 3%，色温差 ≤ 200K。

### 9.2 去闪烁与颗粒（成片级，只做一次；命令按源方案原样保留）

```bash
# 成片统一去闪烁 + 轻降噪 + 加颗粒（1%~3%）
ffmpeg -i hero_linear_24fps.mp4 -vf "deflicker=size=10:mode=pm,hqdn3d=0.8:0.8:3:3,noise=alls=5:allf=t+u" -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p hero_graded.mp4
```

### 9.3 导出规格与转场

| 用途 | 编码 | 参数 |
|---|---|---|
| **母版** | H.264 High / yuv420p，或 ProRes 422 HQ | `-crf 16~18 -preset slow -movflags +faststart -an`；1920×1080 / 24 fps；另留一份 ProRes 给客户改色 |
| **网页 H.264** | H.264 High@4.2 | 1920×1080、**5~8 Mbps 档位（目标 5~6 Mbps）** VBR 2-pass、`-g 48 -keyint_min 48 -sc_threshold 0`、无音轨、faststart；15.4 s ≈ 9~11 MB（天空多、运动慢，压到 4.5 Mbps ≈ 8.5 MB 也可） |
| **网页 WebM VP9** | libvpx-vp9 | `-crf 32 -b:v 0 -row-mt 1 -tile-columns 2 -g 48 -an` |
| **网页 AV1（可选）** | libsvtav1 | `-crf 34 -preset 6 -g 48 -an`，放 `<source>` 第一位 |
| **移动端** | H.264 720×1280 或 1080×1920 | 从源片 9:16 裁切版另出；桌面 hero 视频不要硬裁成竖屏 |
| **poster** | JPEG q82 / AVIF | 从成片 **t≈6.5 s（B 段中段）**取：少女右下、左侧天空干净、毛玻璃压字最稳；1920×1080、≤180 KB；再出 1080×1920 移动版 |

**转场参数落点**

- A→B：12 帧（0.5 s）叠化，ease-in-out。
- B→C：12 帧（0.5 s）叠化。
- C→A：18 帧（0.75 s）叠化 + 12% 暖光晕；或 FLF2V 桥接（§4.2）后两端各 4 帧叠化。
- 所有叠化都**不要**用“白闪/黑场”（hero 循环里会显得像卡顿）；唯一例外是 C 尾上摇到接近白场时，可以借光晕自然过渡。

### 9.4 交付命名、首屏加载与归档

源方案（§9.4）命名 → 本项目落盘：

```text
design/source/wan/                       # 母版与中间产物（不进 public）
  shot-a_v1_960x544_s20261020.mp4
  shot-a_v1_960x544_s20261020.txt        # prompt/negative/seed/steps/cfg/sampler/shift/model hash
  shot-b_v1_960x544_s20261021.mp4
  shot-b_v1_960x544_s20261021.txt
  shot-c_v1_73f_s20261022.mp4
  shot-c_v1_73f_s20261022.txt
  loop-sky_v1_832x480_s20261023.mp4
  loop-sky_v1_832x480_s20261023.txt
  shot-d_v1_960x544_s20261024.mp4        # 可选 D 变体
  seam-c2a_v1_1280x704_s20261025.mp4     # 可选 FLF2V 接缝（云）
  hero-1080-24fps-master.mp4             # 母版（超分/调色后的干净版，留档）
  hero-1080-24fps-master_prores.mov      # ProRes 422 HQ，给客户改色（可选；源方案未规定文件名，执行时定）
design/source/frames/clean/
  A_start_16x9.png                       # 扩展后的首帧（可复现关键）
  end_raw.png / end_clean.png / end_delogo.png / end_alt.png
  C_last_960x544.png / A_start_960x544.png
public/hero/                             # 网页只用压缩版
  hero.mp4                               # H.264 1080p 网页版（源方案 hero-1080-30fps.mp4）
  hero-720p.mp4                          # 720p 降采样档（项目沿用现有文件名）
  hero-9x16.mp4                          # 移动端
  hero-1080.webm                         # VP9 兜底
  hero-1080.av1.webm                     # 可选，Chrome/Edge 优先
  poster.jpg                             # 1920×1080，≤180 KB
```

> 命名与交付对齐：网页侧统一用 `hero-1080.*`，poster 沿用项目现有文件名 `public/hero/poster.jpg`；`-24fps-master` / `-30fps` 只是内部版本区分，上线引用 30 fps 那份即可（本项目上线文件名固定为 `hero.mp4`）。母版（ProRes/高码率 H.264）单独留档，网页只放压缩版。

- **首屏策略**：`<video autoplay muted loop playsinline preload="metadata" poster="/hero/poster.jpg">`；首屏先显示 poster（AVIF/JPEG，`<link rel="preload" as="image">`），hero 进入视口后再 `video.load()` 拉视频（或 `requestIdleCallback` 后注入 `<source>`）。
- **不要在 `<head>` 里 preload 整条视频**：15 s/10 MB 会抢首屏带宽；poster 先到，视频后到，视觉上是“静态海报淡入动态”。
- **循环无黑帧**：H.264 必须 `+faststart`；`loop` 属性 + 成片首尾同帧（§4.3 公式保证）即可；Safari 低电量模式不自动播放，靠 poster 兜底。
- 给视频加 `aria-hidden="true"`、`tabindex="-1"`，避免读屏重复；`prefers-reduced-motion: reduce` 时隐藏视频只留 poster。
- **归档**：每条最终采用的提示词/负向/seed/steps/cfg/sampler/shift/模型版本写进同名 `.txt`（见上），提示词原件在本目录 `prompts/comfy/`，参数机器可读版在 `_fragments/comfy-assets.json`。

---

## 10. 策略对比与水印坑

### 10.1 竖屏源片 → 桌面 16:9 的两种策略

**策略 A：横向重绘扩展（本方案默认）**

- **做法**：把源片/源片尾帧按高度铺满 16:9，左右由 VACE/AI 补全（天空、公路、护栏、远城、海），再 I2V 续写。
- **优点**：真正 16:9 全屏电影感；玻璃卡片背后全是“原生画面”，不存在设计层拼贴感；后续 B/C 天然宽幅。
- **缺点**：成本高（首帧扩展 + 每镜生成 + 超分）；补景区可能出现“第二个城镇/透视断裂”；水印必须先处理。
- **适用**：客户要“电影级 hero”、有 1~2 天 GPU 时间、桌面端为主。

**策略 B：竖屏原片居中 + 左右设计层补齐**

- **做法**：源片按高 1080 居中（约 601×1080），左右各 ~660 px 用**模糊镜像 + 径向渐变 + 云雾/颗粒 + 铬/粉球**等设计层填满；视频只保留中间竖条。
- **优点**：**零 GPU 成本、1~2 天设计即可上线**；源片原汁原味、无水印扩散风险；左右设计层可以完全按网站 UI 语言做（玻璃/铬/粉），品牌感强。
- **缺点**：本质是“竖屏视频放在 16:9 相框里”，中间清晰、两侧虚；如果设计层做得不好会像“手机录屏贴墙纸”；两侧模糊区的运动会和中间不一致（镜像会把她的动作复制到两边，必须用强模糊+低透明度压掉）。
- **适用**：MVP/赶上线、预算有限、或移动端为主（移动端直接用 9:16，不需要 B）。

**判断标准（给客户一句话版）**

| 条件 | 选 A | 选 B |
|---|---|---|
| 桌面 hero 必须是“全屏实拍感” | ✅ | ❌ |
| 预算/时间 ≤ 1 天 | ❌ | ✅ |
| 有云 GPU 或愿意等本地 1~2 小时生成 | ✅ | — |
| 客户能接受左右“设计层”而非纯视频 | ❌ | ✅ |
| 需要 4K/超宽（2560×1080） | ✅（重绘） | ❌（两侧会露馅） |
| 移动端优先 | 移动端单独 9:16 处理 | ✅ |

> **推荐组合**：桌面走 A（本方案 3 镜），移动端走源片 9:16 裁切 + 设计层，互不打架；这样 hero 在两端都成立，且移动端不浪费 GPU。

### 10.2 常见坑与一句话排查（源方案 §11.2）

| 坑 | 现象 | 排查/解决 |
|---|---|---|
| 首帧过曝/过暗 | 生成后天空一片白或人物死黑 | 查首帧直方图：白位 ≤ 245、黑位 ≥ 12；过曝就把首帧整体降 0.3~0.5 EV 再喂，或在提示词加 `balanced exposure, preserved cloud detail` |
| 人物漂移 | 脸变、衣服变色、滑板变绿 | 首帧必须清晰正脸/侧脸；提示词逐字复用角色卡；负向加 `changing clothes, changing hairstyle`；seed 固定，换 seed 只 +1 |
| 镜头运动过快 → 毛玻璃后闪烁 | 叠玻璃后画面“抖/闪” | 镜头角速度压到 ≤8°/s；去掉 `follow`/`fast`；A/B 的 crane 用 `very slow, one continuous move`；必要时把成片放慢到 0.95× |
| 超分后噪点被放大 | 云/暗部出现沙粒、油彩块 | 超分前先 hqdn3d 轻降噪；ESRGAN 换 anime 6B；锐化 ≤0.4；不要用 UltraSharp |
| 循环接缝跳变 | 播到结尾“咔”一下 | 检查首尾帧亮度/构图差；用 §4.3 公式严格裁叠；C 尾少女中心 x 必须对齐 A 首；不行就上 FLF2V |
| 天空色带 | 1080p 渐变出现横条 | 生成时保持 1%~3% 颗粒；母版 10-bit 或高码率；网页 8-bit 前加 dither；不要过度压暗天空 |
| 水印“复活” | 生成画面里出现假字/花纹 | 首帧必须去水印；负向加 `text, watermark`；已污染就重跑，不要后期擦 |
| RIFE 撕裂 | 电线/护栏/头发出现双影 | 降低补帧倍率（只 2×）；或对撕裂段用 FILM；实在不行 24 fps 交付 |
| 三段色温不一致 | A 暖、B 冷、C 灰 | 全部走同一 LUT；以 B 为基准做 Color Match；每段首尾帧对齐白位 |
| 16:9 扩展后地平线断 | 左右补景的海平线接不上 | VACE mask 要覆盖接缝 ±15%；提示词写 `consistent vanishing point and horizon`；重扩，不要后期修 |
| 帧率/时长混淆 | 5B 24 fps 被当成 30 fps，时长变短 | 5B 原生 24 fps、14B I2V 16 fps；时间线统一 24 fps，最后再决定是否补 30 |
| 生成出“第二个她” | 画面里两个少女 | 负向加 `duplicate girl, second person, reflection`；首帧不要放镜子/水面；B 的扩展区不要出现人形 |

---

## 11. SD 与 ComfyUI 的协同规则（源方案 §6）

1. **先生视频、后出图**：视频定下角色、光线、色温后，从成片里抽 3~5 帧做 SD 的 IP-Adapter 参考图，保证网页整体颜色完全一致（不要拿素材原片与成片混用参考）。
2. **同一套色板**：SD 图（尤其粉球/铬环贴纸）与 hero 玻璃卡片共用 `--pink / --chrome-* / --sky` 变量；SD 生成时就在提示词里写清 hex 对应物（pink glowing sphere, chrome torus ring），不要后期硬调。
3. **同一角色**：视频用「尾帧续写 + 同 seed」保连续，图片用「IP-Adapter（角色参考帧）+ ControlNet（姿态）+ 固定 character sheet tag 串」保像同一个人。
4. **不要跨工具借鉴对方素材**：SD 不要拿视频成片直接 img2img 出「新构图」（会带视频压缩噪点和运动模糊）；要用就先用 Real-ESRGAN 放大 + 轻降噪再作参考。
5. **排期建议**：Wan 生成（尤其 14B）是瓶颈——先把 3 段视频跑通，SD 图可以并行；视频定稿前不要锁定 hero 的最终配色。

> 对本文的执行含义：视频没定稿前，SD 组不要用成片抽帧做参考；`prompts/comfy/00-character.pos.txt` 与 SD 角色卡以 `01-visual-bible.md` 为准，不在这里另立版本。

---

## 12. 执行清单（按顺序做，约 1.5~3 小时 GPU + 半天剪辑）

- [ ] 1. 抽尾帧、去水印、核对首末行黑边（§1.3）。
- [ ] 2. 扩展 A 首帧到 16:9，按 §5.4 验收（VACE-1.3B，约 10~20 min）。
- [ ] 3. 跑 Shot A（2 个 seed 选 1），检查主体位置/安全区/光向（12~20 min/条）。
- [ ] 4. 以 A 尾帧为首帧跑 Shot B（同上）。
- [ ] 5. 以 B 尾帧为首帧跑 Shot C（73 帧，快）。
- [ ] 6.（可选）V4 天空 loop、D 黄昏变体。
- [ ] 7. 超分（ESRGAN 4× → 1080p）、RIFE 补帧（A/B 2×；C 2× 做 0.5× 慢放）。
- [ ] 8. 去闪烁/降噪/轻锐化/统一 LUT/加颗粒（§7.2、§9.2）。
- [ ] 9. 剪辑拼接：A→B→C，0.5/0.5 叠化；循环尾叠首 0.75 s（§9.1、§4.3）。
- [ ] 10. 导出母版 + 网页 H.264/WebM/AV1 + poster + 移动版（§9.3、§9.4）。
- [ ] 11. 毛玻璃自检（§8.3）+ 循环自检（首尾亮度差 ≤3%、无重影、无黑帧）。
- [ ] 12. 归档 `.txt`：每条提示词/负向/seed/steps/cfg/sampler/shift/模型版本，命名与 §9.4 对齐。

---

## 13. 验收

### 13.1 Hero 视频最终验收（源方案 §12 末）

- [ ] 1920×1080、24 fps（或 30 fps 补帧版）、15~18 s、无缝循环、无音轨。
- [ ] 同角色：短发、淡蓝宽袖、牛仔短裤、白袜、运动鞋、芥末黄板；至少 2 镜能看清脸（C 回眸必过）。
- [ ] 中心 60%×50% 无文字/无高对比主体/无高速运动；叠 28 px 玻璃后正文对比度 ≥ 4.5:1。
- [ ] 画面清晰：1080p 全屏看云有层次、头发/护栏边缘干净；压缩后天空无色带。
- [ ] 循环处肉眼无跳变，播放器 `loop` 连播 5 次不闪。
- [ ] poster 与视频首帧色调一致（t≈6.5 s 抽帧）。

### 13.2 源方案 §7 验收项（Hero 总体验收中与本段相关的部分）

- [ ] 视频 16:9、1080p、15~18 s、循环无跳帧；首帧与尾帧亮度/色温差 ≤ 3%（肉眼不可察）。
- [ ] 少女形象与源片一致（发型、淡蓝衬衫、牛仔短裤、黄滑板）；至少 2 个镜头能看清脸。
- [ ] 中心安全区无文字、无高对比主体、无快速运动；铺玻璃卡片后正文对比度 ≥ 4.5:1。
- [ ] 视频压缩后天空无可见色带/块效应；`backdrop-filter` 下画面仍然「干净」。
- [ ] 移动端有 9:16 版本且不裁掉主体；`prefers-reduced-motion` 有 poster 兜底。
- [ ] 7 张图与视频同色温、同光照方向（跨资产项：视频侧负责统一 LUT 与光向；图片侧见 `02-sd-assets.md` 与 `01-visual-bible.md`）。

### 13.3 待确认项（源方案未给数字，不虚构）

1. 客户是否接受“成片全部生成、不用源片实拍段”（源方案附录 B.6 ①）——影响是否要把源片逐帧去水印并整段 VACE 扩展。
2. SD 正面角色卡定稿（源方案附录 B.6 ②）——脸一旦定，全站不再换；视频侧同角色锚点以此为准。
3. 网页 720p 档的码率/体积预算：源方案只给 1080p 档（5~8 Mbps、目标 5~6 Mbps），720p 为项目新增文件名 → `待确认`。
4. 母版存放位置：源方案写在 `assets/hero/`，本项目约定放 `design/source/wan/`；若项目另有约定以项目为准。
5. 云 GPU 资源（VACE-14B / FLF2V-14B / 14B I2V）是否可用；不可用时循环走 §4.3 交叉淡化、A 首帧扩展用 VACE-1.3B 960×544。
6. ComfyUI 版本差异：节点标题按本机安装为准（源方案已提示 `Wan22ImageToVideoLatent` 后缀、`WanFirstLastFrameToVideo` 输入口顺序差异），以节点类型 + 连线关系识别，不锁死版本号。
7. shot-b 的 145 帧是否触发尾段崩坏：以 §3.2 失败处理判定（退 121 帧 + RIFE 0.85×），成片时长会从 15.41 s 变为约 15.3 s，仍在 15~18 s。

---

## 14. 源映射

| 源方案章节 | 源行号 | 本文位置 | 说明 |
|---|---|---|---|
| §5 开头（角色/素材/目标/硬件/版本说明） | 803-809 | 文档头 + §0 | 版本差异提示原样保留于 §3.0、§6.3 |
| §5-0 一页速查（交付结构/时间线/三个取舍） | 813-843 | §0.1~0.3 | 表格与时间线原样，路径按项目映射 |
| §5-1 素材核对（源片事实/抽帧结论/清理命令） | 847-888 | §1.1~1.3 | ffmpeg 命令仅替换输入输出路径 |
| §5-2 共用锁定块（角色卡/世界卡/风格/负向/运动负向/中文要点） | 892-931 | §2 | 英文落盘为 `prompts/comfy/00-*.txt` |
| §5-3 镜头提示词 A/B/C | 935-1020 | §3.1~3.3 | 英文落盘为 `shot-a/b/c.pos/neg.txt` |
| §5-4 循环版（接缝/FLF2V/交叉淡化/V4/D） | 1024-1116 | §4 | `seam-flf2v.*`、`v4-loop.*`、`d-variant.*` |
| §5-5 竖屏→16:9（VACE 链路/对比/首帧验收） | 1120-1172 | §5 | `vace-extend.pos/neg.txt` |
| §5-6 工作流与参数（6 GB/模型路线/节点链/参数总表/踩坑/提词顺序） | 1176-1287 | §6 | 参数总表逐行照抄 |
| §5-7 清晰度链路（ESRGAN/RIFE/ffmpeg/质检/24→30） | 1291-1355 | §7 | ffmpeg 命令原样 |
| §5-8 毛玻璃安全区（构图表/运动写法/自检） | 1359-1388 | §8 | |
| §5-9 拼接剪辑与导出（时间线/去闪/规格/命名与首屏） | 1392-1459 | §9 | 命名按项目路径重排 |
| §5-10 竖屏源片→桌面 16:9 两种策略 | 1463-1490 | §10.1 | 判断表与推荐组合保留 |
| §5-11 水印处理与常见坑 | 1494-1520 | §1.4 + §10.2 | 水印三种处理放在素材阶段 |
| §5-12 执行清单与最终验收 | 1524-1546 | §12 + §13.1 | |
| §5-13 一键复制区（提示词索引） | 1550-1567 | `prompts/comfy/` + `_fragments/comfy-assets.json` | 每块都有独立 txt，索引与源 13 章一一对应 |
| §6 SD 与 ComfyUI 协同规则 | 1573-1581 | §11 | 5 条全保留 |
| §7 验收标准（Hero） | 1583-1592 | §13.2 | 与视频相关的 5 条保留 |
| §8 交付与命名 | 1594-1613 | §9.4 + §13.3 | 目录骨架映射到 `design/source/wan/` 与 `public/hero/` |
| 附录 A 素材核对与抽帧文件 | 1615-1628 | §1.1 | 源片事实/水印坐标/抽帧清单 |
| 附录 B 口径说明与本版修订 | 1630-1637 | §1.1、§1.4、§10、§13.3 | 无帽修订/不直接用源片/6 GB 现实/待拍板两件事 |
