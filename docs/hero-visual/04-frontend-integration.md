# 04 · Hero 前端集成（S6 执行手册）

> 版本 v2.0 · 2026-10-20 · 依据：`01-visual-bible.md`（唯一事实源）+ `02-qwen-images.md`/`03-qwen-video.md`（千问原生 API 产物）+ 源方案 §2（Hero 毛玻璃落地规范，保留）+ 当前仓库实况。
> 本阶段目标：**只改前端代码**，把旧主题 Hero（暖色山谷/居中版式）换成「左侧毛玻璃卡片 + 右侧少女主体」的新版式，并让 HeroVideo 具备多源、poster、reduced-motion、懒播放、淡入与 `backdrop-filter` 兜底。

> **落地实现说明（2026-10-20 交付版，优先于下文旧稿）**：
> 1. 毛玻璃采用**浅色磨砂**：`linear-gradient(rgba(255,255,255,.78) → rgba(244,248,252,.52))` + `blur(28px) saturate(1.45) brightness(1.06)` + 白 75% 描边 + 内高光；文字改用**深墨 `#0E1B2A`**（亮背景可读），CTA 仍为粉底白字。原「深色 veil + 白字」方案已弃用。
> 2. Hero 移动端（<1024px）使用 9:16 竖版封面 `/hero/mobile-cover.jpg`，桌面用 `/hero/poster.jpg`（成片抽帧）；视频多 source、`prefers-reduced-motion`、IntersectionObserver 逻辑保留。
> 3. 首屏之外整页已同步新 KV：I1 用于「三步」、I2 用于「排版」深色带、I3 用于底部 CTA、I4 用于新增「关于我们」、I6 用于移动封面、`og-hero.jpg` 用于 metadata；旧 `art/person|cat|sky.jpg` 已不再引用。
> 4. 验证结果：`tsc --noEmit` / `npm run lint` / `npm run build` 均通过；375/768/1440 三档 `overflowX=0`、`h1=1`、图片 alt 齐全、视频 muted+loop 播放；截图见 `design/qa/final-*.png`。
> **本阶段不生成任何素材**（Qwen-Image/万相 2.7 产物由 S2–S5 负责）；**不改** `.env.local`、`lib/`、`app/api/`、认证/支付/数据库逻辑、`package.json` 依赖、`.claude/settings*.json`、`.gitignore`；**不 git commit**；`npm run build` 必须通过。

**路径约定**：文件改动用仓库根相对路径（如 `app/globals.css`）；同目录文档用裸文件名（如 `01-visual-bible.md`）；提示词用 `prompts/image/*.txt`、`prompts/video/*.txt`（相对本目录）。

---

## 0. 开工前必读（Next.js 16 有破坏性变更，不许凭记忆写）

`AGENTS.md` 明确要求：写代码前先读 `node_modules/next/dist/docs/` 对应篇目。本任务至少要读下列 6 篇（路径相对仓库根，均已在当前 `node_modules` 内核实存在）：

