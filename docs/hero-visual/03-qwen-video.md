# 03 · 万相 2.7 视频生产 runbook（4 条 i2v · 1080P · 首尾帧闭环）

> 本文是源方案 `AI简历网站_Hero视觉提示词总方案.md` §5（视频部分）在**万相 2.7 异步 API** 下的项目可执行版；替代旧 `03-comfyui-video.md`（旧 ComfyUI 版**已移除**，文件保留留档、不再执行）。
> 阶段：**S4 生成（4 次 i2v 调用）→ S5 剪辑导出**；前置：**S3 关键帧已定稿**（Qwen-Image 3.0 产出，见 `docs/hero-visual/02-qwen-images.md` 与 `_fragments/image-assets.json`）。
> 成片口径：**1920×1080 / 30 fps / 15.75 s / 无缝循环 / 无音轨**；全画面清晰（供毛玻璃 `backdrop-filter`），中心 60%×50% 安全区低对比。
> 工具前提：**无本地 GPU**；不装 ffmpeg（本机 PATH 无 `ffmpeg`/`ffprobe`），剪辑主路径是**剪映专业版 / Premiere**。
> 配套文件：中文提示词 `prompts/video/*.txt`；机器可读参数 `_fragments/video-assets.json`；批量脚本 `scripts/hero/qwen-video-batch.mjs`（已交付，读合并后的 `docs/hero-visual/assets.json`；异常时按 §5.2 手工 HTTP 流程兜底）。

---

## 0. 一页速查

### 0.1 交付结构（4 条 i2v = 4 个镜头，一条一个镜头）

| id | 镜头 | 时长 | 首帧（关键帧） | 成片落点 | 主模型 |
|---|---|---|---|---|---|
| `wan-shot-a` | Shot A 延续：低机位背后跟拍继续下坡 | **5 s** | `design/source/qwen/009-keyframe-a_s20261108.png` | 0 – 5.0 s | `wan2.7-i2v` |
| `wan-shot-b` | Shot B 展开：单次连续升高 + 后拉 + 左移，宽幅海天 | **6 s** | `design/source/qwen/010-keyframe-b_s20261109.png` | 4.5 – 10.5 s | `wan2.7-i2v` |
| `wan-shot-c` | Shot C 收尾：慢速侧身回眸 → 上摇到纯天空 | **5 s** | `design/source/qwen/011-keyframe-c_s20261110.png` | 10.0 – 15.0 s | `wan2.7-i2v` |
| `wan-loop` | 天空无缝 loop：首帧 = 尾帧同图 | **5 s** | `design/source/qwen/012-keyframe-sky_s20261111.png`（首尾同一张） | 14.5 – 16.5 s（收尾/兜底） | `wan2.7-i2v`（备用 `wan2.7-t2v`） |

统一参数：`resolution="1080P"`、`prompt_extend=false`、`watermark=false`、`seed=20261201..20261204`、`duration` 为整数秒。
关键帧路径与 seed **以 qwen-image 的 `image-assets.json` / 最终 `assets.json` 为准**；若上游改名，同步 `_fragments/video-assets.json` 的 `firstFrame` / `lastFrame` 即可，提示词不动。
> **路径状态**：上表 4 个 `design/source/qwen/*.png` 是 **S3 待生成产物**（目录与母版名已与 qwen-image 对齐，文件尚未落盘）；`design/source/wan/*.mp4` 为 **S4 待生成产物**。S4 开始前必须先确认关键帧文件真实存在（见 §1 前置检查）。

### 0.2 成片时间线（15.75 s）

```text
A 5.0 ──0.5 叠化── B 6.0 ──0.5 叠化── C 5.0 ──0.5 叠化── loop 前 2.0
 0.0              4.5            10.0           14.5               16.5
                                                                    │
                         ┌──────── 尾叠首 0.75 s（纯天空 ↔ 天空+少女）┘
                         ▼
        成片 16.5 − 0.75 = 15.75 s ／ 1920×1080 ／ 30 fps ／ 无音轨
```

