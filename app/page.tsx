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

function HowItWorks() {
  return (
    <section id="how" className="border-t border-zinc-200/70 bg-[#faf7f0]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[0.9fr_1.1fr] md:py-24">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl ring-1 ring-zinc-900/10">
          <Image
            src="/art/person.jpg"
            alt="动画风格插画：黑发少年在紫色波斯菊花脊尽头侧身回头，逆光勾出金色轮廓"
            fill
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            三步，把经历改成 HR 想看的样子
          </h2>
          <ol className="mt-8 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7b61ff] text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-zinc-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{s.desc}</p>
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
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">改写前后，一眼看清</h2>
          <span className="rounded-full bg-zinc-900/5 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-900/10">
            示例
          </span>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          下面是一段运营经历在粘贴 JD 前后的对照，内容为示例数据。
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-zinc-50 p-6 ring-1 ring-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-500">改写前 · 你的原文</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700">
              {BEFORE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#f4f0ff] p-6 ring-1 ring-[#7b61ff]/25">
            <h3 className="text-sm font-semibold text-[#5b46d4]">改写后 · 对照 JD 关键词</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-800">
              {AFTER.map((parts, i) => (
                <li key={i}>
                  {parts.map((part, j) =>
                    j % 2 === 1 ? (
                      <mark key={j} className="rounded bg-[#f6c48a]/45 px-0.5 text-inherit">
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
    <section className="border-t border-zinc-200/70 bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">从容，不用焦虑。</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base">
            改简历是件耗神的事。匹配关键词、补量化口径、调排版这些枯燥的活交给
            AI，你把力气留给面试本身。
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
            逐段改写、随时重来，节奏始终在你手里。
          </p>
        </div>
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl ring-1 ring-zinc-900/10">
          <Image
            src="/art/cat.jpg"
            alt="动画风格插画：虎斑小猫躺在洒满树影光斑的木栈道上，抬爪够向彩虹色肥皂泡"
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
    <section id="features" className="border-t border-zinc-200/70 bg-[#faf7f0]">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">
          该做的，都做了
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
              <h3 className="font-semibold text-zinc-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-t border-zinc-200/70 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <h2 className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">价格</h2>
        <p className="mt-3 text-center text-sm text-zinc-600">一次购买，不含自动续费。</p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
            <h3 className="font-semibold text-zinc-900">免费</h3>
            <p className="mt-2 text-3xl font-bold text-zinc-900">¥0</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>1 份简历</li>
              <li>2 次 AI 改写</li>
              <li>2 次 PDF 导出</li>
            </ul>
            <Link
              href="/editor"
              className="mt-6 block rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              免费开始
            </Link>
          </div>
          <div className="relative rounded-2xl bg-zinc-900 p-6 text-white ring-1 ring-zinc-900">
            <span className="absolute right-4 top-4 rounded-full bg-[#7b61ff] px-2 py-0.5 text-xs font-semibold">
              推荐
            </span>
            <h3 className="font-semibold">30 天通行证</h3>
            <p className="mt-2 text-3xl font-bold">
              ¥19<span className="text-sm font-normal text-zinc-400"> / 30 天</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li>简历数量不限</li>
              <li>AI 改写不限次数</li>
              <li>PDF 导出不限次数</li>
              <li>不自动续费，到期自动降回免费</li>
            </ul>
            <Link
              href="/editor"
              className="mt-6 block rounded-lg bg-[#7b61ff] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#6a50ee]"
            >
              购买通行证
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-zinc-500">
          通行证为单次购买：不自动续费、不自动扣款；到期降为免费额度，已写内容保留。
        </p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-zinc-200/70 bg-[#faf7f0]">
      <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <h2 className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl">常见问题</h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl bg-white p-5 ring-1 ring-zinc-200">
              <summary className="cursor-pointer list-none font-semibold text-zinc-900">
                {f.q}
                <span
                  aria-hidden
                  className="float-right text-zinc-400 transition group-open:rotate-45"
                >
                  ＋
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative overflow-hidden">
      <Image
        src="/art/sky.jpg"
        alt="动画风格插画：一只手把四叶草举向云海、彩虹与初升的太阳"
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-slate-900/60" />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:py-32">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">你只管去面试。</h2>
        <p className="mt-4 text-sm text-zinc-100 sm:text-base">
          关键词、量化、排版——都已经在你导出的 PDF 里了。
        </p>
        <Link
          href="/editor"
          className="mt-8 rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          免费开始制作
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-center text-xs leading-relaxed text-zinc-500">
        <p className="text-sm font-semibold text-zinc-700">AI 简历编辑器 · 为中文求职者制作</p>
        <p>ICP 备案号：预留位 · 公安备案号：预留位</p>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
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
    <main className="bg-white text-zinc-900">
      <Hero />
      <HowItWorks />
      <BeforeAfter />
      <EaseBand />
      <Features />
      <Pricing />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  );
}
