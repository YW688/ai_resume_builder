import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./themes.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

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

/**
 * 首帧主题脚本：在 React 水合前把 data-theme 写到 <html>，避免闪白/闪黑。
 * 逻辑与 components/theme/ThemeProvider 保持一致（mist / ember / midnight）。
 * 默认主题固定为「晴岚」，不跟随系统深浅色，避免首次进入被误判成深色。
 */
const THEME_BOOT = `(function(){try{var ok=['mist','ember','midnight'];var t=localStorage.getItem('app.theme.v1');if(ok.indexOf(t)<0){t='mist';}var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t==='midnight'?'dark':'light';}catch(e){document.documentElement.dataset.theme='mist';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      // data-theme 由 THEME_BOOT 在首帧前写入，与服务端默认值可能不同：
      // 这是预期的，用 suppressHydrationWarning 忽略该属性差异。
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