- 总长公式：`成片 = 13.75 + L`（L = 接在 C 之后的 loop 天空段秒数）。L=2.0 → 15.75 s；L=4.2 → 17.95 s；**L ≤ 4.25 s**（否则超 18 s）。
- 三条硬约束（任一不满足就重跑对应镜头）：① 少女始终在右三分之一，绝不进中心；② 镜头内无快摇/快推；③ 首尾帧亮度差 ≤ 3%。
- 预算：4 次调用 ≈ 10–20 min（含排队），剪辑半天；**不占本地 GPU**。

### 0.3 四个关键取舍（先看结论）

1. **一条 i2v = 一个镜头**：A/B/C 各有独立首帧（Qwen-Image 关键帧），**不从上一镜成片抽尾帧续写**——成片已含压缩与运动模糊，误差会叠加两遍，且抽帧要 ffmpeg（本机没有）。
2. **1080P 直出，不超分不补帧**：清晰度风险从「超分放大噪点」变成「首帧是否干净」，所以 S3 关键帧验收是第一道闸。
3. **时长只用整数秒**：5/6/5/5 固定，总长靠叠化与 loop 收尾段调，**不做 0.5× 慢放**（剪辑里放慢会损失锐度并暴露顿帧，本机也没有补帧工具）。
4. **首尾帧闭环做两层**：API 层（loop 段 `first_frame`=`last_frame`）+ 剪辑层（成片 0.75 s 尾叠首）；两者都不省。

### 0.4 路径映射

| 用途 | 路径（相对仓库根） | 说明 |
|---|---|---|
| 参考版式（无人） | `design/UI_ref.jpg` | 只学玻璃/铬/粉球版式，不参与视频生成 |
| 参考源片（竖屏，含 AI 水印） | `design/滑板少女.mp4` | **只读**；不进成片；只作角色/光感/故事参考 |
| 关键帧母版 | `design/source/qwen/009..012-keyframe-*_s20261108..11.png`（**待生成**，S3 产物） | 1280×720 精确 16:9 |
| 视频母版 MP4 | `design/source/wan/shot-a_1080p_5s_s20261201.mp4` 等 | S4 产物，同名 `.txt` 归档参数 |
| 成片与网页版 | `public/hero/hero.mp4`、`hero-720p.mp4`、`hero-1080.webm`、`hero-9x16.mp4`、`poster.jpg` | S5 产物；由 Lead 合并时登记 `webOutputs` |
| 提示词 | `docs/hero-visual/prompts/video/*.txt` | 中文自然语言，逐字复制进 `input.prompt` |
| 机器参数 | `docs/hero-visual/_fragments/video-assets.json` | id / model / resolution / duration / seed / firstFrame / master |

- 关键帧引用 `qwen-kf-a/b/c/sky`，依赖关系写在 `_fragments/video-assets.json` 的 `dependsOn` 里；关键帧未就绪**不要开 S4**。
- `webOutputs` 在 fragment 里统一给 `[]`（不编造），成片登记由 Lead 合并时统一做。

---

## 1. 前置检查（S4 开始前，2 分钟）

- [ ] 4 张关键帧已存在：`design/source/qwen/009-keyframe-a_s20261108.png`、`010-keyframe-b_s20261109.png`、`011-keyframe-c_s20261110.png`、`012-keyframe-sky_s20261111.png`（路径以上游 `image-assets.json` 为准）。
- [ ] 每张均为 **1280×720（精确 16:9）**、无透明通道、≤20 MB、PNG/JPG；**宽高比错 = 成片比例错，提示词救不回来**。
- [ ] 关键帧里**无任何文字/水印/logo/UI**（放大 200% 查四角）；有就直接回 S3 重生，别指望视频模型擦掉。
- [ ] A/B/C 三张的**光向一致**（太阳在身后偏右、影子朝左下）；少女中心 x 在 62%–78%。
- [ ] `DASHSCOPE_API_KEY` 已配置（用户级 `~/.claude/settings.json` 或项目 `.claude/settings.local.json`，由 `scripts/hero/setup-claude.ps1` 写入）；**文档与脚本里不出现 key 明文**。
- [ ] 地域与 Base URL 一致（默认 `https://dashscope.aliyuncs.com`；业务空间可用 `DASHSCOPE_BASE_URL` 覆盖）；模型 `wan2.7-i2v` 已开通。
- [ ] 输出目录存在（`design/source/wan/`，脚本会自建）；磁盘留 ≥1 GB（4 个 1080P 短片 + 成片）。