| # | 篇目 | 本任务要用到的结论 |
|---|---|---|
| 1 | `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` | **Next 16 起 `priority` 属性已弃用**（`v16.0.0` 变更），改用 `loading="eager"` / `fetchPriority="high"` / `preload`；`public/` 静态图可用 `unoptimized` 走原图 URL |
| 2 | `node_modules/next/dist/docs/01-app/02-guides/videos.md` | `<video>` 必须预留尺寸/`aspect-ratio`（否则计 CLS）；用 `poster` 在加载期填充视频框；`autoPlay` 必须配 `muted`，iOS 需 `playsInline` |
| 3 | `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` | 全局 CSS 入口仍是 `app/globals.css`；Tailwind 4 用 `@theme` 定义 token |
| 4 | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md` | `public/hero/*` 以 `/hero/*` 直出；构建期不会校验文件是否存在，**缺素材不会让 build 失败**，只会在运行时 404 |
| 5 | `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` | 缓存/预取默认值变化；本页 Hero 是静态路由，**不要引入 `cookies()`/`headers()` 等动态 API** |
| 6 | `node_modules/next/dist/docs/03-architecture/supported-browsers.md` | 现代浏览器基线；`backdrop-filter` 与多视频编码需要兜底 |

实测基线（2026-10-20 本机）：`npm run build` **通过**；构建输出显示 `Cache Components enabled`、`Partial Prefetching enabled`，路由 `/` 为 **○ Static**。S6 验收必须复核 `/` 仍是静态（引入动态 API 会让它变成动态/部分预渲染，属回归）。

---

## 1. 当前实现（改造对象）

| 文件 | 现状要点 |
|---|---|
| `app/layout.tsx` | `lang="zh-CN"`；`next/font` 自托管 Geist；`metadata` 有 `title/description`；**S6 不改** |
| `app/globals.css` | `@import "tailwindcss"`；`:root{--background,--foreground}`；`@theme inline` 4 个映射；`ld-rise/ld-line/ld-breathe` 入场动画 + `prefers-reduced-motion` 关闭动画；**无 Hero 专属 token** |
| `components/landing/Hero.tsx` | Server Component；整段暖色渐变底（`from-[#f6e7cd] via-[#f3ecdf] to-[#efe6d6]`）；底部 4:3 海报层（`absolute inset-x-0 bottom-0 aspect-[4/3] lg:inset-0`）用 `<Image priority>`；居中柔光遮罩；居中胶囊导航；内容整体居中、`pb-[calc(75vw+1.5rem)]`；炭色 H1 两行；双 CTA；底部 SCROLL |
| `components/landing/HeroVideo.tsx` | `"use client"`；无 `poster` 属性；两个 `<source>`（`/hero/hero-720p.mp4` ≤1023px + `/hero/hero.mp4`）；`canplay` 后 400 ms 淡化；IntersectionObserver（threshold 0.15）滚出暂停；`prefers-reduced-motion` 只做暂停、无 CSS 兜底 |
| `app/page.tsx` | Hero + 8 个区块：Hero → 三步 → 改写前后 → 从容带 → 能力 → 价格 → FAQ → CTA → 页脚；Hero 之外的版式/文案/`alt` 都是旧主题；**S6 不改这些区块** |
| `public/hero/` | 当前只有旧主题 `hero.mp4`（4.04 MB）、`hero-720p.mp4`（1.12 MB）、`poster.jpg`（190 KB）；新素材路径见 `01-visual-bible.md` §7（Qwen 图 + 万相视频） |
| `public/art/` | 旧主题 `cat.jpg / person.jpg / sky.jpg`；新 `qwen-02`~`qwen-07` 网页图未生成；**不删除、S6 不切换** |

---

## 2. 当前 → 目标差异清单

| # | 维度 | 当前 | 目标（依据） | 落点 |
|---|---|---|---|---|
| 1 | 背景基调 | 暖米色渐变（旧主题） | 深墨底 + 天空/灰蓝，全幅视频 + scrim（01 §5） | `Hero.tsx`、`globals.css` |
| 2 | 版式 | 居中堆叠，文字压底部 4:3 横幅 | 左玻璃卡片（≤640 px）+ 右主体区，桌面 60/40 网格（01 §5.6） | `Hero.tsx` |
| 3 | 移动端 | 视频收进底部 4:3 横幅 | 全幅 9:16 视频/poster，玻璃卡片靠下；无 `75vw` 垫高 | `Hero.tsx`、`HeroVideo.tsx` |
| 4 | 文字色 | 炭色 `zinc-900` 压亮背景 | 白/云白压玻璃与深色 scrim；CTA 粉底白字（01 §3.2） | `Hero.tsx` |
| 5 | 导航 | 白色胶囊 + 深色登录按钮 | 结构不变；登录按钮改 `--hero-ink`，其余保留 | `Hero.tsx` |
| 6 | poster | 独立 `<Image priority>` 层（`priority` 已弃用） | 保留独立 poster 层但改 `loading="eager" fetchPriority="high" unoptimized`；`<video poster>` 指同一 URL；CSS 渐变兜底 | `Hero.tsx`、`HeroVideo.tsx`、`globals.css` |
| 7 | 视频源 | 2 个（720p / 1080p mp4） | 5 个：9x16 → 720p → AV1 → VP9 → H.264（源 §2.2 + `03-qwen-video.md` §6.2 导出） | `HeroVideo.tsx` |
| 8 | reduced-motion | 仅暂停视频 | 暂停 + 视频隐藏 + poster 兜底 + 监听媒体查询变化（源 §2.3） | `HeroVideo.tsx`、`globals.css` |
| 9 | 玻璃 | 无 | 玻璃卡片 + `@supports not (backdrop-filter)` 深色兜底 + 移动端关模糊（源 §2.3） | `globals.css` |
| 10 | token | 无 `--hero-*` | 7 色 + 派生粉 + 圆角 + `@theme inline` 映射（01 §3） | `globals.css` |
| 11 | 遮罩 | 中心白色径向柔光（为炭字服务） | `radial 暖光 + 线性深墨` scrim（源 §2.3，为白字服务） | `Hero.tsx`、`globals.css` |
| 12 | 入场动画 | `ld-rise / ld-line / ld-breathe` | **保持不变**（只延时值随 DOM 位置微调） | `Hero.tsx`、`globals.css` |
| 13 | a11y | 视频 `aria-hidden`；图片 alt 有 | 保留；视频补 `tabIndex={-1}`；poster 装饰图 `alt=""`；焦点环可见 | `HeroVideo.tsx`、`Hero.tsx` |
| 14 | 依赖 | — | **不新增任何依赖**（不引播放器/动画库/字体/CDN） | `package.json` 不动 |

---

## 3. CSS token 落地（Tailwind 4 / `app/globals.css`）

### 3.1 规则

- **只追加，不重排**：现有 `--background/--foreground`、`@theme inline` 四行、`ld-*` 动画全部保留；新增内容追加到文件末尾（或独立块）。
- 新增变量统一 `--hero-` 前缀，避免与 Tailwind/项目变量冲突；颜色通过 `@theme inline` 映射成 `bg-hero-* / text-hero-*` 工具类。
- 组件里**不许出现裸 hex**（除 `rgba()` 遮罩）；颜色一律走变量，方便验收统一调整。

### 3.2 追加到 `app/globals.css` 的代码

```css
/* ===== Hero 视觉 token（唯一来源 docs/hero-visual/01-visual-bible.md §3） ===== */
:root {
  --hero-sky: #1a6bd6;
  --hero-cloud: #f4f8fc;
  --hero-sun: #ffe9b0;
  --hero-chrome-1: #f7f9fa;
  --hero-chrome-2: #c9d2d9;
  --hero-chrome-3: #8e9aa4;
  --hero-pink: #e5355b;
  --hero-pink-cta: #d01e48; /* 可访问性深色派生：仅 CTA 底色，白字 5.30:1 */
  --hero-grey-blue: #8e9aa1;
  --hero-ink: #0e1b2a;
  --hero-radius: 28px;
}

