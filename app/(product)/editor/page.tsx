import { Suspense } from "react";
import { EditorScreen } from "@/components/editor/EditorScreen";

/** 编辑器首屏骨架：避免 useSearchParams 的客户端边界在 SSR 时闪空白。 */
function EditorFallback() {
  return (
    <div className="editor-root" aria-busy="true" aria-label="编辑器加载中">
      <div className="ed-topbar ed-boot-top" />
      <div className="ed-boot-body">
        <div className="ed-boot-rail" />
        <div className="ed-boot-main">
          <div className="ed-boot-card" />
          <div className="ed-boot-card" />
        </div>
        <div className="ed-boot-preview" />
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorFallback />}>
      <EditorScreen />
    </Suspense>
  );
}
