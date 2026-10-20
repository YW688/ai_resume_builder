# 05 · 验收清单（可执行 · 四组 + 顶层 10 秒 · 千问原生 API 版）

> 版本 v2.0 · 2026-10-20 · 依据：`01-visual-bible.md`（唯一事实源）+ `02-qwen-images.md` + `03-qwen-video.md` + 源方案 §7（验收）。
> 用法：**每完成一个 Stage 就跑对应组**，不要等全部做完才验；S7 总验收必须四组全过。
> 每个检查项固定四要素：**检查对象 / 方法（命令·脚本·肉眼）/ 通过标准 / 证据留档**。
> 证据目录约定：`design/qa/hero-<YYYYMMDD>/`（产物，待生成），文件名如 `S6-build.log`、`S6-1440.png`、`B1-mediainfo.txt`、`C4-contrast.txt`。

**状态标记**：标「产物（待生成）」的文件当前不存在，是目标位置；其余路径当前存在。
**工具链**：图像 `qwen-image-3.0-pro`（T2I/I2I，参考图 ≤3），视频 `wan2.7-i2v` / `wan2.7-t2v`（异步，1080P，2–15 整数秒）；**本机无 ffmpeg**，视频信息/剪辑主路径是**剪映/PR + 播放器媒体信息**，ffprobe 仅备选。

---

## 0. 顶层 10 秒验收（每次改动后的第一道门）

打开 `http://127.0.0.1:3000`，不滚动、不打开 DevTools，**10 秒内**回答下列 7 问；全部「是」才算通过，否则停下修，不进下一组。

| # | 问题 | 10 秒判定方式 |
|---|---|---|
| 1 | 首屏有画面（poster 或视频），不是黑屏/白屏？ | 页面加载完成瞬间看 |
| 2 | 主体在右、玻璃卡片在左（桌面）？ | 一眼看构图 |
| 3 | 玻璃卡片上的标题/副标/CTA 都看得清？ | 不眯眼读一遍 |
| 4 | 没有横向滚动条、没有元素错位？ | 看窗口底部/右侧 |
| 5 | 视频在动、且没有可见的「抖/闪」？ | 盯 3 秒玻璃后画面 |
| 6 | 移动端（切 375 px 刷新）卡片完整、主体没被裁掉？ | 只看首屏 |
| 7 | 控制台没有红色报错（素材未齐期只允许 C12 白名单 404）？ | 打开 Console 扫一眼 |

证据：`S0-10s-1440.png` + `S0-10s-375.png` + 一行结论（PASS/FAIL + 时间）。**这一项由执行人做，审看人复核签字。**

---

## 1. 验收记录模板（每轮复制一份）

```markdown
### 验收记录 · <阶段 S2/S3/S4/S5/S6/S7> · 第 <N> 轮

| 项 | 内容 |
|---|---|
| 代码版本 | `git rev-parse --short HEAD`；工作区未提交变更：<列表或 none> |
| 素材版本 | 图：qwen-image-3.0-pro / 视频：wan2.7-i2v；文件名 + 生成日期 + seed |
| 环境 | Windows / Node v24.22.0 / 浏览器 <名称+版本> / 剪映专业版 <版本>（或 PR）/ ffmpeg <有/无，仅备选> |
| 执行人 | |
| 审看人 | |
| 日期 | YYYY-MM-DD |
| 证据目录 | design/qa/hero-YYYYMMDD/ |
| 结论 | PASS / PASS with WARN（列明 WARN 项）/ FAIL |

| ID | 检查对象 | 结论(PASS/FAIL/WARN) | 证据路径 | 备注 |
|---|---|---|---|---|
| A1 | 角色卡客户确认 | | | |

（上表为示例起始行；其余检查项按实际执行的 ID 续写，不要留空行。）
```

---

## A 组 · Qwen 12 图（S2–S3）

> 执行手册见 `02-qwen-images.md`；机器清单见 `assets.json` v2 / `_fragments/image-assets.json`。AI 生成有概率性，**同 seed 也不保证像素级一致**，验收看「同一套 KV」而非逐像素。

