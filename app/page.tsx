import Image from "next/image";
import Link from "next/link";
import Hero from "../components/landing/Hero";
import {
  CREDIT_COST_ROWS,
  CREDIT_PACKAGES,
  DAILY_FREE_CREDITS,
  actionsPerPackage,
  formatPoints,
  formatYuan,
  packageDiscountPercent,
  pointsUnitPriceFen,
} from "@/lib/credits/catalog";

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
    title: "账号保存",
    desc: "简历与投递记录随账号保存，登录即可继续编辑。",
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
    a: "简历、目标岗位与投递记录保存在我们的托管数据库（Neon）中；照片当前只在你的浏览器本地预览，并随 PDF 导出临时处理，不会保存到服务器。数据存储区域、跨境传输与你的权利详见《隐私政策》；注销账号时账号数据会一并删除。",
  },
  {
    q: "能不能换模板？",
    a: "当前版本提供一套干净的 A4 模板，重点打磨内容与排版；更多模板在后续版本的计划中。",
  },
  {
    q: "点数是永久的吗？",
    a: "购买的点数在套餐有效期内可用：体验包 90 天、求职包 180 天、冲刺包 365 天，过期未用完会失效。所有套餐都是一次性购买，不自动续费、不会自动扣款；已经写好的简历内容始终保留，可以继续查看与编辑。",
  },
  {
    q: "每天免费额度怎么算？",
    a: `按北京时间自然日，每天 0 点赠送 ${DAILY_FREE_CREDITS} 点免费额度，不累积、不可转赠；AI 操作会先扣当日免费额度，用完后扣购买的点数。PDF 导出不扣点，也不限次数。`,
  },
];