@theme inline {
  --color-hero-sky: var(--hero-sky);
  --color-hero-cloud: var(--hero-cloud);
  --color-hero-sun: var(--hero-sun);
  --color-hero-chrome-1: var(--hero-chrome-1);
  --color-hero-chrome-2: var(--hero-chrome-2);
  --color-hero-chrome-3: var(--hero-chrome-3);
  --color-hero-pink: var(--hero-pink);
  --color-hero-pink-cta: var(--hero-pink-cta);
  --color-hero-grey-blue: var(--hero-grey-blue);
  --color-hero-ink: var(--hero-ink);
  --radius-hero: 28px;
}

/* 底：视频没准备好/素材缺失时先显示渐变，避免白屏与闪黑 */
.hero-surface {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background-color: var(--hero-ink);
  background-image: linear-gradient(
    180deg,
    #0e1b2a 0%,
    #123a63 42%,
    #1a6bd6 68%,
    #8e9aa1 100%
  );
}

/* 视频 / poster 铺满 */
.hero-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 50%;
}

/* 压字遮罩：暖光 + 底部渐深，服务白字（源 §2.3） */
.hero-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 70% 30%, rgba(255, 233, 176, 0.1), transparent 60%),
    linear-gradient(
      180deg,
      rgba(8, 20, 36, 0.1) 0%,
      rgba(8, 20, 36, 0.35) 55%,
      rgba(8, 20, 36, 0.62) 100%
    );
}

/* 毛玻璃卡片（源 §2.3；veil 是「文字安全层」，对比度不够时只调它） */
.hero-glass {
  --hero-glass-tint-top: 0.18;
  --hero-glass-tint-bottom: 0.06;
  --hero-glass-veil-top: 0.1;
  --hero-glass-veil-bottom: 0.2;
  position: relative;
  isolation: isolate;
  border-radius: var(--hero-radius);
  padding: 40px 36px;
  color: var(--hero-cloud);
  background:
    linear-gradient(
      180deg,
      rgba(8, 20, 36, var(--hero-glass-veil-top)),
      rgba(8, 20, 36, var(--hero-glass-veil-bottom))
    ),
    linear-gradient(
      135deg,
      rgba(255, 255, 255, var(--hero-glass-tint-top)) 0%,
      rgba(255, 255, 255, var(--hero-glass-tint-bottom)) 100%
    );
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1),
    0 24px 60px rgba(6, 20, 40, 0.28);
  -webkit-backdrop-filter: blur(28px) saturate(1.35) brightness(1.04);
  backdrop-filter: blur(28px) saturate(1.35) brightness(1.04);
}

/* 噪点：让玻璃有实体感（源 §2.3，逐字） */
.hero-glass::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>");
}

/* 文字与按钮 */
.hero-title {
  margin: 24px 0 0;
  font-size: clamp(32px, 4.2vw, 60px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  font-weight: 700;
  color: var(--hero-cloud);
  text-shadow: 0 2px 24px rgba(6, 20, 40, 0.35);
}
.hero-sub {
  margin-top: 20px;
  max-width: 34rem;
  font-size: clamp(14px, 1.3vw, 17px);
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.82);
}
.hero-cta-primary {
  border-radius: 999px;
  padding: 14px 28px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--hero-pink-cta);
  box-shadow:
    0 10px 30px rgba(229, 53, 91, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.hero-cta-primary:hover {
  background: color-mix(in srgb, var(--hero-pink-cta) 88%, #000);
}
.hero-cta-ghost {
  border-radius: 999px;
  padding: 14px 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--hero-cloud);
  border: 1px solid rgba(255, 255, 255, 0.35);
}
.hero-cta-ghost:hover {
  background: rgba(255, 255, 255, 0.1);
}
.hero-cta-primary:focus-visible,
.hero-cta-ghost:focus-visible {
  outline: 2px solid var(--hero-cloud);
  outline-offset: 3px;
}

/* 移动端：关掉 28px 模糊（性能），改深色不透明玻璃，文字对比度反而更高 */
@media (max-width: 1023px) {
  .hero-media {
    object-position: 70% 38%; /* 16:9 兜底源：保住右 1/3 主体，别用旧任务书的 50% 38% */
  }
  .hero-media[data-orientation="9x16"] {
    object-position: 50% 50%;
  }
  .hero-glass {
    padding: 24px;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: rgba(14, 27, 42, 0.62);
  }
}

/* 不支持 backdrop-filter 的浏览器：不透明深色玻璃，白字仍可读（源 §2.3 兜底） */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hero-glass {
    background: rgba(14, 27, 42, 0.62);
  }
}