| ID | 检查对象 | 方法（命令/脚本/肉眼） | 通过标准 | 证据留档 |
|---|---|---|---|---|
| A1 | 角色卡 `qwen-00-character` S2 gate | ① 确认 4 个 seed（**20261020 / 20261021 / 20261022 / 20261023**）各出过 1 张 1024×1024；② 确认客户书面确认；③ 文件存在 | `design/source/refs/character_front.png`（产物，待生成）存在、1024 长边；**没有客户确认不算过** | `A1-character-front.png` + `A1-客户确认.txt`（邮件/聊天截图路径） |
| A2 | 12 个资产齐全 | 逐项 `Test-Path`：角色卡定稿 1 + 角色卡 4 个 seed 母版（`001-character_s20261020.png` … `001-character_s20261023.png`）+ 其余 11 个母版（`002-hero-poster_s20261101.png` … `012-keyframe-sky_s20261111.png`，完整列表见 A7 命令块）+ 7 张网页图导出 | 12 个图资产全部有母版（角色卡保留 4 个 seed 母版）；7 张网页图已导出到 `public/` | `A2-list.txt` |
| A3 | 角色一致性（六件套 + 无帽） | 12 张图拼联系表，逐张对照 `01-visual-bible.md` §2；每张人像头部放大 200%，与 `design/滑板少女.mp4` 对应帧比；确认无帽檐/帽带/头饰/耳机 | 六件套齐全；发丝方向可变，**颜色/长度/服装主色不变**；全片无帽；角色卡与各图是同一张脸 | `A3-contact-sheet.jpg` + 逐张 `PASS/FAIL` 勾选表 |
| A4 | 色板与光照一致 | 用取色器抽各图主色，对照 `01-visual-bible.md` §3；联系表横向比云型/太阳位置/光照方向 | 6 色相之内，无橙色皮肤/紫色天空/荧光绿；同光照方向、同色温（12 张像同一套 KV） | `A4-palette.txt`（抽样 hex）+ 联系表 |
| A5 | 画面内无文字/水印/logo/UI/二维码 | 每张图 200% 放大看四角与中心；重点看玻璃面板、路面、远景城镇（Qwen 很会「补」文字）；API 请求 `watermark:false`；视频抽帧同查 | 四个「无」全部满足；玻璃面板一律空白（文案后期叠） | 逐张截图或联系表标注 |
| A6 | 参数可复现 | 每个母版旁存在同名 `.txt`：完整 prompt/negative/refs/model/size/seed/参数/生成时间；I2I 记录 `prompt_extend:false`、`watermark:false` | 12 张 + 4 关键帧全部有；字段缺失即 FAIL；允许说明「同 seed 不保证像素级一致」 | `A6-txt` 列表 + 抽查 2 份内容 |
| A7 | 尺寸与体积 | 用 System.Drawing 逐张打印宽高与 KB（命令见本节末「A7 命令块」） | `qwen-00` 1024×1024；`qwen-01`~`qwen-04` 1920×1080；`qwen-05` 1152×1536；`qwen-06` 1024×1024；`qwen-07` 1080×1920；关键帧 1280×720；**`public/hero/poster.jpg` ≤180 KB**（若取 B 帧）；`public/og-hero.jpg` 1200×630；网页图按 `02-qwen-images.md` §4 导出规格 | `A7-sizes.txt` |
| A8 | poster 来源裁决 | 检查 `public/hero/poster.jpg` 实际取自哪一帧：优先成片 B 段 t≈6.5 s 抽帧；`qwen-01` 只作兜底，并落到 `public/og-hero.jpg`（1200×630，产物待生成） | 有 B 帧静帧 → PASS；只有 `qwen-01` 代填 → WARN 并记录「poster 与首帧可能有跳变」 | `A8-poster-source.txt` + poster 文件 |
| A9 | I2I 参考图 ≤3 张 | 读 `_fragments/image-assets.json` / `assets.json`：I2I 图（`qwen-01`~`qwen-05`、`qwen-07`、`qwen-kf-a/b/c`）的 `refs` 长度 1–3（`qwen-06`、`qwen-kf-sky` 为 T2I，refs 为空属正常）；refs 文件存在（`design/source/refs/character_front.png`、`design/source/frames/ref_*.jpg`）；打开 `.pos.txt` 确认开头写了「以第 1 张参考图的人物面部/服装为准，以第 2 张参考图的构图/机位为准」；参数 `promptExtend:false` | 所有 I2I 资产 refs ≤3、refs 可解析、提示词有参考图指令；超限或 refs 缺失即 FAIL | `A9-i2i-refs.txt` + 抽查 2 份 prompt |
| A10 | 视觉 10 秒验收 8 项（源 §7 的视觉事实） | 对 12 张逐张过：色板 / 人物六件套无帽 / 积云塔+低角度逆光 / 留白区亮度 65–85% 且无高频细节 / 无文字水印 / 手脸滑板轮无结构错误（200%）/ 系列内脸云太阳一致 / 无走光无幼态化 | 12 张 × 8 项全部打勾 | `A10-10s-checklist.md`（逐张逐项） |
| A11 | 命名与母版留档 | 母版在 `design/source/qwen/`，视频在 `design/source/wan/`；网页产物在 `public/`；命名与 `02-qwen-images.md`/`assets.json` 一致 | 无临时名、无重复、无覆盖旧文件；母版旁 `.txt` 齐全 | `A11-tree.txt`（`Get-ChildItem -Recurse design\source\qwen, design\source\wan, public\art`） |

