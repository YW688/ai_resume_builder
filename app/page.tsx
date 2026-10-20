import Image from "next/image";
import Link from "next/link";
import Hero from "../components/landing/Hero";

const STEPS = [
  {
    title: "填简历",
    desc: "联系方式、总结、经历、教育、技能五类字段，需要的话加一张照片。",
  },
  {
    title: "粘贴 JD",
    desc: "把目标职位描述整段贴进来，AI 提取其中的关键词与可量化点。",
  },
  {
    title: "逐段改写",
    desc: "每段经历对照关键词改写成量化表达，不满意就重新生成，不会整份推翻。",
  },
];

const BEFORE = [
  "负责公司社交账号运营，定期发布内容。",
  "参与策划线下活动，活动效果良好。",
];

const AFTER = [
  [
    "运营",
    "公众号与小红书 2 个账号",
    "，6 个月发布 ",
    "48 篇笔记",
    "，其中 ",
    "12 篇阅读破万",
    "，粉丝从 ",
    "3 千增长至 1.8 万",
    "。",
  ],
  [
    "主导策划 ",
    "3 场线下拉新活动",
    "，负责流程设计与现场执行，累计到场 ",
    "600+ 人",
    "，新用户转化率 ",
    "22%",
    "。",
  ],
];

const CAPABILITIES = [
  {
    title: "关键词匹配",
    desc: "从 JD 里提取工具名、行业术语等硬要求，逐条落到对应经历段落。",
  },
  {
    title: "量化表达",
    desc: "把「效果良好」改成有数量、有增幅、有转化率的可用口径。",
  },
  {
    title: "A4 导出",
    desc: "服务端排版生成页边距干净的 A4 PDF，导出即可投递。",
  },
  {
    title: "境内存储",
    desc: "简历与照片存于境内数据中心，不跨境传输。",
  },
  {
    title: "注销即删",
    desc: "注销账号时全部数据级联删除，不留残留。",
  },
];

const FAQS = [
  {
    q: "AI 改写会不会被判定为造假？",
    a: "AI 只对你填写的真实经历做组织与润色：补量化口径、对齐 JD 关键词，不会编造没有做过的事或学历。导出前请逐条确认，简历内容的真实性由你本人负责。",
  },
  {
    q: "我的简历和照片存在哪里？",
    a: "全部存于中国大陆境内数据中心，仅用于简历排版与导出。照片属于敏感个人信息，上传前需要你的单独同意；注销账号时随其余数据一并删除。",
  },
  {
    q: "能不能换模板？",
    a: "当前版本提供一套干净的 A4 模板，重点打磨内容与排版；更多模板在后续版本的计划中。",
  },
  {
    q: "通行证到期怎么办？",
    a: "到期自动降回免费额度（1 份简历、2 次改写、2 次导出），不自动扣款；已经写好的简历内容保留，可以继续查看与编辑。",
  },
];