/* 减少动态：只留 poster，不播视频、不做淡入 */
@media (prefers-reduced-motion: reduce) {
  .hero-media {
    display: none;
  }
  .hero-surface {
    background-image:
      url("/hero/poster.jpg"),
      linear-gradient(180deg, #0e1b2a 0%, #123a63 42%, #1a6bd6 68%, #8e9aa1 100%);
    background-position: center, 0 0;
    background-size: cover, auto;
    background-repeat: no-repeat, repeat;
  }
  .hero-glass,
  .hero-media {
    transition: none;
  }
}
```

### 3.3 使用示例（组件里只引 token 类）

```tsx
<article className="hero-glass">
  <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-medium text-hero-cloud backdrop-blur">
    AI 按 JD 逐段改写
  </span>
  <h1 className="hero-title">求职，从容一点。</h1>
  <p className="hero-sub">粘贴目标 JD，AI 按关键词把你的经历改写成 HR 想看的量化表达；排版、导出，一次做完。</p>
  <div className="mt-8 flex flex-wrap gap-3">
    <Link href="/editor" className="hero-cta-primary">免费开始制作</Link>
    <a href="#how" className="hero-cta-ghost">看看怎么用</a>
  </div>
</article>
```

> 若团队对「多个 `@theme inline` 块」有顾虑，可把新增映射并入现有块；**但不要修改/删除现有四行映射**。S6.2 构建一次即可确认 Tailwind 4 正常产出 `bg-hero-*` 类。

---

## 4. 新版 Hero 版式（`components/landing/Hero.tsx`）

### 4.1 结构（Server Component，保持零客户端逻辑）

```tsx
<section className="hero-surface relative flex min-h-svh flex-col overflow-hidden">
  {/* 1) poster 兜底层：先绘制，LCP 候选，视频未就绪/缺失/reduced-motion 时兜底 */}
  <div aria-hidden className="absolute inset-0">
    <Image
      src="/hero/poster.jpg"
      alt=""
      fill
      unoptimized
      loading="eager"
      fetchPriority="high"
      sizes="100vw"
      className="object-cover"
    />
  </div>

  {/* 2) 视频（client 组件，本身也是 absolute） */}
  <HeroVideo />

  {/* 3) scrim */}
  <div aria-hidden className="hero-scrim" />

  {/* 4) 顶部胶囊导航：结构沿用现有，只换登录按钮颜色 */}
  <header className="ld-rise absolute inset-x-0 top-5 z-20 flex justify-center px-4">
    {/* nav 结构与文案不动 */}
  </header>

  {/* 5) 内容区：<1024 单列靠下，≥1024 左卡右主体 */}
  <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-end px-4 pb-16 pt-24 sm:items-center lg:px-8 lg:py-24">
    <div className="grid w-full min-w-0 grid-cols-1 items-end gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center lg:gap-12">
      <article className="hero-glass min-w-0 max-w-[640px]">
        {/* 徽章/副标/CTA 沿用 ld-rise，H1 沿用 ld-line；延时沿用旧值：徽章 .10s、H1 两行 .18s/.26s、副标 .42s、CTA .52s（reduced-motion 下 globals.css 已关闭） */}
      </article>
      {/* 右列：留给画面里的主体，不放内容（桌面右列占 40%） */}
      <div aria-hidden className="hidden min-w-0 lg:block" />
    </div>
  </div>

  {/* 6) SCROLL：仅桌面显示，避免与底部卡片重叠 */}
  <div className="ld-rise absolute inset-x-0 bottom-6 z-10 hidden justify-center lg:flex">
    <a href="#how" className="ld-breathe rounded-full bg-white/70 px-5 py-2 text-[10px] font-semibold tracking-[0.25em] text-hero-ink backdrop-blur transition hover:bg-white/90">
      SCROLL ↓
    </a>
  </div>
</section>
```

### 4.2 版式规则

| 场景 | 规则 |
|---|---|
| ≥1024 px | 网格 `minmax(0,1.2fr) minmax(0,0.8fr)`；卡片 `max-width:640px`；内容垂直居中；SCROLL 显示 |
| 768–1023 px | 单列；卡片靠下、`w-full`；视频 16:9 兜底源用 `object-position: 70% 38%` |
| <768 px | 单列；卡片靠下、全宽；有 `hero-9x16.mp4` 时 `object-position:50% 50%`；SCROLL 隐藏 |
| 横向溢出 | `overflow-hidden` + 每个 grid 子项 `min-w-0`；长标题允许换行（中文自然断行） |
| 高度 | `min-height:100svh`；不要用 `100vh`（移动端地址栏抖动） |

### 4.3 文字与 scrim（可读性）

- H1 白色（`--hero-cloud`）、`text-shadow: 0 2px 24px rgba(6,20,40,.35)`；副标 `rgba(255,255,255,.82)`。
- 全屏 scrim 用源 §2.3 的默认值；**玻璃卡片内再叠一层 veil**（`.hero-glass` 两个 CSS 变量）。
- 对比度不达标时**只调这两个参数**，顺序：① `--hero-glass-veil-top/bottom` +0.08~0.15；② `.hero-scrim` 底部 0.35→0.5（源 §2.3 明确允许）；③ 文字加 `1px rgba(0,0,0,.25)` 外发光。每改一次按 `05-acceptance.md` C4 复测。
- CTA 主按钮用 `--hero-pink-cta`（白字 5.30:1），**不要**用 `--hero-pink` 配 14 px 白字（4.21:1 不达标）。

---

## 5. HeroVideo 改造（`components/landing/HeroVideo.tsx`）

### 5.1 目标行为

| 行为 | 要求 |
|---|---|
| 多源 | 顺序：`hero-9x16.mp4`（≤767）→ `hero-720p.mp4`（≤1023）→ `hero-1080.av1.webm`（AV1）→ `hero-1080.webm`（VP9）→ `hero.mp4`（H.264）；**AV1 放网页源第一位**（移动端 media 源需排最前；前端交接见 `03-qwen-video.md` §7.3） |
| poster | `poster="/hero/poster.jpg"`；与独立 `<Image>` 层同 URL（浏览器缓存共享，避免双下载） |
| 播放 | `autoPlay muted loop playsInline preload="metadata"`，`aria-hidden`，`tabIndex={-1}`；**不 preload 整条视频**（`03-qwen-video.md` §7.3） |
| 淡入 | `canplay` 后 400 ms 再 `opacity-100`，避免闪黑 |
| 省电 | IntersectionObserver（threshold 0.15）：滚出暂停、滚回播放 |
| reduced-motion | 初始与 `change` 都处理：`autoplay=false` + `pause()` + 停留在 poster（视频 `display:none` 由 CSS 兜底） |
| 兜底 | `play()` 被拒/`error`/`stalled` 时不崩：保持 poster 层可见，视频保持透明即可（**不允许黑屏**） |
| 方向标记 | `loadedmetadata` 后按 `currentSrc` 是否含 `hero-9x16` 设置 `data-orientation`，CSS 据此选 `object-position` |

### 5.2 参考实现（可直接落地）

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 首屏视频：poster 层由 Hero.tsx 负责立即绘制；
 * 本组件只负责「多源选择 + canplay 淡入 + 滚出暂停 + reduced-motion 兜底」。
 */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<"9x16" | "16x9">("16x9");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let halt: (() => void) | undefined;
    let observer: IntersectionObserver | undefined;

    const clearFade = () => {
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      fadeTimer = undefined;
    };

    const start = () => {
      clearFade();
      observer?.disconnect();
      observer = undefined;
      if (motionQuery.matches) {
        video.autoplay = false;
        video.pause();
        setReady(false);
        halt = () => video.pause();
        video.addEventListener("play", halt);
        return;
      }
      // 若从 reduced-motion 切回：移除拦截再播放
      if (halt) {
        video.removeEventListener("play", halt);
        halt = undefined;
      }
      void video.play().catch(() => setReady(false));
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) void video.play().catch(() => undefined);
          else video.pause();
        },
        { threshold: 0.15 },
      );
      observer.observe(video);
    };

    const onLoadedMetadata = () => {
      setOrientation(video.currentSrc.includes("hero-9x16") ? "9x16" : "16x9");
    };
    const onCanPlay = () => {
      clearFade();
      fadeTimer = setTimeout(() => setReady(true), 400);
    };
    const onError = () => setReady(false);
    const onMotionChange = () => start();

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    motionQuery.addEventListener("change", onMotionChange);

    start();

    return () => {
      clearFade();
      if (halt) video.removeEventListener("play", halt);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      motionQuery.removeEventListener("change", onMotionChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      data-orientation={orientation}
      aria-hidden
      tabIndex={-1}
      autoPlay
      controls={false}
      loop
      muted
      playsInline
      preload="metadata"
      poster="/hero/poster.jpg"
      className={`hero-media transition-opacity duration-700 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <source src="/hero/hero-9x16.mp4" media="(max-width: 767px)" type="video/mp4" />
      <source src="/hero/hero-720p.mp4" media="(max-width: 1023px)" type="video/mp4" />
      <source src="/hero/hero-1080.av1.webm" type="video/webm; codecs=av01" />
      <source src="/hero/hero-1080.webm" type="video/webm; codecs=vp9" />
      <source src="/hero/hero.mp4" type="video/mp4" />
    </video>
  );
}
```

### 5.3 已知限制（照实写进验收记录）

1. **`<source media>` 只在资源选择时评估**：拖动窗口跨断点不会自动换源，刷新才生效；三档截图脚本每个视口都新开页面，因此不受影响。开发时若发现 375 px 还在播桌面源，先刷新再判断。
2. **素材未齐时会有 404**：S6 阶段只有 `hero.mp4`、`hero-720p.mp4`、`poster.jpg` 存在，`hero-9x16.mp4`、`hero-1080.webm`、`hero-1080.av1.webm` 尚未生成 → 控制台有 3 条 404 属**预期**；S5 素材上线后必须归零（见 `05-acceptance.md` C12）。
3. **视频 `opacity-0` 期间海报由 Hero 的 `<Image>` 层承担**：所以该层不能用 `priority`（Next 16 已弃用），必须 `loading="eager" fetchPriority="high"`，否则 LCP 会退化。
4. 无 JS 时视频不淡入，但海报层仍在 → 页面不会黑屏；这是有意的降级。

---

## 6. 文案与信息架构（沿用既有产品事实，不编造）

### 6.1 Hero 文案（逐字保留，不许"顺手优化"）

| 位置 | 文案 | 来源 |
|---|---|---|
| 徽章 | `AI 按 JD 逐段改写` | `app/page.tsx` 现状（既有文案） |
| H1（两行） | `求职，` / `从容一点。` | 同上 |
| 副标 | `粘贴目标 JD，AI 按关键词把你的经历改写成 HR 想看的量化表达；排版、导出，一次做完。` | 同上 |
| 主 CTA | `免费开始制作` → `/editor` | 同上 |
| 次 CTA | `看看怎么用` → `#how` | 同上 |
| 底部 | `SCROLL ↓` → `#how` | 同上 |
| 导航 | `怎么用` / `能力` / `价格` / `常见问题` / `登录`（`/sign-in`） | `components/landing/Hero.tsx` |