**A7 命令块（在仓库根执行，Windows PowerShell）：**

```powershell
Add-Type -AssemblyName System.Drawing
$files = @(
  'design\source\refs\character_front.png',
  'design\source\qwen\001-character_s20261020.png',
  'design\source\qwen\001-character_s20261021.png',
  'design\source\qwen\001-character_s20261022.png',
  'design\source\qwen\001-character_s20261023.png',
  'design\source\qwen\002-hero-poster_s20261101.png',
  'design\source\qwen\003-feature-parse_s20261102.png',
  'design\source\qwen\004-feature-templates_s20261103.png',
  'design\source\qwen\005-feature-future_s20261104.png',
  'design\source\qwen\006-about-portrait_s20261105.png',
  'design\source\qwen\007-ui-stickers_s20261106.png',
  'design\source\qwen\008-mobile-cover_s20261107.png',
  'design\source\qwen\009-keyframe-a_s20261108.png',
  'design\source\qwen\010-keyframe-b_s20261109.png',
  'design\source\qwen\011-keyframe-c_s20261110.png',
  'design\source\qwen\012-keyframe-sky_s20261111.png',
  'public\hero\poster.jpg',
  'public\og-hero.jpg',
  'public\art\feature-parse.jpg',
  'public\art\feature-templates.jpg',
  'public\art\feature-future.jpg',
  'public\art\about-portrait.jpg',
  'public\art\ui-kit.png',
  'public\hero\mobile-cover.jpg'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $f))
    '{0}`t{1}x{2}`t{3} KB' -f $f, $img.Width, $img.Height, [math]::Round((Get-Item $f).Length / 1KB)
    $img.Dispose()
  } else {
    '{0}`tMISSING' -f $f
  }
}
```

---

## B 组 · 万相视频与循环（S4–S5）

> 执行手册见 `03-qwen-video.md`。**本机无 ffmpeg**：分辨率/时长/音轨等优先用**剪映/PR 媒体信息、播放器属性页、浏览器 `video` 元数据**判断；ffprobe 仅在本机装有 ffmpeg 时作为补充证据，不因「无 ffmpeg」判 FAIL。

| ID | 检查对象 | 方法（命令/脚本/肉眼） | 通过标准 | 证据留档 |
|---|---|---|---|---|
| B1 | 成片规格 | 剪映/PR「媒体信息」或文件属性：1920×1080、H.264、帧率、音轨；播放器 `videoWidth/videoHeight/duration`；ffprobe（可选） | 1080P（1920×1080）；成片 15–18 s（03 口径 **15.75 s**）；**成片/网页 30 fps**（24 fps 母版可选留档）；无音轨；H.264 | `B1-mediainfo.txt`（截图/文本） |
| B2 | 分段时长与整数秒 | 查 4 个母版 `design/source/wan/shot-a_1080p_5s_s20261201.mp4`、`shot-b_1080p_6s_...`、`shot-c_1080p_5s_...`、`loop-sky_1080p_5s_...`；剪映时间线/媒体信息读时长 | API 段落时长分别为 **5 / 6 / 5 / 5 整数秒**（时长粒度 2–15 整数秒）；不出现 5.04 s 之类 | `B2-durations.txt` |
| B3 | 首帧 = 关键帧 | 把成片第 1 帧与 `qwen-kf-a/b/c/sky` 并排截图；检查构图/主体位置/光向 | 每段首帧与对应关键帧同构图、同主体位置、同光向；宽高比精确 16:9 | `B3-firstframe-vs-keyframe.jpg` |
| B4 | 无缝循环 | API 层：`wan-loop` 的 first=last=`qwen-kf-sky`；剪辑层：剪映里 C→loop 0.5 s 叠化 + 成片**尾部 0.75 s 尾叠首**（03 §4.2/§6.1）；连播 5 次盯接缝；首尾帧并排比亮度 | 首尾亮度差 **≤3%**；无黑帧/跳帧/明显重影；播放器 `loop` 5 次不闪 | `B4-loop-first.jpg` / `B4-loop-last.jpg` + `B4-note.txt` |
| B5 | 中心 60%×50% 安全区 | 在帧上画「水平 20%~80%、垂直 25%~75%」框（源 §1.4），A/B/C 每段抽 3 帧检查；量化阈值参考 `03-qwen-video.md` §7.2（中心亮度标准差 ≤15/255、局部最大梯度 ≤25/255、逐帧位移 ≤2 px、角速度 ≤8°/s） | 框内只有天空/云/远山/浅景深；无文字、无高对比主体、无快速运动；主体不进中心 | `B5-safe-zone.jpg`（带框） |
| B6 | 角色与镜头 | 逐段看：发型/淡蓝宽袖/牛仔短裤/白袜/鞋/芥末黄板；C 段侧脸回眸是否能看清；有无第二个人/第二块板；按 `03-qwen-video.md` §7.2 核对「C 段回眸露侧脸」 | 与角色卡同一角色、同一服装；不出现「第二个她」；C 段回眸侧脸可用；A/B 背影跟拍不强制露脸（源片无正脸，03 §7.2 已按此口径） | `B6-frames.jpg` ×4 |
| B7 | poster 与视频首屏连续 | 在剪映里从成片 **B 段中段 t≈6.5 s** 导出单帧 JPG；检查 `public/hero/poster.jpg`（1920×1080、JPEG q82、≤180 KB）；按 03 §6.1 另出 1080×1920 移动版（可选）；打开页面看 poster→视频切换 | 优先 B 帧 → PASS；只有 `qwen-01` 代填 → WARN 并记录跳变；切换无明显跳变 | `B7-poster-vs-first.jpg` + 记录 |
| B8 | 移动端 9:16 | 剪映/播放器媒体信息查 `public/hero/hero-9x16.mp4` 尺寸；375 px 截图看主体 | 1080×1920（或 720×1280）；不裁掉主体；桌面视频未被硬裁 | `B8-375.png` + `B8-mediainfo.txt` |
| B9 | 画面内无文字/水印 | A/B/C/loop 每段抽 3 帧 200% 看左下（源片水印区）与全画面；确认 API 请求 `watermark:false` | 无「由 AI 修改」残留、无假字/花纹/logo；画面里没有 UI 元素 | `B9-frames.jpg` |
| B10 | 交付文件与映射 | 逐项 `Test-Path`：`public\hero\hero.mp4`、`hero-720p.mp4`、`hero-9x16.mp4`、`poster.jpg`；可选 `hero-1080.webm` | 必需项存在；WebM 可选（本机无转码工具时缺失记 WARN，不影响 H.264 主源） | `B10-list.txt` |
| B11 | 剪辑与导出设置 | 剪映/PR 导出面板截图：格式 H.264、分辨率 1080p、帧率 30 fps、码率 5–8 Mbps、无音轨；转场：A→B 0.5 s、B→C 0.5 s、C→loop 0.5 s（交叉淡化/ease-in-out），成片**尾部 0.75 s 尾叠首**；无白闪/黑场；天空有 1%~3% 颗粒 | 导出设置符合；成片 ≈15.75 s（15–18 s 内）；转场无白闪/黑场；叠化期无明显重影；三段色温/亮度一致（同一 LUT 或剪映统一调色）；全屏看天空无色带 | `B11-export-settings.png` + `B11-note.txt` |

---

## C 组 · 前端集成（S6）

> 详细步骤见 `04-frontend-integration.md` §8。**本阶段只改代码、不生成素材**，因此 C12 允许 3 条素材 404 白名单；S5 素材上线后必须归零。

| ID | 检查对象 | 方法（命令/脚本/肉眼） | 通过标准 | 证据留档 |
|---|---|---|---|---|
| C1 | 构建与类型 | `npm run build`；`npx tsc --noEmit`；`npm run lint`（当前仓库基线 exit 0） | build exit 0；TS 无错；`/` 仍是 **○ Static**；lint 若因仓库 bare eslint 脚本不可用，记 WARN 并说明（不伪造 PASS） | `C1-build.log` / `C1-tsc.log` / `C1-lint.log` |
| C2 | 三档截图与结构检查 | `npm run dev` 后另开窗口：`node scripts/shoot.mjs http://127.0.0.1:3000`；看 `CHECK 375/768/1440` 行 | `overflowX=0`；`h1=1`；`imgNoAlt=0`；视频 `paused=false muted=true loop=true readyState≥2`；三档截图：玻璃卡在左、主体在右/可见、无遮挡 | `S6-375.png`、`S6-768.png`、`S6-1440.png`、`shoot.log` |
| C3 | reduced-motion | 同脚本 `REDUCED-MOTION` 行；或用 DevTools Rendering → Emulate `prefers-reduced-motion: reduce` 后刷新 | 视频 `paused=true` 且**只显示 poster**；入场动画不播；无 JS 报错 | `S6-reduced-1440.png` |
| C4 | 文字对比度 ≥4.5:1 | 对 375/1440 截图，用取色器取「文字色」与「文字正后方背景色」，逐对计算：`node -e "const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};const[a,b]=process.argv.slice(1);const x=L(a),y=L(b);console.log(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2))" "#F4F8FC" "#0E1B2A"`；**必须取视频最亮帧**（暂停在云最亮处）与 poster 两张背景各测一次 | 正文/副标/CTA 文字全部 ≥4.5:1（大文本 ≥3:1）；不达标按 `04-frontend-integration.md` §4.3 调 veil/scrim 后复测 | `C4-contrast.txt`（记录 hex 对 + 比值 + 截图时间点） |
| C5 | CLS / LCP | `shoot.mjs` 的 `CHECK` 行看 `cls`；`LCP-4G` 行看毫秒数 | CLS ≤0.1（目标 ≈0）；LCP ≤2500 ms（4G 模拟）。注意：脚本 `CONTRAST` 段是旧主题公式，**该行数值无效**，以 C4 为准 | `shoot.log` + `C5-note.txt` |
| C6 | 视频属性 | DevTools 选中 `<video>` 看属性；或脚本输出 `video.currentSrc`；确认 `autoplay/muted/loop/playsInline/preload="metadata"/poster` | 自动播放且静音循环；有 poster；未 preload 整条视频 | `C6-video-attrs.png` |
| C7 | 无新增依赖 | `git diff --stat package.json package-lock.json`（或 `git status`） | 两个文件 0 改动 | `C7-diff.txt` |
| C8 | 基础可访问性 | 脚本 `h1`/`imgNoAlt`；键盘 Tab 走一遍导航→CTA→SCROLL；看焦点环 | 1 个 h1；图片 alt 齐全；CTA 可 Tab 到且焦点可见；视频 `aria-hidden`/`tabIndex=-1` | `C8-focus.png` + `C8-note.txt` |
| C9 | `backdrop-filter` 兜底 | 代码审查 `app/globals.css` 的 `@supports not (...)`；再用 DevTools 把 `.hero-glass` 的 `background` 临时改成 `rgba(14,27,42,.62)` 模拟兜底外观并测对比度 | 兜底规则存在；模拟后白字仍 ≥4.5:1。**真机「不支持 backdrop-filter」的环境未实测则记 WARN**，不得写 PASS | `C9-fallback.txt` + 截图 |
| C10 | 移动端源选择/裁切 | 375/768 刷新后看 `video.currentSrc`；没有 9:16 时确认回退 720p 且 `object-position:70% 38%`；有 9:16 时确认 `data-orientation="9x16"` | 375 主体不被裁；768 主体可见；`currentSrc` 与视口匹配（源 media 仅在加载时评估，跨断点需刷新） | `C10-currentSrc.txt` + 截图 |
| C11 | 无横向滚动（320/375/768/1440） | `shoot.mjs` 三档 + 手工加 320 px；看 `document.documentElement.scrollWidth - clientWidth` | 各档 = 0 | `C11-overflow.txt` |
| C12 | 控制台错误 | `shoot.mjs` 的 `CONSOLE-ERRORS`；对照白名单 | **S6 阶段白名单**：`hero-9x16.mp4`、`hero-1080.webm`、`hero-1080.av1.webm` 三条 404；**其它任何 pageerror/404 都 FAIL**；S5 素材上线后白名单清空、必须 0 条 | `C12-console.log` + 白名单说明 |

