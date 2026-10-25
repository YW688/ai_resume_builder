import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Geist 改为本地字体：构建期不依赖 fonts.googleapis.com（离线/国内网络也能 build），
 * 运行时自托管，无第三方字体请求。字体文件见 assets/fonts/。
 */
const geistSans = localFont({
  src: "../assets/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 简历编辑器 — 针对 JD 智能改写",
  description:
    "制作中文简历，粘贴职位描述即可逐段改写为带关键词与量化成果的版本，一键导出 PDF。",
  openGraph: {
    title: "AI 简历编辑器 — 针对 JD 智能改写",
    description:
      "粘贴目标 JD，AI 按关键词把你的经历改写成 HR 想看的量化表达；排版、导出，一次做完。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og-hero.jpg", width: 1200, height: 630, alt: "AI 简历编辑器" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI 简历编辑器 — 针对 JD 智能改写",
    description: "粘贴目标 JD，AI 按关键词改写经历，一键导出 A4 PDF。",
    images: ["/og-hero.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