> 跑之前先确认 `docs/hero-visual/prompts/video/` 下 9 个文件都在：`shot-a.pos/neg`、`shot-b.pos/neg`、`shot-c.pos/neg`、`loop-sky.pos/neg`、`loop-sky-t2v.pos`。

---

## 2. 共用锁定块（中文，写进每条提示词）

提示词全部是中文自然语言，单条结构固定：**首帧内容 → 镜头运动（幅度给数） → 人物动作 → 云与光变化 → 风格 → 时长/无剪切/首尾要求**。负向统一压：文字水印、镜头抖动、快摇快推、人物变形换装、出现第二个人。

| 锁定项 | 写法（每条都要复述，不靠模型记忆） |
|---|---|
| 角色三锚点 | 棕色蓬松短发（**无帽**）、浅蓝色宽松宽袖衬衫（袖口卷起）、牛仔短裤、白袜、米白低帮运动鞋、芥末黄滑板 |
| 世界 | 下坡海岸公路、左侧护栏 + 电线杆 + 下垂电线、下方海港小镇与海、深钴蓝天空、巨大积云、逆光太阳偏她身后右上、长影子朝左下 |
| 风格 | 二维动画插画、手绘背景、清晰线稿、丰富空气透视、移轴微缩景深、极轻胶片颗粒；深钴蓝天空 / 奶油白云 / 暖金阳光 / 偏冷蓝阴影 / 光晕里一点点克制的珊瑚粉 |
| 运动纪律 | 「极缓慢、平滑、连续」「一个动作」「横移不超过画面宽 x%」——**不写 fast/dynamic/whip** |
| 禁止 | 画面文字、界面元素、镜头抖动、快摇、变装、第二个人；提示词里不写 hex 值 |

> 负向提示词上限 **500 字符**，正向 **≤5000 字符**（本套文件正向约 700–900 字、负向约 300 字，均在限内）。文件在 `prompts/video/`，逐字复制，不要手打改字。

---

## 3. 四镜 runbook（S4）

### 3.0 每镜通用调用参数（`_fragments/video-assets.json` 同源）

```json
{
  "model": "wan2.7-i2v",
  "input": {
    "prompt": "<prompts/video/shot-a.pos.txt 全文>",
    "negative_prompt": "<prompts/video/shot-a.neg.txt 全文>",
    "media": [{ "type": "first_frame", "url": "<首帧 PNG 的 Base64 data URL 或公网 URL>" }]
  },
  "parameters": {
    "resolution": "1080P",
    "duration": 5,
    "prompt_extend": false,
    "watermark": false,
    "seed": 20261201
  }
}
```

- 首帧传 **Base64 data URL**（`data:image/png;base64,...`）或公网/OSS URL 都可以；本地 PNG 由脚本转 Base64，**不要手贴超长字符串**。
- `duration` 只能是 2–15 整数秒：A=5、B=6、C=5、loop=5；`prompt_extend` 必须 `false`（否则运镜会被自动扩写改写）。
- `seed` 固定 20261201/20261202/20261203/20261204；同 seed 重跑**不保证像素级一致**（万相有概率性），验收以画面为准。

### 3.1 Shot A · 延续（5 s）

- 文件：`prompts/video/shot-a.pos.txt` / `shot-a.neg.txt`
- 首帧：`qwen-kf-a`（`009-keyframe-a_s20261108.png`）；她在右三分之一，天空占左/中上部约一半。
- 运动：极慢前推 + 轻微左移（横移 ≤ 画面宽 8%、推进 ≤ 5%）；云在左侧极慢漂；光晕轻呼吸、亮度基本不变。
- 命令：

  ```bash
  node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run   # 默认 dry-run：打印请求字段，不花钱
  node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run       # 真调用：创建任务 → 轮询 → 下载
  ```