---

## D 组 · 合规与交付（S7）

| ID | 检查对象 | 方法（命令/脚本/肉眼） | 通过标准 | 证据留档 |
|---|---|---|---|---|
| D1 | 全站素材无文字/水印/logo/二维码 | 汇总 A5 + B9；全站走查（Hero/插画区） | 全部满足；玻璃面板文字均为前端叠字，不是生成进图里的 | `D1-final-contact-sheet.jpg` |
| D2 | 文案合规 | `Select-String -Path app\page.tsx,components\landing\Hero.tsx -Pattern '颠覆','赋能','一站式','100%','用户数','融资','客户 logo','真人评价'`；人工读一遍 Hero 文案 | 0 命中禁用词；无编造数据/客户 logo/真人评价；示例数据标「示例」；AI 标识按 `plan.md` §7 第 13 条（编辑页/PDF 页脚「AI 辅助改写」，Hero 不涉及） | `D2-copy-review.md` |
| D3 | 产品事实一致 | 对照 `plan.md` §7/§8：免费 1 份简历 / 2 次 AI / 2 次导出；¥19 / 30 天通行证；不自动续费、到期降免费 | 页面文案与产品事实一致，无「自动续费」表述 | `D3-facts.md` |
| D4 | 资产清单与路径 | `node scripts/hero/assets-check.mjs --json`；`node -e "const a=JSON.parse(require('fs').readFileSync('docs/hero-visual/assets.json','utf8'));console.log(a.assets.length)"` | JSON 可解析；**12 图 + 4 视频**（id 前缀 `qwen-*` / `wan-*`）；prompt/negative 文件存在且 >50 字节；`refs`/`dependsOn` 可解析；`master/webOutputs` 与 `01-visual-bible.md` §7 一致 | `D4-assets-check.log` |
| D5 | 参考素材/设置未被改 | `Get-FileHash 'design\UI_ref.jpg','design\滑板少女.mp4' -Algorithm SHA256` 与 S0 基线比；`git status --porcelain`；确认 `.env.local`、`.claude/settings*.json` 无改动；确认旧主题产物未被删（`public\art\cat.jpg` 等仍在） | 两个参考素材哈希不变；无源码/密钥/设置被误改；旧资产仍在 | `D5-hashes.txt` + `D5-git-status.txt` |
| D6 | 交付物清单 | `Get-ChildItem docs\hero-visual -Recurse -File`；`Test-Path CLAUDE.md`；`Get-ChildItem .claude,scripts\hero -Recurse` | `00-INDEX.md`、`01`–`05`（含 `02-qwen-images.md`、`03-qwen-video.md`）、`assets.json`、`prompts/image`、`prompts/video`、`_fragments/*`、`CLAUDE.md`、`.claude/**`、`scripts/hero/{setup-claude,doctor}.{cmd,ps1}`、`qwen-image-batch.mjs`、`qwen-video-batch.mjs`、`assets-check.mjs` 齐备；**不应再有** `prompts/sd`、`prompts/comfy` 作为可执行输入 | `D6-tree.txt` |
| D7 | 未 git commit | `git log -1 --oneline`；`git status --porcelain` | 无新 commit；工作区改动与预期一致 | `D7-git.txt` |
| D8 | 证据归档完整 | 检查 `design/qa/hero-<YYYYMMDD>/` 是否含：本文件模板、build/lint 日志、三档截图、reduced-motion 截图、图片尺寸清单、媒体信息、对比度记录、视频首尾帧、白名单说明 | 每项都能指出文件；缺证据视为该项未通过 | `D8-evidence-index.md` |
| D9 | 工具自检（不产生费用） | `scripts/hero/doctor.cmd -Json`；`node scripts/hero/assets-check.mjs --json`；`node scripts/hero/qwen-image-batch.mjs --only qwen-01 --dry-run`；`node scripts/hero/qwen-video-batch.mjs --only wan-shot-a --dry-run`；各脚本 `--help` | doctor 无 FAIL（ffmpeg 缺失只算 WARN）；assets-check 无结构错误；两个批量脚本 dry-run 能打印请求且**不触发计费**；不要在本验收里跑 `--run` 或 `-ImageSmoke`（计费） | `D9-tools.log` |
| D10 | 密钥无泄漏 | 命令见本节末「D10/D11 命令块」；另人工读一遍 01/04/05 的密钥相关段落 | 提示词/片段/脚本 0 命中真实 key；文档里只出现环境变量名 `DASHSCOPE_API_KEY`，不出现 key 值；`.claude/settings.local.json` 已被 gitignore；密钥只存在于本机设置 | `D10-secret-scan.txt` |
| D11 | 旧工具链零残留（可执行输入） | 命令见本节末「D10/D11 命令块」 | 命中只允许出现在「已替换/已移除/归档」说明句里；不得作为当前步骤/命令/参数 | `D11-legacy-scan.txt` |

