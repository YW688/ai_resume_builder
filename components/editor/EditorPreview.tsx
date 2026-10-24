"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { A4Page } from "@/components/app/A4Page";
import { Icon } from "@/components/app/icons";
import { IconBtn, Toggle } from "@/components/app/ui";
import { templateName } from "@/lib/mock/templates";
import { HIGHLIGHT_COLORS } from "./highlightColors";
import type { Job, Resume } from "@/lib/mock/types";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const STAGE_PADDING = 16;
const ZOOM_MIN = 60;
const ZOOM_MAX = 120;
const ZOOM_STEP = 10;

/**
 * 编辑器右侧粘性实时预览：真实 A4Page 按容器宽度等比缩放，
 * 叠加 60–120% 的缩放系数（默认 100% 即「适合宽度」）。
 */
export function EditorPreview({
  resume,
  job,
  photoUrl,
  keywords,
  highlight,
  highlightColor,
  highlightColorId,
  onHighlightColorChange,
  onCollapse,
  zoom,
  onZoomChange,
  onToggleHighlight,
  onPrint,
  overlay = false,
}: {
  resume: Resume;
  job?: Job;
  photoUrl?: string;
  keywords: string[];
  highlight: boolean;
  /** 当前高亮底色（CSS 颜色值）。 */
  highlightColor: string;
  highlightColorId: string;
  onHighlightColorChange: (id: string) => void;
  /** 收起预览栏（桌面端）。 */
  onCollapse?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onToggleHighlight: (next: boolean) => void;
  onPrint: () => void;
  overlay?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(0.52);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => {
      const available = Math.max(160, node.clientWidth - STAGE_PADDING * 2);
      setFit(Math.min(1, available / A4_WIDTH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(0.1, fit * (zoom / 100));
  const paperWidth = Math.round(A4_WIDTH * scale);
  const paperHeight = Math.round(A4_HEIGHT * scale);

  return (
    <div className={`ed-preview-panel${overlay ? " is-overlay" : ""}`}>
      <div className="ed-preview-toolbar">
        <span className="ed-preview-name" title={templateName(resume.templateId)}>
          <Icon name="fileText" size={14} />
          {templateName(resume.templateId)}
        </span>

        <span className="ed-zoom" role="group" aria-label="预览缩放">
          <IconBtn
            label="缩小预览"
            icon="zoomOut"
            size={15}
            disabled={zoom <= ZOOM_MIN}
            onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
          />
          <span className="ed-zoom-value num" aria-live="polite">
            {zoom}%
          </span>
          <IconBtn
            label="放大预览"
            icon="zoomIn"
            size={15}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          />
        </span>

        <span className="ed-preview-pages num" title="页数">
          1 / 1
        </span>

        <span className="ed-kw-toggle">
          <Toggle
            checked={highlight}
            onChange={onToggleHighlight}
            ariaLabel="关键词高亮"
          />
          <span>关键词高亮</span>
        </span>

        {highlight ? (
          <span className="ed-kw-colors" role="group" aria-label="关键词高亮颜色">
            <span className="ed-kw-colors-label" aria-hidden="true">颜色</span>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                className={`ed-kw-swatch${highlightColorId === color.id ? " is-active" : ""}`}
                style={{ "--swatch": color.value } as CSSProperties}
                aria-label={`高亮颜色：${color.label}`}
                aria-pressed={highlightColorId === color.id}
                title={color.label}
                onClick={() => onHighlightColorChange(color.id)}
              />
            ))}
          </span>
        ) : null}

        {onCollapse ? (
          <IconBtn label="收起预览" icon="panelRight" size={15} onClick={onCollapse} />
        ) : null}
        <IconBtn label="打开打印预览" icon="printer" size={15} onClick={onPrint} />
      </div>

      <div className="ed-preview-stage" ref={stageRef}>
        <div
          className="ed-preview-paper"
          style={{ width: paperWidth, height: paperHeight }}
        >
          <div
            className="ed-preview-scaled"
            style={{
              width: A4_WIDTH,
              height: A4_HEIGHT,
              transform: `scale(${scale})`,
            }}
          >
            <A4Page
              resume={resume}
              photoUrl={photoUrl}
              highlight={highlight ? keywords : undefined}
              highlightColor={highlightColor}
              job={job?.title}
            />
          </div>
        </div>
        <div className="ed-preview-caption">A4 · 210 × 297 mm · 实时预览</div>
      </div>
    </div>
  );
}