- 落盘：`design/source/wan/shot-a_1080p_5s_s20261201.mp4` + 同名 `.txt`（prompt/negative/首帧/参数/seed/task_id/生成时间）。
- 验收：她全程在右三分之一、无抖动无快摇、末秒构图≈首秒；不过就同 seed 重跑 1 次，仍不过**回 S3 换关键帧**。

### 3.2 Shot B · 展开（6 s）

- 文件：`prompts/video/shot-b.pos.txt` / `shot-b.neg.txt`
- 首帧：`qwen-kf-b`（`010-keyframe-b_s20261109.png`）；她已在右下三分之一、尺寸小，左侧与中央约六成是干净天空，地平线在下方约 2/3。
- 运动：**单次连续 crane**（升 + 后拉 + 左移），一条平滑速度曲线；6 s 内升高 ≤ 画面高 10%、后拉 ≤ 画面宽 20%、横移 ≤ 宽 10%；中途绝不反向。
- 命令/参数：同 A，`duration=6`、`seed=20261202`、首帧换 kf-b。
- 验收：主体明显变小（拉远成功）、左侧 55% 无高对比物体、地平线不倾斜、远处建筑不溶解。**B 拉远不足**（她没变小）→ 回 S3 把 kf-b 里她画得更小，不要靠改提示词硬拉。

### 3.3 Shot C · 收尾 / 回环（5 s）

- 文件：`prompts/video/shot-c.pos.txt` / `shot-c.neg.txt`
- 首帧：`qwen-kf-c`（`011-keyframe-c_s20261110.png`）；中远景，她在画面右侧约 1/3 身高，逆光轮廓清晰。
- 运动：前 2.5 s 极慢推近 + 轻微下压到她侧后方，再缓慢上摇让天空填满；她只做**极轻的侧身回眸**（只转上半身，不转身不正脸）。
- 命令/参数：同 A，`duration=5`、`seed=20261203`、首帧换 kf-c。
- 验收（尾帧直接决定循环是否成立）：
  - [ ] 天空 ≥ 80%，她只剩右下小剪影，剪影中心 x ≈ 68%（与 A 首对齐）；
  - [ ] 尾帧平均亮度与 A 首差 ≤ 3%；
  - [ ] 最后 1 s 无新物体（电线杆、鸟、粉球）进场，无亮度跳变；
  - [ ] 回眸是侧脸，**没有把脸转成正脸**（转正脸必崩，重跑）。

### 3.4 Loop 天空（5 s，首尾帧闭环）

- 文件：`prompts/video/loop-sky.pos.txt` / `loop-sky.neg.txt`
- 首帧 = 尾帧：`qwen-kf-sky`（`012-keyframe-sky_s20261111.png`），`media` 里同时传：

  ```json
  "media": [
    { "type": "first_frame", "url": "data:image/png;base64,<sky 关键帧>" },
    { "type": "last_frame",  "url": "data:image/png;base64,<同一张 sky 关键帧>" }
  ]
  ```

- 参数：`duration=5`、`seed=20261204`、`resolution=1080P`、`prompt_extend=false`、`watermark=false`。
- 验收：机位完全锁定、云极慢右移（5 s ≤ 画面宽 3%）、无主体入画；首尾 1 s 平均亮度差 ≤ 3%。
- **备用路线（t2v）**：若首尾同图仍有漂移，改 `wan2.7-t2v` + `parameters.ratio="16:9"`，提示词换 `loop-sky-t2v.pos.txt`，其余参数不变；验收多查「云形稳定、无新物体」。
- 用途：成片收尾 2.0 s、`prefers-reduced-motion` 静态兜底、视频加载前占位（见 §7.3）。

---

## 4. 首尾帧闭环（两层，缺一不可）

### 4.1 API 层（loop 段）