### 6.2 产品事实（来自 `plan.md` 与现有页面，写文案只能基于这些）

- 面向国内求职者的中文 AI 简历编辑器；核心差异 = 粘贴目标 JD → 按关键词逐段改写 → 量化表达 → 一键导出 A4 PDF。
- 免费额度：1 份简历、2 次 AI 改写、2 次导出。
- 付费：¥19 / 30 天通行证，**不自动续费**，到期降回免费额度。
- 数据存境内；照片属敏感个人信息（单独同意）；注销即删。
- 禁用词：颠覆、赋能、一站式、100% 通过；不出现编造的用户数、融资额、客户 logo、真人评价；示例数据必须标「示例」。

### 6.3 S6 不做的页面改动（防止越界）

- 不改 `app/page.tsx` 的 8 个区块、不动价格/FAQ/页脚文案与结构。
- 不替换 `public/art/*`（旧主题图先留着），不新增 About/品牌故事区块（`qwen-05` 等素材到位后另立任务）。
- 不改 `app/layout.tsx` 的 `metadata`（OG 图是 `qwen-01` 的后置项，等素材与 1200×630 导出完成再做；属 S7+，见 §8 S6.7）。
- 不改 `lib/`、`app/api/`、认证/支付/数据逻辑，不改 `.env.local`。