**D10/D11 命令块（在仓库根执行，Windows PowerShell）：**

```powershell
# D10 密钥扫描：只扫产物/脚本，避开本文档里的扫描模式本身
Get-ChildItem docs\hero-visual\prompts,docs\hero-visual\_fragments,scripts\hero -Recurse -File |
  Select-String -Pattern 'sk-ws-','sk-[A-Za-z0-9]{20,}'
git check-ignore .claude/settings.local.json

# D11 旧工具链残留（命中只允许出现在「已替换/已移除/归档」说明里；本文件含扫描命令，故不扫 05 自身）
Select-String -Path docs\hero-visual\01-visual-bible.md,docs\hero-visual\04-frontend-integration.md -Pattern 'ComfyUI','SD WebUI','A1111','IP-Adapter','ControlNet','RIFE','VACE','6GB','sd-batch'
Get-ChildItem docs\hero-visual\prompts -Recurse -Filter *.txt |
  Select-String -Pattern 'ComfyUI','SD WebUI','A1111','IP-Adapter','ControlNet','RIFE','VACE','6GB','sd-batch'
```

---

## 2. 风险表（Qwen/万相版）

| # | 风险 | 严重度 | 现象 / 触发信号 | 缓解与排查（一句话） | 对应验收项 |
|---|---|---|---|---|---|
| R1 | 正脸无素材依据：源片全背面，角色卡正脸是再创作 | 最高 | 客户不认脸，后面批量返工 | S2 必须客户确认后才进入 S3；备选客户提供设定图 | A1 |
| R2 | 生成画面出现文字/假 UI（Qwen-Image 很会渲染文字） | 高 | 玻璃面板/路面/远景出现糊字、二维码 | 负向压「文字/水印/logo/二维码/UI」；`watermark:false`；200% 检查；污染即重跑（源 §7.2 类） | A5 / D1 |
| R3 | 手/悬浮物/滑板轮结构错误 | 高 | 手指畸形、穿模、轮子错位 | 负向压手部/结构；I2I 提高角色卡权重；预算 3–5 次重跑/张 | A10 |
| R4 | 竖屏源片转 16:9 重绘面积大 | 中 | 桌面图构图不合、云型与视频对不上 | 用关键帧重新构图（I2I + 参考帧），不要直接裁切竖屏 | A3/A4 |
| R5 | 风格漂移（参考图/措辞不一致） | 中 | 12 张像不同来源 | 锁角色卡 + 同一套 refs + §6 固定风格措辞；每轮拼联系表 | A3/A4 |
| R6 | 水印残留 / 假 logo / 出现第二个人 | 中 | 左下假字、画面两个少女 | 负向压文字/水印/第二人/镜子；首帧不带水印；污染即重跑 | A5/B9 |
| R7 | 合规：角色看起来是青少年 | 低但必须 | 性化/幼态化/走光倾向 | 保持克制着装，负向压走光/偷拍视角；交付前人工过一遍 | A10/D2 |
| R8 | 参考帧误读：把风吹短发看成帽檐 | 低概率但致命 | 出现帽子/头饰 | 负向压帽子/头饰/耳机；逐张放大头部核对；出现即重跑 | A3/§9 第 1 条 |
| R9 | **API 费用**：按像素档（图）/按秒×分辨率（视频）计费 | 高 | 批量重试把预算烧穿 | 批量前各跑 1 张/1 段试水；先 `--dry-run` 人工确认再 `--run`；失败重试只改一个变量；价格以百炼控制台为准 | D9 |
| R10 | **概率性**：同 seed 也不保证完全一致 | 高 | 重跑结果对不上、客户要求「像素级复现」 | 明示不追求像素级；一致性靠角色卡+refs+固定措辞；重要图另存母版与 `.txt` | A6 |
| R11 | **24h URL 过期** | 高 | 生成的图/视频没及时下载，链接失效 | 脚本立即下载落盘；人工在控制台生成也要马上转存；URL 不写进文档 | D9 |
| R12 | **时长整数**：API 只收 2–15 整数秒 | 中 | 想要 5.04 s 不可得，时间线对不上 | 段落按 5/6/5/5 整数秒生成；剪映叠化 + 尾叠首后成片 ≈15.75 s（03 §0.2）；loop 单独处理 | B1/B2 |
| R13 | **角色漂移 / 首帧不合格** | 高 | i2v 出来不是同一人/衣服变色 | 先过关键帧 gate（构图/角色/无文字）；关键帧不合格绝不跑 i2v；refs 固定 | A3/B3 |
| R14 | **首帧构图/宽高比**：i2v 比例以首帧为准 | 高 | 成片被拉成非 16:9、主体位置错 | 关键帧必须精确 16:9（1280×720）；首帧主体右 1/3、安全区合格才开生成 | B3/B5 |
| R15 | API 失败/限流/欠费 | 高 | 401/402/5xx、异步任务超时（最长 20 min） | 查 Key/余额/地域；失败重试最多 2 次且每次只改一个变量；如实报告不伪造产物 | D9 |
| R16 | 参考图超过 3 张 | 中 | API 直接报错 | 3.0 系最多 3 张；第 1 张角色卡、第 2 张构图参考，其余不用 | A9 |
| R17 | 剪辑/导出不合规 | 中 | 有音轨、码率过低、30fps 设置错、循环有黑帧 | 剪映导出 H.264/1080p/30fps/5–8 Mbps/无音轨；A→B/B→C/C→loop 各 0.5 s 叠化 + 尾部尾叠首 0.75 s；首尾亮度差 ≤3% | B1/B4/B11 |
| R18 | 玻璃后文字对比度不足 | 高（前端） | C4 <4.5:1 | 只调 `--hero-glass-veil-*` 与 scrim，优先加文字安全层（`04-frontend-integration.md` §4.3） | C4 |
| R19 | 素材未齐期间 404 被误判为故障 | 低（过程） | 控制台 3 条 404 | 按 C12 白名单管理；S5 后清零 | C12 |
| R20 | 密钥泄漏 | 高（合规） | key 被写进文档/片段/脚本 | 只放 `.claude/settings.local.json`（gitignored）；D10 扫描；不入库、不进文档 | D10 |

