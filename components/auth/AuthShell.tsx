import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CreditIcon } from "@/components/credits/CreditIcon";
import "./auth.css";

function BrandMark() {
  return (
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

/**
 * 登录 / 注册共用的页面外壳。
 *
 * 版式参考：左侧品牌视觉（大幅插画 + 玻璃说明卡）+ 右侧登录表单的双栏登录页；
 * 视觉采用玻璃拟态：半透明外壳、backdrop blur、内高光与暖色光斑。
 * 右栏保留原有 h1 / 表单 / 页脚插槽，登录与注册共用。
 */
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
    <main className="auth-page">
      <div className="auth-orb auth-orb-a" aria-hidden />
      <div className="auth-orb auth-orb-b" aria-hidden />
      <div className="auth-orb auth-orb-c" aria-hidden />

      <div className="auth-frame">
        <aside className="auth-visual" aria-label="产品介绍">
          <Image
            src="/art/feature-parse-3.jpg"
            alt="短发少女在蓝天下伸出手，面前浮着一张半透明的简历卡片"
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 56vw"
            className="auth-visual-img"
          />
          <div className="auth-visual-tint" aria-hidden />
          <div className="auth-visual-sheen" aria-hidden />

          <div className="auth-visual-content">
            <div className="auth-brand">
              <span className="auth-brand-mark">
                <BrandMark />
              </span>
              <div>
                <p className="auth-brand-name">AI 简历编辑器</p>
                <p className="auth-brand-sub">中文求职 · JD 驱动改写</p>
              </div>
            </div>

            <div className="auth-visual-copy">
              <h2>
                把目标 JD，
                <br />
                变成简历里的加分项
              </h2>
              <p>
                登录后，简历、目标岗位与投递记录都保存在账号下；换设备也能接着改。
              </p>
            </div>

            <ul className="auth-features">
              {POINTS.map((point) => (
                <li key={point.title} className="auth-feature">
                  <span className="auth-feature-dot" aria-hidden />
                  <div>
                    <strong>{point.title}</strong>
                    <span>{point.desc}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="auth-badges" aria-label="计费方式">
              <span className="auth-badge">
                <CreditIcon size={16} tone="member" decorative />
                每日免费 <b>5 点</b>
              </span>
              <span className="auth-badge">
                <CreditIcon size={16} tone="free" decorative />
                整份简历生成 <b>2 点</b>
              </span>
              <span className="auth-badge">PDF 导出免费</span>
            </div>

            <p className="auth-trust">密码由 Neon Auth 托管，本应用不存储明文密码。</p>
          </div>
        </aside>

        <section className="auth-form-pane">
          <div className="auth-topbar">
            <Link href="/" className="auth-back">
              <span aria-hidden>←</span> 返回官网
            </Link>
            <span className="auth-auth-chip">Neon Auth 托管</span>
          </div>

          <div className="auth-form-head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="auth-form-body">{children}</div>

          {footer ? <div className="auth-foot">{footer}</div> : null}
        </section>
      </div>
    </main>
  );
}