`first_frame` 与 `last_frame` 传**同一张**天空关键帧，让模型被两端夹住。验收：首尾各 1 s 平均亮度差 ≤ 3%、构图基本一致；不达标 → 换 seed 重跑 1 次（20261204 → 20261205），仍不达标 → 改 t2v 备用路线。

### 4.2 剪辑层（成片）

- C 尾（天空 ≥ 80%）与开头 A 首做 **0.75 s 尾叠首**交叉淡化，ease-in-out，不要线性。
- 前提：C 尾剪影中心 x ≈ 68% 与 A 首对齐、两者天空亮度差 ≤ 3%；对齐了才会看到「同一个她由小变大」，否则是两个少女打架。
- 叠化期间可加 10–15% 暖色漏光（opacity 12%）压重影；**不要白闪/黑场**。
- 检查：成片首尾各抽 1 s 对比亮度差 ≤ 3%、SSIM ≥ 0.80；`loop` 连播 5 次不闪、无黑帧。

### 4.3 可选：i2v 桥接（只有叠化仍露馅时才做）

- 取 C 成片**末帧**：用剪映/PR「导出帧」功能（本机无 ffmpeg，不要写抽帧命令当主路径）。
- 调 `wan2.7-i2v`：`first_frame` = C 末帧、`last_frame` = `009-keyframe-a_s20261108.png`、`duration=2`（整数秒下限，剪辑裁到 0.8–1.0 s）、`prompt_extend=false`。
- 提示词只写「同一个镜头继续呼吸：云继续漂、光晕继续呼吸、她只是轻轻放大」，**不要重新构图**；两端各留 4 帧叠化。这段是补丁，不进资产清单。

---

## 5. S4 执行 runbook（创建任务 → 轮询 → 下载）

### 5.1 脚本路径（首选）

```bash
# 0) 看请求长什么样，不花钱
node scripts/hero/qwen-video-batch.mjs --dry-run

# 1) 先只跑 Shot A（最便宜、最能验证关键帧）
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run

# 2) A 通过后跑 B/C，loop 最后跑
node scripts/hero/qwen-video-batch.mjs --only wan-shot-b,wan-shot-c --run
node scripts/hero/qwen-video-batch.mjs --only wan-loop --run

# 3) 想强制重跑某条（覆盖已有母版）
node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --run --force
```

脚本行为（与 `_fragments/video-assets.json` 同源）：读 `docs/hero-visual/assets.json` → 首/尾帧转 Base64 → 建任务 → **15 s 轮询、最长 20 min（--timeout 可改，60–3600 s）** → `SUCCEEDED` 立即下载 MP4 到 `master` → 写同名 `.txt`。退出码：**1 结构错**（清单/JSON 非法、prompt/firstFrame/master 缺失）、**2 环境错**（无 key / Base URL 不通 / 找不到项目根）、**3 API 错**（建任务或轮询失败）。

### 5.2 手工兜底（脚本未就绪时，按 API 直连）

```bash
BASE="${DASHSCOPE_BASE_URL:-https://dashscope.aliyuncs.com}"

# 1) 建任务（-d @body.json；body 结构见 §3.0，必须带异步头）
curl -sS -X POST "$BASE/api/v1/services/aigc/video-generation/video-synthesis" \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-DashScope-Async: enable" \
  -d @body-shot-a.json
# → 取 output.task_id

# 2) 轮询（每 15 s 一次，最多 20 min）
curl -sS "$BASE/api/v1/tasks/<task_id>" -H "Authorization: Bearer $DASHSCOPE_API_KEY"
# → SUCCEEDED 时 output.video_url（24 h 有效），FAILED 看 code / message

# 3) 立刻下载（24 h 后链接失效，必须落盘）
curl -sS -L "<output.video_url>" -o design/source/wan/shot-a_1080p_5s_s20261201.mp4
```