---

## 7. 性能 / 可访问性 / 兼容性

### 7.1 性能预算

| 指标 | 目标 | 做法 |
|---|---|---|
| LCP | ≤ 2.5 s（本地 4G 模拟） | poster 用 `loading="eager" fetchPriority="high"`；视频只 `preload="metadata"`，绝不 preload 整条视频（`03-qwen-video.md` §6.2：15.75 s/约 10 MB 会抢首屏带宽） |
| CLS | ≈ 0（≤0.1） | `min-height:100svh` + 视频/poster 全部 absolute 铺满，不占文档流；字体用 `next/font` 自托管，无远程字体 |
| 首屏体积 | 海报 ≤180 KB；视频 1080p 5~8 Mbps、15.75 s ≈ 9~11 MB（`03-qwen-video.md` §6.2） | 视频按需加载；海报复用同一 URL 避免双下载 |
| 横向滚动 | 0 | `overflow-hidden` + `min-w-0`；375/768/1440 三档实测 |
| 动画成本 | 纯 CSS `transform/opacity` | 不引动画库；`backdrop-filter` 在 <1024 px 关闭 |
| 依赖 | 0 新增 | 不改 `package.json` / lockfile |

### 7.2 可访问性

- 页面只有 1 个 `h1`（在 Hero 玻璃卡片内）；其余区块继续用 `h2/h3`。
- 视频装饰性：`aria-hidden` + `tabIndex={-1}`，不提供字幕轨道（无音轨、无叙事内容）。
- poster 装饰图 `alt=""`；后续 `qwen-02`~`qwen-07` 等插画接入时必须写真实 `alt`（沿用现有插画的写法，不写"图片"）。
- 键盘可达：CTA/导航保留 `:focus-visible` 外描边（见 §3.2）。
- 对比度：正文 ≥4.5:1、大文本 ≥3:1（依据 WCAG AA；具体配对见 `01-visual-bible.md` §3.2）。玻璃上文字按 C4 实测，不靠推算。
- `prefers-reduced-motion`：视频不播、入场动画关闭（`globals.css` 现有规则保留）。

### 7.3 兼容性

| 环境 | 处理 |
|---|---|
| 不支持 `backdrop-filter` | `@supports not (...)` → `rgba(14,27,42,.62)` 深色玻璃，白字可读 |
| 移动端低端机 | <1024 px 关闭 `backdrop-filter`，改用不透明深色卡；视频保持 `muted/playsInline` |
| Safari | `-webkit-backdrop-filter` 前缀；`playsInline` 必填；低电量模式不自动播放 → poster 兜底（`03-qwen-video.md` §6.2） |
| 旧浏览器/无 JS | 海报层 + 渐变底先出；视频不淡入不影响可读性 |
| 编码支持 | AV1 → VP9 → H.264 逐级回退；H.264 是最终兜底 |
| 移动端裁切 | 有 9:16 源用 `50% 50%`；无 9:16 时用 `70% 38%` 保住右 1/3 主体（**不要照搬旧任务书的 `50% 38%`**，那是给居中人物+猫的旧构图） |

