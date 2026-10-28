import Image from "next/image";
import Link from "next/link";
import HeroVideo from "./HeroVideo";
import { BrandMark } from "@/components/brand/BrandMark";

const NAV = [
  { href: "#how", label: "怎么用" },
  { href: "#features", label: "能力" },
  { href: "#pricing", label: "价格" },
  { href: "#faq", label: "常见问题" },
];

/* 新版式（docs/hero-visual/04-frontend-integration.md §4）：
   全幅视频 + scrim，桌面 ≥1024px 左玻璃卡片（≤640px）/ 右主体区 60/40 网格；
   <1024px 单列卡片靠下，16:9 源用 object-position:70% 38% 保住右 1/3 主体（见 globals.css）。
   文案逐字沿用旧版（plan.md 产品事实），颜色一律走 --hero-* token。 */
export default function Hero() {
  return (
    <section className="hero-surface relative flex min-h-svh flex-col overflow-hidden">
      {/* 1) poster 兜底层：先绘制，LCP 候选；视频未就绪/缺失/reduced-motion 时兜底。
          桌面用成片抽帧 16:9；移动端用 9:16 竖版封面（I6），避免横屏裁掉主体 */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src="/hero/poster.jpg"
          alt=""
          fill
          unoptimized
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="hero-media hidden lg:block"
        />
        <Image
          src="/hero/mobile-cover.jpg"
          alt=""
          fill
          unoptimized
          loading="eager"
          sizes="100vw"
          className="hero-media lg:hidden"
          style={{ objectPosition: "50% 50%" }}
        />
      </div>

      {/* 2) 视频（client 组件，absolute 铺满） */}
      <HeroVideo />

      {/* 3) 压字遮罩：暖光 + 底部渐深，服务白字 */}
      <div aria-hidden className="hero-scrim" />

      {/* 4) 顶部胶囊导航：细、轻、半透明，弱化存在感，把注意力留给大标题 */}
      <header className="ld-rise absolute inset-x-0 top-4 z-20 flex justify-center px-4">
        <nav className="flex w-full max-w-[820px] items-center rounded-full border border-white/40 bg-white/30 p-1.5 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_30px_rgba(6,20,40,0.10)] backdrop-blur-xl backdrop-saturate-125">
          <Link href="/" className="flex shrink-0 items-center gap-2 pr-3">
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[#0E1B2A] text-white shadow-[0_4px_12px_rgba(14,27,42,0.28)]">
              <BrandMark size={14} />
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-[#0E1B2A]">
              AI 简历编辑器
            </span>
          </Link>
          <div className="hidden flex-1 items-stretch justify-evenly md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="flex flex-1 items-center justify-center rounded-full px-2 py-1.5 text-[13px] text-[#0E1B2A]/75 transition hover:bg-white/40 hover:text-[#0E1B2A]"
              >
                {n.label}
              </a>
            ))}
          </div>
          <Link
            href="/dashboard"
            className="ml-auto shrink-0 rounded-full bg-[#0E1B2A]/85 px-4 py-1.5 text-[13px] font-medium text-white/95 transition hover:bg-[#0E1B2A]"
          >
            进入工作台
          </Link>
        </nav>
      </header>

      {/* 5) 内容区：<1024 单列靠下，≥1024 左卡右主体 */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 items-end px-4 pb-16 pt-24 sm:items-center lg:px-8 lg:py-24">
        <div className="grid w-full min-w-0 grid-cols-1 items-end gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center lg:gap-12">
          <article className="hero-glass hero-card min-w-0">
            <div className="hero-card-top">
              <span className="hero-badge">
                <span aria-hidden className="hero-badge-dot" />
                AI 按 JD 逐段改写
              </span>
            </div>

            <div className="hero-card-center">
              <h1 className="hero-title">
                <span className="ld-line hero-kicker">
                  <span style={{ animationDelay: "0.16s" }}>求职这件事</span>
                </span>
                <span className="ld-line hero-display">
                  <span style={{ animationDelay: "0.24s" }}>从容一点</span>
                </span>
              </h1>
              <div className="hero-rule" aria-hidden />
            </div>

            <div className="hero-card-actions">
              <Link href="/editor" className="hero-cta-primary">
                免费开始做简历
              </Link>
              <a href="#how" className="hero-cta-ghost">
                看看怎么用
              </a>
            </div>
          </article>

          {/* 右列：留给画面里的主体，不放内容 */}
          <div aria-hidden className="hidden min-w-0 lg:block" />
        </div>
      </div>

      {/* 6) SCROLL：仅桌面显示，避免与底部卡片重叠 */}
      <div className="ld-rise absolute inset-x-0 bottom-6 z-10 hidden justify-center lg:flex">
        <a
          href="#how"
          className="ld-breathe rounded-full bg-white/70 px-5 py-2 text-[10px] font-semibold tracking-[0.25em] text-hero-ink backdrop-blur transition hover:bg-white/90"
        >
          SCROLL ↓
        </a>
      </div>
    </section>
  );
}
