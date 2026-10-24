import type { Metadata } from "next";
import { Suspense } from "react";
import "../app-ui.css";
import { requireUser } from "@/lib/dal";
import { WorkspaceProvider } from "@/lib/mock/store";
import { loadWorkspace } from "@/lib/workspace/load";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * 产品端（已登录区）。
 *
 * Cache Components 下，读取会话（cookies）属于请求时数据，必须放在
 * <Suspense> 边界内：layout 先输出静态壳，会话与 workspace 数据流式补上。
 * 参考 node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md。
 */
function WorkspaceFallback() {
  return (
    <div
      className="app-shell"
      aria-busy="true"
      aria-label="工作台加载中"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
    >
      <p className="t-13 t-muted">正在加载工作台…</p>
    </div>
  );
}

async function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const userId = await requireUser();
  const initial = await loadWorkspace(userId);
  return (
    <WorkspaceProvider initial={initial} userId={userId}>
      {children}
    </WorkspaceProvider>
  );
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <WorkspaceGate>{children}</WorkspaceGate>
    </Suspense>
  );
}