---

## 8. 实现步骤 S6.0–S6.7

> 每步都：先改动 → 跑验收 → 留证据 → 不通过不进入下一步。回滚命令统一用 `git restore <file>`（仓库当前代码文件是已跟踪的干净状态，实测 `git status` 只有 docs/.claude 等未跟踪项）。

| 步骤 | 文件 | 改动 | 验收 | 回滚 |
|---|---|---|---|---|
| **S6.0** | 无 | 读 §0 的 6 篇 Next 文档；确认 `AGENTS.md`/`plan.md` 约束；记下构建基线（`/` 为静态） | 能复述：`priority` 已弃用、video 需 poster/尺寸、public 文件构建期不校验、勿引入动态 API | — |
| **S6.1** | 无 | 记录基线：`git status --porcelain`；`npm run build`；`Get-FileHash app/globals.css, components/landing/Hero.tsx, components/landing/HeroVideo.tsx` 存到证据目录 | build exit 0；三个文件哈希已留档 | — |
| **S6.2** | `app/globals.css` | 追加 §3.2 全部 CSS：`:root` hero token、`@theme inline` 映射、`.hero-surface/.hero-media/.hero-scrim/.hero-glass/.hero-title/.hero-sub/.hero-cta-*`、`@supports`、移动端、reduced-motion。**不动现有 `--background/--foreground`、四行映射、`ld-*` 动画** | `npm run build` 通过；`Select-String -Path app\globals.css -Pattern '--hero-sky'` 命中；无重复变量名 | `git restore app/globals.css` |
| **S6.3** | `components/landing/Hero.tsx` | 按 §4.1 重排：poster 层（`loading="eager" fetchPriority="high" unoptimized`）、`hero-scrim`、nav（结构文案不动，登录按钮换 `bg-hero-ink`）、grid 左卡右主体、SCROLL 仅桌面；文案逐字保留；删除旧暖色渐变/白色径向柔光/底部 4:3 包装层 | 1440 截图：卡片在左、少女在右未被遮；375：无横向滚动、卡片文字完整；`Select-String -Path components\landing\*.tsx -Pattern 'f6e7cd','priority'` 无命中（旧主题色/弃用属性已清除） | `git restore components/landing/Hero.tsx` |
| **S6.4** | `components/landing/HeroVideo.tsx` | 按 §5.2：5 源顺序、`poster`、`data-orientation`、reduced-motion（初始 + change）、IO 懒播放、canplay 400 ms 淡入、`error` 兜底、`tabIndex={-1}` | 首屏视频自动播放且 `muted/loop`；滚出视口后 `paused=true`；模拟 `prefers-reduced-motion` 后 `paused=true` 且 poster 可见；用 DevTools 阻断 webm/av1 请求（或临时改名后立即恢复）后仍能回退到 mp4 播放 | `git restore components/landing/HeroVideo.tsx` |
| **S6.5** | 三个文件 | 清理旧主题残留（Hero 内的暖色/居中/4:3 逻辑）；确认没动 `app/page.tsx`、`app/layout.tsx`、`public/*`、`package.json` | `git status --porcelain` 只有预期的 3 个 tracked 修改 + 原有未跟踪项；`git diff --stat` 不含禁止文件 | `git restore` 对应文件 |
| **S6.6** | 无（验证） | `npm run build`、`npm run lint`、`npm run dev` 后跑 `node scripts/shoot.mjs http://127.0.0.1:3000`；按 `05-acceptance.md` C 组补齐手测 | build/lint 通过；三档截图无溢出、CLS≈0、CLS/LCP 有记录；对比度按 C4 实测 ≥4.5:1；允许的 3 条 404 已登记 | 无（验证步骤） |
| **S6.7**（后置，不影响 S6 交付） | `public/hero/*`、`app/layout.tsx` | S5 素材到位后再做：用新成片覆盖 `hero.mp4`/`hero-720p.mp4`/`hero-9x16.mp4`/`hero-1080.webm`/`hero-1080.av1.webm`/`poster.jpg`；补 OG metadata（`public/og-hero.jpg` 1200×630，产物待生成）；后续再按映射替换 `/art/*` 与 alt | 三个 404 归零；视频/海报与 `01-visual-bible.md` §7 一致；OG 分享卡 1200×630 | 逐个文件恢复旧素材 |

**S6 完成的定义**：S6.1–S6.6 全过，且 `npm run build` 通过；不要求 S6.7 的素材替换完成（本阶段不生成素材）。

---

## 9. 素材缺失时的降级路径（保证 build 通过、页面不黑屏）

