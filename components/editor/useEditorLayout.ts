"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { readJsonPref, writeJsonPref } from "@/lib/ui/prefs";

/** 桌面端编辑器三栏尺寸与折叠状态（仅 UI 偏好，不写入简历数据）。 */
export type EditorLayout = {
  railW: number;
  previewW: number;
  railCollapsed: boolean;
  previewCollapsed: boolean;
};

export const LAYOUT_DEFAULTS: EditorLayout = {
  railW: 220,
  previewW: 464,
  railCollapsed: false,
  previewCollapsed: false,
};

export const LAYOUT_LIMITS = {
  railMin: 180,
  railMax: 340,
  previewMin: 340,
  previewMax: 760,
  /** 中栏最小可用宽度：低于它时优先压缩侧栏。 */
  mainMin: 420,
  /** 键盘每次调整的步长（按住 Shift 走大步）。 */
  keyStep: 16,
  keyStepLarge: 48,
};

const STORAGE_KEY = "editor.layout.v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function normalize(input: unknown): EditorLayout {
  const raw = (input ?? {}) as Partial<EditorLayout>;
  const railW = Number(raw.railW);
  const previewW = Number(raw.previewW);
  return {
    railW: Number.isFinite(railW)
      ? clamp(railW, LAYOUT_LIMITS.railMin, LAYOUT_LIMITS.railMax)
      : LAYOUT_DEFAULTS.railW,
    previewW: Number.isFinite(previewW)
      ? clamp(previewW, LAYOUT_LIMITS.previewMin, LAYOUT_LIMITS.previewMax)
      : LAYOUT_DEFAULTS.previewW,
    railCollapsed: Boolean(raw.railCollapsed),
    previewCollapsed: Boolean(raw.previewCollapsed),
  };
}

type ResizePane = "rail" | "preview";

/**
 * 编辑器三栏布局：拖拽调宽 + 左右栏收起。
 *
 * 顺滑度处理：
 * - 拖拽期间直接改根节点 CSS 变量（不触发 React 重渲染），并用 rAF 合并 pointermove；
 * - 松手才提交 state 并持久化；
 * - 拖拽时给 <body> 加 `ed-resizing`，统一 cursor / user-select，避免选中文字。
 */
export function useEditorLayout(rootRef: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<EditorLayout>(LAYOUT_DEFAULTS);
  const [desktop, setDesktop] = useState(false);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const hydratedRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1000px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const saved = readJsonPref<EditorLayout | null>(STORAGE_KEY, null);
    if (saved) {
      const next = normalize(saved);
      setLayout(next);
      const root = rootRef.current;
      if (root) {
        root.style.setProperty("--ed-rail-w", `${next.railW}px`);
        root.style.setProperty("--ed-preview-w", `${next.previewW}px`);
      }
    }
    hydratedRef.current = true;
  }, [rootRef]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    writeJsonPref(STORAGE_KEY, layout);
  }, [layout]);

  const setWidth = useCallback(
    (pane: ResizePane, width: number) => {
      const clamped =
        pane === "rail"
          ? clamp(width, LAYOUT_LIMITS.railMin, LAYOUT_LIMITS.railMax)
          : clamp(width, LAYOUT_LIMITS.previewMin, LAYOUT_LIMITS.previewMax);
      setLayout((prev) =>
        pane === "rail" ? { ...prev, railW: clamped } : { ...prev, previewW: clamped },
      );
    },
    [],
  );

  const startResize = useCallback(
    (pane: ResizePane) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      event.preventDefault();

      const startX = event.clientX;
      const startRail = layoutRef.current.railW;
      const startPreview = layoutRef.current.previewW;
      let pendingRail = startRail;
      let pendingPreview = startPreview;
      let lastX = startX;
      let frame = 0;
      let finished = false;

      document.body.classList.add("ed-resizing");

      const apply = () => {
        frame = 0;
        const dx = lastX - startX;
        if (pane === "rail") {
          const maxByViewport = Math.min(
            LAYOUT_LIMITS.railMax,
            window.innerWidth - layoutRef.current.previewW - LAYOUT_LIMITS.mainMin,
          );
          pendingRail = clamp(startRail + dx, LAYOUT_LIMITS.railMin, maxByViewport);
          root.style.setProperty("--ed-rail-w", `${pendingRail}px`);
        } else {
          const maxByViewport = Math.min(
            LAYOUT_LIMITS.previewMax,
            window.innerWidth - layoutRef.current.railW - LAYOUT_LIMITS.mainMin,
          );
          pendingPreview = clamp(startPreview - dx, LAYOUT_LIMITS.previewMin, maxByViewport);
          root.style.setProperty("--ed-preview-w", `${pendingPreview}px`);
        }
      };

      const onMove = (moveEvent: PointerEvent) => {
        lastX = moveEvent.clientX;
        if (frame) return;
        frame = window.requestAnimationFrame(apply);
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        if (frame) window.cancelAnimationFrame(frame);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.classList.remove("ed-resizing");
        setLayout((prev) =>
          pane === "rail"
            ? { ...prev, railW: pendingRail }
            : { ...prev, previewW: pendingPreview },
        );
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [rootRef],
  );

  const onSeparatorKeyDown = useCallback(
    (pane: ResizePane) => (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = pane === "rail" ? layoutRef.current.railW : layoutRef.current.previewW;
      const step = event.shiftKey
        ? LAYOUT_LIMITS.keyStepLarge
        : LAYOUT_LIMITS.keyStep;
      const min =
        pane === "rail" ? LAYOUT_LIMITS.railMin : LAYOUT_LIMITS.previewMin;
      const max =
        pane === "rail" ? LAYOUT_LIMITS.railMax : LAYOUT_LIMITS.previewMax;
      let next: number | null = null;
      if (event.key === "ArrowLeft") next = current - step;
      else if (event.key === "ArrowRight") next = current + step;
      else if (event.key === "Home") next = min;
      else if (event.key === "End") next = max;
      if (next === null) return;
      event.preventDefault();
      const clamped = clamp(next, min, max);
      setWidth(pane, clamped);
      const root = rootRef.current;
      if (root) {
        root.style.setProperty(
          pane === "rail" ? "--ed-rail-w" : "--ed-preview-w",
          `${clamped}px`,
        );
      }
    },
    [rootRef, setWidth],
  );

  const resetWidth = useCallback(
    (pane: ResizePane) => {
      const width =
        pane === "rail" ? LAYOUT_DEFAULTS.railW : LAYOUT_DEFAULTS.previewW;
      setWidth(pane, width);
      const root = rootRef.current;
      if (root) {
        root.style.setProperty(
          pane === "rail" ? "--ed-rail-w" : "--ed-preview-w",
          `${width}px`,
        );
      }
    },
    [rootRef, setWidth],
  );

  const setRailCollapsed = useCallback((collapsed: boolean) => {
    setLayout((prev) => ({ ...prev, railCollapsed: collapsed }));
  }, []);

  const setPreviewCollapsed = useCallback((collapsed: boolean) => {
    setLayout((prev) => ({ ...prev, previewCollapsed: collapsed }));
  }, []);

  const style = {
    "--ed-rail-w": `${layout.railW}px`,
    "--ed-preview-w": `${layout.previewW}px`,
  } as CSSProperties;

  return {
    layout,
    desktop,
    style,
    startResize,
    onSeparatorKeyDown,
    resetWidth,
    setRailCollapsed,
    setPreviewCollapsed,
  };
}