- PowerShell 环境用 `Invoke-RestMethod`（`-Headers @{Authorization="Bearer $env:DASHSCOPE_API_KEY"; "X-DashScope-Async"="enable"}`）；body 建议写文件再 `-InFile`，避免中文 prompt 的引号转义问题。
- **成功响应里的 `video_url` 只是临时链接**：不要写进文档、不要当资产路径、不要进 git。

### 5.3 S4 收尾清单

- [ ] 4 个 MP4 落在 `design/source/wan/`，命名 `shot-a_1080p_5s_s20261201.mp4` / `shot-b_1080p_6s_s20261202.mp4` / `shot-c_1080p_5s_s20261203.mp4` / `loop-sky_1080p_5s_s20261204.mp4`。
- [ ] 4 个同名 `.txt` 齐全：完整 prompt/negative、首帧路径、model/resolution/duration/seed/prompt_extend/watermark、task_id、生成时间。
- [ ] 单镜验收（§6.1）全过；未过重复跑记录写进 `.txt`（seed 与失败原因留痕，方便回溯）。

---

## 6. S5 剪辑与导出 runbook

### 6.0 为什么是剪映/PR

本机**没有 ffmpeg**（`ffmpeg -version` 报「不是内部或外部命令」）。视频拼接、叠化、尾叠首、调色、压缩全部在剪映专业版 / Premiere 里做；ffmpeg 命令只作**可选备选**（见 §6.3，需自行安装）。

### 6.1 剪映专业版步骤（PR 同理，括号内为 PR 操作）

1. 新建项目：**1920×1080 / 30 fps**；导入 4 个母版 MP4。
2. 排时间线（按 §0.2）：A 起 0；B 起 4.5 s；C 起 10.0 s；loop 起 14.5 s，裁到只剩前 2.0 s（末尾再拉长到 ≤4.25 s 可把成片做到 ≤17.95 s）。
3. 转场：A→B 0.5 s、B→C 0.5 s、C→loop 0.5 s，全用**交叉淡化（叠化）**、ease-in-out（PR：`Cross Dissolve`，持续时间 12 帧）；**不要白闪/黑场/推拉**。
4. 尾叠首：复制开头 0.75 s 到末尾做第二条轨叠化（PR：末 0.75 s 与首 0.75 s 叠两条轨做不透明度关键帧），叠化曲线 ease-in-out。
5. 统一调色（只做匹配）：以 B 段为基准，对齐三段白位/黑位（白 235–245、黑 18–30，别到 0/255）；段间平均亮度差 ≤ 3%、色温差 ≤ 200 K；中心安全区不要拉对比。
6. 导出：**H.264 / 1920×1080 / 30 fps / 5–8 Mbps（目标 5–6 Mbps）/ 无音轨 / 网页优化（faststart）**；15.75 s ≈ 9–11 MB。
7. 另存留档：高码率母版放 `design/source/wan/hero_linear_master.mp4`；网页版交 `public/hero/hero.mp4`（由 Lead 登记 `webOutputs`）；720p 档从同一时间线导出到 `public/hero/hero-720p.mp4`。
8. poster：取成片 **B 段中段（t ≈ 6.5 s）** 导出静帧 → `public/hero/poster.jpg`（1920×1080、JPEG q82、≤180 KB）；移动版 1080×1920 另出。

### 6.2 成片参数校验（不装 ffmpeg 也能查）

- 剪映/PR 信息面板看：分辨率 1920×1080、帧率 30、时长 15.75 s、无音频轨。
- Windows 资源管理器「属性 → 详细信息」可看分辨率/帧率/时长；体积 9–11 MB 属正常（5–6 Mbps）。
- 逐帧抽检：剪映暂停后「导出帧」，检查中心安全区与循环接缝。

### 6.3 可选备选：ffmpeg（本机未安装，装好后才能执行）