/* ---------- 通用小组件 ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#1A6BD6]/20 bg-white/70 px-3.5 py-1 text-xs font-semibold text-[#1A6BD6] shadow-sm backdrop-blur">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E5355B]" />
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  desc,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#0E1B2A] sm:text-[2.5rem]">
        {title}
      </h2>
      {desc ? (
        <p className="mt-4 text-sm leading-relaxed text-[#0E1B2A]/65 sm:text-base">{desc}</p>
      ) : null}
    </div>
  );
}

function SoftGlow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
    />
  );
}

/* ---------- 各区块 ---------- */

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-[#F4F8FC]">
      <SoftGlow className="-left-24 top-10 h-72 w-72 bg-[#1A6BD6]/10" />
      <SoftGlow className="-right-20 bottom-0 h-64 w-64 bg-[#E5355B]/10" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[1.02fr_0.98fr] md:py-28">
        <div className="relative">
          <div className="absolute -left-5 -top-5 hidden h-20 w-20 rounded-full border border-[#C9D2D9] bg-gradient-to-br from-white to-[#C9D2D9]/60 shadow-lg sm:block" />
          <div className="absolute -right-4 -bottom-6 hidden h-14 w-14 rounded-full bg-[#E5355B]/80 blur-[1px] sm:block" />
          <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] border border-white/70 bg-white/40 p-2 shadow-[0_24px_60px_rgba(6,20,40,0.14)] backdrop-blur">
            <div className="relative h-full w-full overflow-hidden rounded-[22px]">
              <Image
                src="/art/feature-parse-3.jpg"
                alt="动画风格插画：短发少女伸手触碰悬浮的半透明玻璃简历卡片，逆光与粉色光点"
                fill
                sizes="(max-width: 768px) 100vw, 48vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
        <div>
          <SectionTitle
            eyebrow="三步完成"
            title="把经历，改成 HR 想看的样子"
            desc="不重写整份简历，只改需要改的那一段；每一步都由你确认，改不动就重来。"
          />
          <ol className="mt-9 space-y-5">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="glass-panel group flex gap-4 p-4 transition hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A6BD6] to-[#0E1B2A] text-sm font-bold text-white shadow-md">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[#0E1B2A]">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#0E1B2A]/65">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#F4F8FC]">
      <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-[#0E1B2A] sm:text-3xl">
            改写前后，一眼看清
          </h2>
          <span className="rounded-full border border-[#1A6BD6]/20 bg-[#1A6BD6]/5 px-2.5 py-0.5 text-xs font-medium text-[#1A6BD6]">
            示例
          </span>
        </div>
        <p className="mt-3 text-sm text-[#0E1B2A]/60">
          下面是一段运营经历在粘贴 JD 前后的对照，内容为示例数据。
        </p>
        <div className="mt-9 grid gap-6 md:grid-cols-2">
          <div className="glass-panel rounded-[28px] p-7">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0E1B2A]/45">
              改写前 · 你的原文
            </h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[#0E1B2A]/75">
              {BEFORE.map((line) => (
                <li key={line} className="border-l-2 border-[#C9D2D9] pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-panel relative overflow-hidden rounded-[28px] p-7">
            <SoftGlow className="-right-10 -top-10 h-40 w-40 bg-[#E5355B]/15" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1A6BD6]">
              改写后 · 对照 JD 关键词
            </h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[#0E1B2A]/85">
              {AFTER.map((parts, i) => (
                <li key={i} className="border-l-2 border-[#1A6BD6]/50 pl-3">
                  {parts.map((part, j) =>
                    j % 2 === 1 ? (
                      <mark
                        key={j}
                        className="rounded bg-[#FFE9B0]/70 px-0.5 text-inherit ring-1 ring-[#FFE9B0]"
                      >
                        {part}
                      </mark>
                    ) : (
                      <span key={j}>{part}</span>
                    ),
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function EaseBand() {
  return (
    <section className="relative overflow-hidden bg-[#0E1B2A]">
      <Image
        src="/art/feature-templates.jpg"
        alt="动画风格插画：三块悬浮的半透明玻璃简历面板，铬色边框与粉色光球点缀"
        fill
        sizes="100vw"
        className="object-cover opacity-45"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0E1B2A] via-[#0E1B2A]/85 to-[#0E1B2A]/30"
      />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-[#F4F8FC] backdrop-blur">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E5355B]" />
            从容，不用焦虑
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#F4F8FC] sm:text-[2.5rem]">
            排版的事，
            <br className="hidden sm:block" />
            交给 AI
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#F4F8FC]/70 sm:text-base">
            改简历是件耗神的事。匹配关键词、补量化口径、调排版这些枯燥的活交给 AI，
            你把力气留给面试本身。逐段改写、随时重来，节奏始终在你手里。
          </p>
          <Link
            href="/editor"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E5355B] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(229,53,91,0.35)] transition hover:-translate-y-0.5 hover:bg-[#D01E48]"
          >
            免费开始制作
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <Image
            src="/art/feature-templates.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-[#F4F8FC]">
      <SoftGlow className="left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 bg-[#1A6BD6]/10" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <SectionTitle
          align="center"
          eyebrow="能力"
          title="该做的，都做了"
          desc="从改写到导出，一条链路做完；不堆功能，只把每一步做扎实。"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="glass-panel group relative overflow-hidden rounded-[24px] p-6 transition hover:-translate-y-1"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1A6BD6] via-[#C9D2D9] to-[#E5355B] opacity-70"
              />
              <h3 className="font-semibold text-[#0E1B2A]">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#0E1B2A]/65">{c.desc}</p>
            </div>
          ))}
          <div className="relative overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-br from-[#0E1B2A] to-[#123A63] p-6 shadow-[0_16px_40px_rgba(6,20,40,0.18)]">
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#F4F8FC]">你只管去面试</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#F4F8FC]/65">
                  关键词、量化、排版都已经在导出的 PDF 里。
                </p>
              </div>
              <Link
                href="/editor"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-[#F4F8FC] ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
              >
                开始制作 <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[0.85fr_1.15fr] md:py-28">
        <div className="relative order-2 md:order-1">
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-[#E5355B]/25 to-transparent blur-xl" />
          <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] border border-white/60 p-2 shadow-[0_24px_60px_rgba(6,20,40,0.16)]">
            <div className="relative h-full w-full overflow-hidden rounded-[22px]">
              <Image
                src="/art/about-portrait-2.jpg"
                alt="动画风格插画：短发少女抱着芥末黄滑板站在逆光里，暖金色云层铺在身后"
                fill
                sizes="(max-width: 768px) 100vw, 36vw"
                className="object-cover"
              />
            </div>
          </div>
          <span className="absolute -bottom-4 right-4 rounded-full border border-white/60 bg-white/80 px-4 py-1.5 text-xs font-semibold text-[#0E1B2A] shadow-lg backdrop-blur">
            为中文求职者而做
          </span>
        </div>
        <div className="order-1 md:order-2">
          <SectionTitle
            eyebrow="关于我们"
            title="一份简历，不该耗掉你的从容"
            desc="我们做的是国内求职者每天都在经历的同一件事：对着 JD 反复改简历。把它拆成「填、贴、改」三步，把重复劳动交给模型，把判断留给你。"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#0E1B2A]">不夸大</p>
              <p className="mt-1 text-xs leading-relaxed text-[#0E1B2A]/60">
                只改你写下的真实经历，不编造学历与项目。
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#0E1B2A]">数据在境内</p>
              <p className="mt-1 text-xs leading-relaxed text-[#0E1B2A]/60">
                简历与照片存于境内数据中心，注销即删。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="relative overflow-hidden bg-[#F4F8FC]">
      <SoftGlow className="right-0 top-10 h-64 w-64 bg-[#E5355B]/10" />
      <div className="relative mx-auto max-w-5xl px-4 py-20 md:py-28">
        <SectionTitle
          align="center"
          eyebrow="价格"
          title="一次购买，不含自动续费"
          desc="免费额度足够写完第一份简历；需要更多次数时，再买 30 天通行证。"
        />
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="glass-panel rounded-[28px] p-7">
            <h3 className="font-semibold text-[#0E1B2A]">免费</h3>
            <p className="mt-2 text-4xl font-bold tracking-tight text-[#0E1B2A]">¥0</p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#0E1B2A]/65">
              <li>1 份简历</li>
              <li>2 次 AI 改写</li>
              <li>2 次 PDF 导出</li>
            </ul>
            <Link
              href="/editor"
              className="mt-7 block rounded-full border border-[#0E1B2A]/15 px-4 py-2.5 text-center text-sm font-semibold text-[#0E1B2A] transition hover:bg-[#0E1B2A]/5"
            >
              免费开始
            </Link>
          </div>
          <div className="relative overflow-hidden rounded-[28px] bg-[#0E1B2A] p-7 text-white shadow-[0_24px_60px_rgba(6,20,40,0.28)]">
            <SoftGlow className="-right-8 -top-8 h-40 w-40 bg-[#E5355B]/30" />
            <span className="absolute right-5 top-5 rounded-full bg-[#E5355B] px-2.5 py-0.5 text-xs font-semibold text-white">
              推荐
            </span>
            <h3 className="font-semibold">30 天通行证</h3>
            <p className="mt-2 text-4xl font-bold tracking-tight">
              ¥19<span className="text-sm font-normal text-white/50"> / 30 天</span>
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-white/70">
              <li>简历数量不限</li>
              <li>AI 改写不限次数</li>
              <li>PDF 导出不限次数</li>
              <li>不自动续费，到期自动降回免费</li>
            </ul>
            <Link
              href="/editor"
              className="mt-7 block rounded-full bg-[#E5355B] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-[0_10px_30px_rgba(229,53,91,0.35)] transition hover:bg-[#D01E48]"
            >
              购买通行证
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-[#0E1B2A]/45">
          通行证为单次购买：不自动续费、不自动扣款；到期降为免费额度，已写内容保留。
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
        <SectionTitle align="center" eyebrow="常见问题" title="你可能想先问清楚" />
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="glass-panel group rounded-2xl p-5 transition"
            >
              <summary className="cursor-pointer list-none font-semibold text-[#0E1B2A]">
                {f.q}
                <span
                  aria-hidden
                  className="float-right text-[#1A6BD6] transition group-open:rotate-45"
                >
                  ＋
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#0E1B2A]/65">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-[#0E1B2A]">
      <Image
        src="/art/feature-future.jpg"
        alt="动画风格插画：少女站在坡顶望向发光的地平线，城市与海在金光里铺开"
        fill
        sizes="100vw"
        className="object-cover opacity-80"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#0E1B2A]/40 via-[#0E1B2A]/55 to-[#0E1B2A]/85"
      />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:py-32">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          你只管去面试
        </h2>
        <p className="mt-4 text-sm text-white/75 sm:text-base">
          关键词、量化、排版——都已经在你导出的 PDF 里了。
        </p>
        <Link
          href="/editor"
          className="mt-8 rounded-full bg-[#E5355B] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(229,53,91,0.45)] transition hover:-translate-y-0.5 hover:bg-[#D01E48]"
        >
          免费开始制作
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0E1B2A]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-9 text-center text-xs leading-relaxed text-white/45">
        <p className="text-sm font-semibold text-white/80">AI 简历编辑器 · 为中文求职者制作</p>
        <p>ICP 备案号：预留位 · 公安备案号：预留位</p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="underline-offset-2 hover:text-white/70 hover:underline">
            隐私政策
          </Link>
          <span>问题反馈：支持邮箱随官网上线公布</span>
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main className="bg-[linear-gradient(180deg,#F4F8FC_0%,#ECF3FB_38%,#F7F3F8_72%,#F4F8FC_100%)] text-[#0E1B2A]">
      <Hero />
      <HowItWorks />
      <BeforeAfter />
      <EaseBand />
      <Features />
      <About />
      <Pricing />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  );
}
