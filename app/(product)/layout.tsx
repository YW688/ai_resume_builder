import type { Metadata } from "next";
import "../app-ui.css";
import { WorkspaceProvider } from "@/lib/mock/store";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** 产品端（演示版）：全部由浏览器内的硬编码数据驱动，不依赖认证或数据库。 */
export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