```bash
# 1) 三段 0.5s 叠化拼成线性片（A→B offset 4.5；B→C offset 10.0）
ffmpeg -i shot-a.mp4 -i shot-b.mp4 -i shot-c.mp4 -filter_complex "
[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[v01];
[v01][2:v]xfade=transition=fade:duration=0.5:offset=10.0[v012]" \
  -map "[v012]" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero_linear.mp4

# 2) 尾叠首 0.75s（成片 = 线性片 − 0.75s）
ffmpeg -i hero_linear.mp4 -filter_complex "
[0:v]split=3[h][m][t];
[h]trim=start=0:end=0.75,setpts=PTS-STARTPTS[head];
[m]trim=start=0.75:end=15.75,setpts=PTS-STARTPTS[mid];
[t]trim=start=15.75:end=16.5,setpts=PTS-STARTPTS[tail];
[tail][head]xfade=transition=fade:duration=0.75:offset=0[blend];
[blend][mid]concat=n=2:v=1:a=0[out]" -map "[out]" \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero_loop_v1.mp4
```

- 上面的 offset 与 trim 秒数是按 §0.2 时间线写死的，改了收尾段长度就要重算（`成片 = 13.75 + L`）。
- WebM/AV1 转码属可选收尾；没有 ffmpeg 就不做，不阻塞交付。

---

## 7. 验收

### 7.1 单条母版（下载后立刻查，过不了不进剪辑）

- [ ] 1920×1080、16:9、H.264 可播、时长 5/6/5/5 秒、无音轨。
- [ ] 无文字/水印/logo/字幕/UI；无第二个人；无换装换发型。
- [ ] 首帧与关键帧一致（机位、人物位置、光向没被重画）。
- [ ] 镜头内无抖动、无快摇、无快推；主体不进中心安全区。
- [ ] 三段光向一致（太阳身后偏右、长影子朝左下）。
- [ ] loop 段：首尾亮度差 ≤ 3%、构图一致。

### 7.2 成片（S5 交付前）

- [ ] 1920×1080 / 30 fps / **15.75 s**（15–18 s 内）/ 无音轨 / `loop` 连播 5 次无黑帧无跳变。
- [ ] 段间平均亮度差 ≤ 3%、色温差 ≤ 200 K（以 B 为基准）。
- [ ] 中心安全区（x 20%–80%、y 25%–75%）只有天空/云/雾化远景：抽 3 帧测中心裁切亮度标准差 ≤ 15/255、局部最大梯度 ≤ 25/255、逐帧位移 ≤ 2 px（1080p）、镜头角速度 ≤ 8°/s。
- [ ] 叠 28 px 玻璃（`blur(28px) saturate(1.35)`）后正文对比度 ≥ 4.5:1；能辨认「云在动、少女在滑」；无脏斑/色带/块效应。
- [ ] 同角色、同色板：短发无帽、淡蓝宽袖、牛仔短裤、白袜、米白运动鞋、芥末黄板；**C 段回眸能看清侧脸**（A/B 为背影跟拍，源片本身无正脸，不强制露脸）。
- [ ] poster 与成片首帧同色温；`prefers-reduced-motion` 下只显示 poster、不加载视频。

### 7.3 前端落地要点（S6 交接）

- `<video autoplay muted loop playsinline preload="metadata" poster="poster.jpg" aria-hidden="true" tabindex="-1">`；不要把 10 MB 视频写进 `<head>` preload。
- 首屏先 poster，进入视口后再注入 `<source>` / `video.load()`；`loop` 依赖 §4.2 的尾叠首，H.264 必须 faststart。
- `prefers-reduced-motion: reduce`：隐藏视频，用 `loop-sky` 段或 poster 静态兜底。
- WebM/AV1 档可选；没有转码工具就不做。

---

## 8. 失败处理与成本控制

### 8.1 常见失败与处理