/* ---------- 通用小组件 ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#1A6BD6]/20 bg-white/70 px-3.5 py-1 text-[13px] font-semibold text-[#1A6BD6] shadow-sm backdrop-blur">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-hero-pink" />
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
  eyebrow?: string;
  title: string;
  desc?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={`${eyebrow ? "mt-4" : ""} text-3xl font-bold leading-tight tracking-tight text-[#0E1B2A] sm:text-[2.5rem]`}
      >
        {title}
      </h2>
      {desc ? (
        <p className="mt-4 text-base leading-relaxed text-[#0E1B2A]/65">{desc}</p>
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
      <SoftGlow className="-right-20 bottom-0 h-64 w-64 bg-hero-pink/10" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-[1.02fr_0.98fr] md:py-28">
        <div className="relative">
          <div className="absolute -left-5 -top-5 hidden h-20 w-20 rounded-full border border-[#C9D2D9] bg-gradient-to-br from-white to-[#C9D2D9]/60 shadow-lg sm:block" />
          <div className="absolute -right-4 -bottom-6 hidden h-14 w-14 rounded-full bg-hero-pink/80 blur-[1px] sm:block" />
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
                  <p className="mt-1 text-base leading-relaxed text-[#0E1B2A]/65">{s.desc}</p>
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
          <span className="rounded-full border border-[#1A6BD6]/20 bg-[#1A6BD6]/5 px-2.5 py-0.5 text-[13px] font-medium text-[#1A6BD6]">
            示例
          </span>
        </div>
        <p className="mt-3 text-base text-[#0E1B2A]/60">
          下面是一段运营经历在粘贴 JD 前后的对照，内容为示例数据。
        </p>
        <div className="mt-9 grid gap-6 md:grid-cols-2">
          <div className="glass-panel rounded-[28px] p-7">
            <h3 className="text-[13px] font-semibold text-[#0E1B2A]/70">
              改写前 · 你的原文
            </h3>
            <ul className="mt-5 space-y-3 text-base leading-relaxed text-[#0E1B2A]/75">
              {BEFORE.map((line) => (
                <li key={line} className="border-l-2 border-[#C9D2D9] pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-panel relative overflow-hidden rounded-[28px] p-7">
            <SoftGlow className="-right-10 -top-10 h-40 w-40 bg-hero-pink/15" />
            <h3 className="text-[13px] font-semibold text-[#1A6BD6]">
              改写后 · 对照 JD 关键词
            </h3>
            <ul className="mt-5 space-y-3 text-base leading-relaxed text-[#0E1B2A]/85">
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
      <SoftGlow className="-left-24 top-0 h-80 w-80 bg-[#1A6BD6]/25" />
      <SoftGlow className="right-0 top-1/4 h-72 w-72 bg-hero-pink/20" />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[13px] font-semibold text-[#F4F8FC] backdrop-blur">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-hero-pink" />
            从容，不用焦虑
          </span>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#F4F8FC] sm:text-[2.5rem]">
            排版的事，
            <br className="hidden sm:block" />
            交给 AI
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[#F4F8FC]/70">
            改简历是件耗神的事。匹配关键词、补量化口径、调排版这些枯燥的活交给 AI，
            你把力气留给面试本身。逐段改写、随时重来，节奏始终在你手里。
          </p>
          <Link
            href="/editor"
            className="cta-primary mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(208,30,72,0.35)] transition hover:-translate-y-0.5"
          >
            免费开始制作
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <Image
            src="/art/feature-templates.jpg"
            alt="动画风格插画：三块悬浮的半透明玻璃简历面板，铬色边框与粉色光球点缀"
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
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1A6BD6] via-[#C9D2D9] to-hero-pink opacity-70"
              />
              <h3 className="font-semibold text-[#0E1B2A]">{c.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[#0E1B2A]/65">{c.desc}</p>
            </div>
          ))}
          <div className="relative overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-br from-[#0E1B2A] to-[#123A63] p-6 shadow-[0_16px_40px_rgba(6,20,40,0.18)]">
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#F4F8FC]">剩下的只有投递</h3>
                <p className="mt-2 text-base leading-relaxed text-[#F4F8FC]/65">
                  关键词、量化、排版都已经在导出的 PDF 里。
                </p>
              </div>
              <Link
                href="/editor"
                className="cta-primary inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-[0_10px_24px_rgba(208,30,72,0.35)] transition hover:-translate-y-0.5"
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
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-hero-pink/25 to-transparent blur-xl" />
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
          <span className="absolute -bottom-4 right-4 rounded-full border border-white/60 bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-[#0E1B2A] shadow-lg backdrop-blur">
            为中文求职者而做
          </span>
        </div>
        <div className="order-1 md:order-2">
          <SectionTitle
            title="一份简历，不该耗掉你的从容"
            desc="我们做的是国内求职者每天都在经历的同一件事：对着 JD 反复改简历。把它拆成「填、贴、改」三步，把重复劳动交给模型，把判断留给你。"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#0E1B2A]">不夸大</p>
              <p className="mt-1 text-sm leading-relaxed text-[#0E1B2A]/60">
                只改你写下的真实经历，不编造学历与项目。
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#0E1B2A]">账号保存</p>
              <p className="mt-1 text-sm leading-relaxed text-[#0E1B2A]/60">
                简历与投递记录随账号保存，注销即删。
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
      <SoftGlow className="right-0 top-10 h-64 w-64 bg-hero-pink/10" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <SectionTitle
          align="center"
          eyebrow="价格"
          title="按点付费，不自动续费"
          desc={`每天赠送 ${DAILY_FREE_CREDITS} 点免费额度；AI 操作按点扣除，PDF 导出始终免费。点数一次性购买，用完再买。`}
        />
        <div className="mt-12 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* 免费额度 */}
          <div className="glass-panel flex flex-col rounded-[24px] p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-[#0E1B2A]">免费</h3>
              <span className="rounded-full border border-[#1A6BD6]/20 bg-[#1A6BD6]/5 px-2.5 py-0.5 text-[12px] font-medium text-[#1A6BD6]">
                每天刷新
              </span>
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight text-[#0E1B2A]">
              ¥0
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#0E1B2A]/60">
              每天 {DAILY_FREE_CREDITS} 点免费额度
            </p>
            <ul className="mt-5 flex-1 space-y-2.5 text-base text-[#0E1B2A]/65">
              <li>北京时间 0 点重置，不累积</li>
              <li>整份生成 2 点 / 单段润色 1 点</li>
              <li>PDF 导出不扣点</li>
            </ul>
            <Link
              href="/editor"
              className="cta-secondary mt-7 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition"
            >
              免费开始
            </Link>
          </div>

          {/* 三档点数套餐 */}
          {CREDIT_PACKAGES.map((pkg) => {
            const recommended = Boolean(pkg.recommended);
            const discount = packageDiscountPercent(pkg);
            const perResume = actionsPerPackage(pkg, "resume_generate");
            const badge =
              pkg.badge ?? (discount > 0 ? `省 ${discount}%` : undefined);

            return (
              <div
                key={pkg.id}
                className={
                  recommended
                    ? "relative flex flex-col overflow-hidden rounded-[24px] bg-[#0E1B2A] p-6 text-white shadow-[0_24px_60px_rgba(6,20,40,0.28)]"
                    : "glass-panel flex flex-col rounded-[24px] p-6"
                }
              >
                {recommended ? (
                  <SoftGlow className="-right-8 -top-10 h-40 w-40 bg-hero-pink/25" />
                ) : null}
                <div className="relative flex items-center justify-between gap-2">
                  <h3
                    className={
                      recommended
                        ? "font-semibold"
                        : "font-semibold text-[#0E1B2A]"
                    }
                  >
                    {pkg.name}
                  </h3>
                  {badge ? (
                    <span
                      className={
                        recommended
                          ? "rounded-full bg-hero-pink-cta px-2.5 py-0.5 text-[12px] font-semibold text-white"
                          : "rounded-full border border-[#1A6BD6]/20 bg-[#1A6BD6]/5 px-2.5 py-0.5 text-[12px] font-medium text-[#1A6BD6]"
                      }
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p
                  className={`relative mt-2 text-4xl font-bold tracking-tight ${recommended ? "" : "text-[#0E1B2A]"}`}
                >
                  {formatYuan(pkg.priceFen)}
                  <span
                    className={`ml-1.5 text-sm font-normal ${recommended ? "text-white/55" : "text-[#0E1B2A]/50"}`}
                  >
                    / {formatPoints(pkg.points)}
                  </span>
                </p>
                <p
                  className={`relative mt-1 text-[13px] font-medium ${recommended ? "text-white/70" : "text-[#0E1B2A]/60"}`}
                >
                  折合 {formatYuan(pointsUnitPriceFen(pkg))}/点
                  {discount > 0 ? ` · 比体验包省 ${discount}%` : " · 单点价格基准"}
                </p>
                <ul
                  className={`relative mt-5 flex-1 space-y-2.5 text-base ${recommended ? "text-white/70" : "text-[#0E1B2A]/65"}`}
                >
                  <li>约 {perResume} 份整份简历生成</li>
                  <li>{pkg.validityDays} 天有效</li>
                  <li>一次性购买，不自动续费</li>
                  <li>PDF 导出不扣点</li>
                </ul>
                <Link
                  href="/editor"
                  className={
                    recommended
                      ? "cta-primary relative mt-7 block rounded-full px-4 py-2.5 text-center text-sm font-semibold shadow-[0_10px_30px_rgba(208,30,72,0.35)] transition"
                      : "cta-secondary relative mt-7 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition"
                  }
                >
                  购买{pkg.name}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-[13px] leading-relaxed text-[#0E1B2A]/65">
          点数消耗：
          {CREDIT_COST_ROWS.filter((row) => row.cost > 0)
            .map((row) => `${row.label} ${row.cost} 点`)
            .join(" · ")}
          ；PDF 导出免费。所有套餐均为一次性购买，不自动续费、不自动扣款；
          当前为产品演示环境，付款为沙箱模拟，不产生真实扣款。
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 md:py-28">
        <SectionTitle align="center" title="你可能想先问清楚" />
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
              <p className="mt-3 text-base leading-relaxed text-[#0E1B2A]/65">{f.a}</p>
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
        <p className="mt-4 text-base text-white/75">
          关键词、量化、排版，都已经在你导出的 PDF 里了。
        </p>
        <Link
          href="/editor"
          className="cta-primary mt-8 rounded-full px-7 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(208,30,72,0.45)] transition hover:-translate-y-0.5"
        >
          免费开始制作
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0B1626]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-9 text-center text-[13px] leading-relaxed text-white/70">
        <p className="text-sm font-semibold text-white/80">AI 简历编辑器 · 为中文求职者制作</p>
        <p>ICP 备案号：预留位 · 公安备案号：预留位</p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/terms" className="underline-offset-2 hover:text-white hover:underline">
            服务条款
          </Link>
          <Link href="/privacy" className="underline-offset-2 hover:text-white hover:underline">
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
