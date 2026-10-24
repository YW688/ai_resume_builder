import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隐私政策 — AI 简历编辑器",
  description: "我们收集什么、存到哪里、保存多久、如何删除。",
};

const SECTIONS = [
  {
    title: "我们收集什么",
    body: "账号邮箱与密码哈希；你填写的简历内容（联系方式、总结、经历、教育、技能）；你主动上传的照片；订单与点数有效期、点数流水记录。",
  },
  {
    title: "存到哪里",
    body: "全部数据存于中国大陆境内数据中心，不跨境传输。",
  },
  {
    title: "用来做什么",
    body: "仅用于简历排版、AI 改写、PDF 导出与订单核销；不用于广告画像，不出售、不共享给第三方。支付时仅向持牌支付平台提供订单号与金额。",
  },
  {
    title: "关于照片",
    body: "照片属于敏感个人信息，上传前需要你的单独同意；照片存于私有对象存储，仅在导出排版时临时读取。",
  },
  {
    title: "关于 AI 改写",
    body: "改写时仅把当段经历与目标 JD 文本发送给境内模型服务，不附带联系方式与照片。",
  },
  {
    title: "保存多久、如何删除",
    body: "账号存续期间保存。注销账号时级联删除全部简历、照片与账号数据；交易记录依《电子商务法》的要求另行留存。",
  },
  {
    title: "你的权利",
    body: "查阅、更正、删除与注销均可在「设置」页自助完成。",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">隐私政策</h1>
      <p className="mt-3 text-sm text-zinc-600">
        本页说明我们如何处理你的数据。条款以克制、具体为准，不写做不到的承诺。
      </p>
      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-semibold text-zinc-900">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="underline-offset-2 hover:underline">
          返回首页
        </Link>
        <span className="mx-2">·</span>
        联系渠道：支持邮箱随官网上线公布，备案信息见首页页脚。
      </p>
    </main>
  );
}
