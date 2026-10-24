import Link from "next/link";
import type { ReactNode } from "react";

function BrandMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M8.5 4.5h10.2l4.8 4.8v18.2H8.5z"
          fill="#fff"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M18.7 4.5v4.8h4.8"
          stroke="#1A6BD6"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M12.2 14h7.6M12.2 18h5.6M12.2 22h4"
          stroke="#c5d0dd"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const POINTS = [
  {
    title: "先有 JD，再改简历",
    desc: "粘贴目标职位描述，提取关键词与可量化点，逐段对照改写。",
  },
  {
    title: "每段都能单独重写",
    desc: "不满意就重来，不会整份推翻；版本随改随存。",
  },
  {
    title: "一键导出 A4 PDF",
    desc: "排版固定、中文友好，投递前直接下载。",
  },
];

/** 登录 / 注册共用的页面外壳：左侧品牌说明，右侧表单卡片。 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#F4F8FC] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-44 -right-32 h-[540px] w-[540px] rounded-full bg-[#1A6BD6]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-44 -left-32 h-[480px] w-[480px] rounded-full bg-[#FFE9B0]/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1A6BD6]/30 to-transparent"
      />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-28px_rgba(14,27,42,0.35)] ring-1 ring-[#e2e8f0] lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1A6BD6] via-[#1A6BD6] to-[#0E1B2A] p-10 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-[#E5355B]/20 blur-2xl"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="text-[15px] font-semibold tracking-tight">
                  AI 简历编辑器
                </p>
                <p className="text-[11px] tracking-[0.18em] text-white/60">
                  中文求职 · JD 驱动改写
                </p>
              </div>
            </div>

            <h2 className="mt-14 max-w-[15em] text-[30px] leading-[1.25] font-semibold tracking-tight">
              把目标 JD，变成简历里的加分项
            </h2>
            <p className="mt-4 max-w-[22em] text-[13.5px] leading-relaxed text-white/70">
              登录后，你的简历、目标岗位与投递记录会保存在账号下，换设备也能继续。
            </p>
          </div>

          <ul className="relative mt-12 space-y-5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFE9B0]" />
                <div>
                  <p className="text-[13.5px] font-semibold text-white/95">
                    {point.title}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/60">
                    {point.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p className="relative mt-12 text-[11px] text-white/40">
            密码由 Neon Auth 托管，本应用不存储明文密码。
          </p>
        </aside>

        <div className="flex flex-col justify-center p-7 sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-[#58657a] transition hover:text-[#0E1B2A]"
            >
              <span aria-hidden>←</span> 返回官网
            </Link>
            <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-[11px] font-medium text-[#58657a]">
              Neon Auth
            </span>
          </div>

          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[#0E1B2A]">
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] text-[#58657a]">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer ? (
            <div className="mt-6 border-t border-[#eef1f5] pt-5 text-[13px] text-[#58657a]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