| 现象 / 报错 | 原因 | 处理 |
|---|---|---|
| 建任务 4xx（参数/模型错误） | 模型名拼错、`duration` 非整数、超长 prompt（>5000 字符）、首帧比例非 16:9、首帧超 20 MB | 按报错 `code/message` 逐项修；先 `--dry-run` 打字段核对 |
| 建任务 401/403 | key 缺失/过期、地域不匹配、模型未开通 | 查 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 与地域；不要在文档里贴 key |
| 轮询 20 min 仍 `RUNNING` | 队列拥堵 | 不删任务，记 task_id，10 min 后再查一次；仍不动就重建任务（同参数） |
| `FAILED` | 内容审核/服务异常 | 记 `code/message`；先同参数重试 1 次，再换 seed（+1）重试；连续 2 次失败回 S3 查关键帧内容（是否触发审核、是否有文字） |
| 首帧与关键帧不一致（主体被重画） | 关键帧构图太依赖模型猜测 | 回 S3 重画关键帧（主体更大、更明确、别把主体画在边上） |
| 人物漂移/换装 | 关键帧清晰度不足或负向不够 | 负向已压；仍漂就重生关键帧，单镜最多重跑 2 次 |
| 下载失败 | URL 超过 24 h 或网络中断 | 重新轮询任务拿新 URL（任务记录仍在 24 h 内可查）；**URL 不过夜** |
| 输出不是 16:9 | 首帧不是精确 16:9 | 首帧必须 1280×720；比例只由首帧决定 |

### 8.2 成本控制

- 计费 = 秒 × 分辨率档（**以百炼控制台价格为准**，本文不写数字）；4 条 = 20 s 素材。
- 顺序：**先 A（5 s）验证构图与角色 → 再 B/C（6 s/5 s）→ loop 最后**；A 不过就不要跑 B/C。
- 重跑预算：每镜最多 2 次（即最多 3 次调用）；超了先回 S3 改关键帧（图比视频便宜，且改图能一次解决多镜问题）。
- 先 `--dry-run` 核对字段再 `--run`；不要用 `--force` 批量重跑。
- 结果 URL 24 h 失效：**成功即下载**，不把 URL 当资产。
- 不做 720P 试跑省钱（1080P 与 720P 是不同档位，构图验证在关键帧阶段完成即可）。

### 8.3 Rollback

- 某条视频反复失败：把该镜头的 `firstFrame` 换回上一版关键帧，或降级为「只用 loop 天空 + 静帧 poster」的兜底方案（成片退化为静态 KV，功能不缺失）。
- 成片不达标但不阻塞：先交付 15.0 s 版（不接 loop 收尾段，C 尾直接叠回 A 首为 14.25 s 需客户确认），或先交付 720p 验版，再补 1080p。

---

## 9. 与旧文档/源方案的关系

- 本文替代旧 `03-comfyui-video.md`（旧 ComfyUI 版**已移除**，文件仅留档，不再执行、不再维护）。
- 本文对应源方案 §5 的新版内容在 `_team/part_video.md`（由 Lead 拼进总方案，替换源 §5 第 803–1572 行）。
- 视觉事实（角色三锚点、光向、安全区数值、首尾亮度差 ≤3%、1080p/30fps/无音轨）沿用源方案；旧工具链（ComfyUI 节点、Wan2.2 5B、6 GB 显存、VACE/FLF2V/RIFE/Real-ESRGAN、采样参数、帧数体系）**已全部移除**（此处仅作对照，不再执行），逐项清单见 `part_video.md` 末尾「源映射」。
- 素材口径统一：`design/UI_ref.jpg`、`design/滑板少女.mp4`、`design/source/qwen/**`、`design/source/wan/**`；不再有旧素材目录引用。

## 10. 待确认（不虚构，交 Lead/客户拍板）

1. **成片总长**：15.75 s（推荐）还是拉到 17.95 s（loop 收尾段加到 4.2 s）？两者都在 15–18 s 内。
2. **loop 段是否进主片**：进（收尾 2 s + 循环更稳）还是只当兜底素材？
3. **WebM/AV1 档**：做不做？做需要先装 ffmpeg 或换转码工具。
4. **移动端 9:16**：仍按「源片裁切 + 设计层」走（不占 S4 成本），还是也要一条竖版 i2v（+1 次调用）？
5. **关键帧改名风险**：关键帧路径以 qwen-image 的 `image-assets.json` 为准；若最终 `assets.json` 改名，本文件 §0.1 与 `video-assets.json` 同步即可（提示词不受影响）。
