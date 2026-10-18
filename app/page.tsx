import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          AI 简历编辑器
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/sign-in" className="font-medium text-zinc-600 hover:text-zinc-900">
            登录
          </Link>
          <Link
            href="/editor"
            className="rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white transition hover:bg-zinc-700"
          >
            免费开始
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:py-28">
      <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
        粘贴职位描述，让 AI 把简历改写进
        <span className="text-blue-600"> 面试官的筛选线</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
        填好你的经历，一键针对目标 JD 生成带关键词与量化成果的版本，再导出成排版干净的 PDF。
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/editor"
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
        >
          免费开始制作
        </Link>
        <Link
          href="#pricing"
          className="rounded-lg border border-zinc-300 px-6 py-3 text-base font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          查看价格
        </Link>
      </div>
      <p className="mt-4 text-sm text-zinc-400">无需登录即可开始，导出时才需要账号</p>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", title: "填简历", desc: "联系方式、总结、经历、教育、技能 + 照片，5 类固定字段。" },
    { n: "2", title: "粘贴 JD", desc: "把目标职位描述贴进来，对每段经历点「AI 改写」。" },
    { n: "3", title: "导出 PDF", desc: "一键生成 A4 排版干净的 PDF，直接投递。" },
  ];
  return (
    <section className="border-t border-zinc-100 bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">三步搞定</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      title: "针对 JD 的关键词 + 量化改写",
      desc: "把「负责过运营工作」改写成「主导年度活动，带来 40% 转化提升」，匹配招聘方筛词。",
    },
    {
      title: "干净的 A4 简历模板",
      desc: "一个专业、可读性强的模板，照片与字段排布整洁，HR 一眼扫到重点。",
    },
    {
      title: "逐段改写，可控可重来",
      desc: "每段经历单独改写，不满意就点「重新生成」，不会整份推翻。",
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">为什么用它</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {items.map((f) => (
          <div key={f.title} className="rounded-xl p-6 ring-1 ring-zinc-200">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-t border-zinc-100 bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">价格</h2>
        <div className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-6 ring-1 ring-zinc-200">
            <h3 className="font-semibold">免费</h3>
            <p className="mt-2 text-3xl font-bold">¥0</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>1 份简历</li>
              <li>2 次 AI 改写</li>
              <li>2 次 PDF 下载</li>
            </ul>
            <Link
              href="/editor"
              className="mt-6 block rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              免费开始
            </Link>
          </div>
          <div className="relative rounded-xl bg-zinc-900 p-6 text-white ring-1 ring-zinc-900">
            <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold">
              推荐
            </span>
            <h3 className="font-semibold">付费版</h3>
            <p className="mt-2 text-3xl font-bold">
              ¥19<span className="text-sm font-normal text-zinc-400">/月</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-300">
              <li>简历数量不限</li>
              <li>AI 改写不限次数</li>
              <li>PDF 下载不限次数</li>
              <li>随时取消</li>
            </ul>
            <Link
              href="/editor"
              className="mt-6 block rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              升级付费版
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-zinc-400">
        AI 简历编辑器 · 中文简历制作与 JD 智能改写
      </div>
    </footer>
  );
}
