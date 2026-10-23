import type { Metadata } from "next";
import "./editor.css";

export const metadata: Metadata = {
  title: "编辑简历 — 简历编辑器",
  description: "填写简历内容，对照目标岗位 JD 改写，实时预览 A4 并导出 PDF。",
  robots: { index: false, follow: false },
};

/**
 * 编辑器外壳与工作台不同：整屏、40px chrome 顶栏 + 三栏主体，不带侧边导航。
 * 这里只挂编辑器专用样式与 noindex，AppShell 不参与。
 */
export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