---

## 3. 结论判定与交付条件

- **PASS**：所有必检项 PASS；WARN 项必须写明原因、影响面、负责人、关闭时间。
- **FAIL**：任一必检项失败即整体 FAIL；不得用「后面再补」跳过 gate。
- **允许 WARN 的仅有**：① 真机「不支持 `backdrop-filter`」的环境未实测（需记录浏览器版本）；② S5 前 3 条素材 404 白名单；③ poster 暂用 `qwen-01` 代填（需记录跳变风险）；④ WebM/AV1 可选缺失（本机无转码工具）；⑤ fps 无法从媒体信息读取时，以剪映导出设置截图为准，仍无法确认记 WARN。
- **S7 交付必须同时满足**：`npm run build` 通过 + 本清单四组全过 + 证据目录完整 + `D7` 无新 commit + `D10/D11` 无泄漏、无旧工具链可执行残留。

---

## 4. 源映射

| 本文件 | 来源 |
|---|---|
| 顶层 10 秒验收 | `Prompt/hero-landing-prompt.md` §11（只取验收形式，不取旧主题）+ 源方案 §7 验收 |
| A 组 | `02-qwen-images.md`（S2/S3 + 关键帧）、`01-visual-bible.md` §2/§3/§5/§7、`_fragments/image-assets.json`、源方案 §7 视觉验收 |
| B 组 | `03-qwen-video.md`（S4/S5 + 剪辑导出）、`01-visual-bible.md` §1.4/§2.1/§5、源方案 §7、QWEN_SPEC §1.3/§2.1/§2.4 |
| C 组 | `04-frontend-integration.md`、`AGENTS.md`、`scripts/shoot.mjs`（现有脚本能力）、源方案 §7 |
| D 组 | `plan.md` §7/§8/§13/§14、`00-INDEX.md` §3/§5/§9、QWEN_SPEC §2.2/§2.4/§5、源方案 §7 |
| 风险表 | 源方案 §7.2 视觉风险 + `03-qwen-video.md` §8.1–§8.2（失败处理与成本控制）+ 前端独有 R18/R19 + 合规 R20 |
