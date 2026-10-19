import Image from "next/image";
import Link from "next/link";
import HeroVideo from "./HeroVideo";

const NAV = [
  { href: "#how", label: "怎么用" },
  { href: "#features", label: "能力" },
  { href: "#pricing", label: "价格" },
  { href: "#faq", label: "常见问题" },
];

/* 版式参照 design/UI_ref.png：居中胶囊导航、徽章、超大居中两行标题、双 CTA、底部 SCROLL。
   <1024px 视频/海报收进底部 4:3 横幅（保证少年与猫同框），上部暖空渐变承字。 */
export default function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden bg-gradient-to-b from-[#f6e7cd] via-[#f3ecdf] to-[#efe6d6]">
      <div className="absolute inset-x-0 bottom-0 aspect-[4/3] lg:inset-0 lg:aspect-auto">
        <Image
          src="/hero/poster.jpg"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <HeroVideo />

      {/* 中心柔光：文字区 α≥0.55，保证炭色文字压在深色衣装上对比度仍 ≥4.5:1 */}
      <div
        aria-hidden
        className="absolute inset-0 [background:radial-gradient(ellipse_75%_65%_at_50%_45%,rgba(255,252,244,0.86),rgba(255,252,244,0.55)_45%,rgba(255,252,244,0)_78%)]"
      />

      <header className="ld-rise absolute inset-x-0 top-5 z-20 flex justify-center px-4">
        <nav className="flex items-center gap-1 rounded-full bg-white/85 py-1.5 pl-4 pr-1.5 shadow-lg shadow-zinc-900/5 ring-1 ring-zinc-900/10 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 pr-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7b61ff] text-[10px] font-bold text-white">
              简
            </span>
            <span className="text-sm font-bold tracking-tight text-zinc-900">AI 简历编辑器</span>
          </Link>
          <div className="hidden items-center md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-full px-3 py-1.5 text-sm text-zinc-600 transition hover:text-zinc-900"
              >
                {n.label}
              </a>
            ))}
          </div>
          <Link
            href="/sign-in"
            className="ml-1 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            登录
          </Link>
        </nav>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[calc(75vw+1.5rem)] pt-24 text-center lg:pb-28 lg:pt-28">
        <span
          className="ld-rise rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-900/10 backdrop-blur"
          style={{ animationDelay: "0.1s" }}
        >
          AI 按 JD 逐段改写
        </span>

        <h1 className="mt-6 text-5xl font-bold leading-[1.12] tracking-tight text-zinc-900 sm:text-7xl">
          <span className="ld-line">
            <span style={{ animationDelay: "0.18s" }}>求职，</span>
          </span>
          <span className="ld-line">
            <span style={{ animationDelay: "0.26s" }}>从容一点。</span>
          </span>
        </h1>

        <p
          className="ld-rise mt-6 max-w-xl text-base leading-relaxed text-zinc-800 sm:text-lg"
          style={{ animationDelay: "0.42s" }}
        >
          粘贴目标 JD，AI 按关键词把你的经历改写成 HR 想看的量化表达；
          <br className="hidden sm:block" />
          排版、导出，一次做完。
        </p>

        <div
          className="ld-rise mt-9 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.52s" }}
        >
          <Link
            href="/editor"
            className="rounded-full bg-zinc-900 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/20 transition hover:-translate-y-0.5 hover:bg-zinc-800"
          >
            免费开始制作
          </Link>
          <a
            href="#how"
            className="rounded-full px-5 py-3 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-900/15 transition hover:bg-white/60"
          >
            看看怎么用
          </a>
        </div>
      </div>

      <div
        className="ld-rise absolute inset-x-0 bottom-6 z-10 flex justify-center"
        style={{ animationDelay: "1s" }}
      >
        <a
          href="#how"
          className="ld-breathe rounded-full bg-white/70 px-5 py-2 text-[10px] font-semibold tracking-[0.25em] text-zinc-800 backdrop-blur transition hover:bg-white/90"
        >
          SCROLL ↓
        </a>
      </div>
    </section>
  );
}