| 缺失项 | 页面表现 | 代码侧处理 | 阻塞 build？ |
|---|---|---|---|
| 新视频全缺 | 只有 poster/渐变，无动态 | poster 层 + `.hero-surface` 渐变；视频 `opacity-0` | 否（public 文件构建期不校验） |
| `hero-9x16.mp4` 缺 | 375 px 回退到 `hero-720p.mp4` | 源顺序回退 + `object-position:70% 38%` | 否 |
| `hero-1080.webm` / `.av1.webm` 缺 | 回退 H.264 | 源顺序回退 | 否 |
| `hero-720p.mp4` 缺 | 375/768 回退 1080p mp4 | 源顺序回退（流量变大，WARN） | 否 |
| `poster.jpg` 缺 | 渐变底 + 视频 poster 404 | `.hero-surface` 渐变；`@media reduced-motion` 的 `url()` 失败后仍显示线性渐变（CSS 多背景特性） | 否 |
| `backdrop-filter` 不支持 | 深色不透明卡 | `@supports not` 兜底 | 否 |
| JS 禁用 | 只有海报 + 文字，无视频 | 视频 `opacity-0`，poster 层可见 | 否 |
| reduced-motion | 只显示 poster | CSS `display:none` + JS 暂停 | 否 |

> 素材就绪后，验收必须把上表逐项切到「已具备」路径并删除白名单（`05-acceptance.md` C12/D4）。

---

## 10. 风险与回滚

| 风险 | 触发信号 | 缓解 |
|---|---|---|
| 玻璃上白字对比度不足 | C4 实测 <4.5:1 | 只调 `--hero-glass-veil-*` 与 `.hero-scrim` 底部不透明度（§4.3），不动色板 |
| 1440 下玻璃卡压住少女 | C2 截图主体被遮 | 卡片 `max-width:640px`；必要时右列改 `0.85fr`（仍满足左 55%~60%） |
| 375 裁掉主体 | 截图人物只剩半边 | 等 9:16 素材；过渡期用 `object-position:70% 38%` 并记 WARN |
| 视频体积大导致播放启动慢 | 首帧出现晚于 2 s | 只 `preload="metadata"`；素材侧按 `03-qwen-video.md` §6.2 压到 5~6 Mbps |
| Safari 低电量不自动播放 | 只有 poster | 设计上接受（`03-qwen-video.md` §6.2）；不算缺陷 |
| 多个 `@theme inline` 块 | build 报 CSS 错误 | 改为并入现有块（保留原四行） |
| 误改禁止文件 | `git status` 出现 `lib/`、`app/api/`、`.env.local`、`package.json` | 立即 `git restore`；S6.5 用 `git diff --stat` 复核 |
| 路由从静态变动态 | build 输出 `/` 不再是 ○ Static | 检查 Hero 是否引入 `cookies()/headers()/searchParams`，移除 |

---

## 11. 验收命令速查（Windows PowerShell）

```powershell
# 构建 / 类型 / lint
npm run build
npx tsc --noEmit
npm run lint

# 本地预览（另开窗口）
npm run dev

# 三档截图 + 溢出/h1/alt/视频状态/CLS/reduced-motion/LCP（脚本已存在）
node scripts/shoot.mjs http://127.0.0.1:3000

# 抽查旧主题残留与弃用属性
Select-String -Path components\landing\*.tsx, app\globals.css -Pattern 'f6e7cd','priority','aspect-\[4/3\]'

# 确认没碰禁止文件
git status --porcelain
git diff --stat

# 单文件哈希留档（S6.1）
Get-FileHash app/globals.css, components/landing/Hero.tsx, components/landing/HeroVideo.tsx -Algorithm SHA256
```

> `scripts/shoot.mjs` 的 `CHECK/CLS/REDUCED-MOTION/LCP-4G` 输出可直接用于 C 组；但它的 `CONTRAST` 段仍是旧主题公式（取 `/hero/poster.jpg` + 炭色 `#18181b` + 旧 scrim），**S6 后该行数值无效**。要么在实现阶段按 `05-acceptance.md` C4 用手工/Node 公式补测并记录，要么由 Lead 批准后单独改脚本（不在本阶段默认范围内）。

---

## 12. 源映射

| 本文件章节 | 来源 |
|---|---|
| §0 | `AGENTS.md`；`node_modules/next/dist/docs/`（6 篇，见 §0 表）；本机 build 输出（2026-10-20） |
| §1 | `app/page.tsx`、`components/landing/Hero.tsx`、`HeroVideo.tsx`、`app/globals.css`、`public/hero/`、`public/art/` 实读 |
| §2 | 源方案 §1.4/§1.5/§2.2/§2.3 + `03-qwen-video.md` §6.1–§6.2（剪辑与导出）+ `02-qwen-images.md` + `01-visual-bible.md` |
| §3 | 源方案 §1.2（45–54）、§2.3（103–151）；`01-visual-bible.md` §3 |
| §4 | 源方案 §1.4（62–67）、§2.3（103–151）；`01-visual-bible.md` §5.6 |
| §5 | 源方案 §2.2（90–101）、§2.3（142–148）、§3 注（171）；`03-qwen-video.md` §7.3（前端交接） |
| §6 | `app/page.tsx` 现有文案、`plan.md` §1/§3/§7/§8、`Prompt/hero-landing-prompt.md` §2（只取文案约束，不取其旧主题） |
| §7 | 源 §2.1（84–88）、`03-qwen-video.md` §6.2、`plan.md` §7/§13、`Prompt/hero-landing-prompt.md` §10/§11（性能/验收口径） |
| §8–§9 | 源 §2.1/§2.2 + `03-qwen-video.md` §6.1–§6.2 + 本仓库工程约束 |
| §10–§11 | `03-qwen-video.md` §8.1–§8.2（失败处理与成本控制）+ Next 16 注意项 |
