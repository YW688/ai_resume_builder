"use client";

import { useEffect, useRef, useState } from "react";

import { A4Page } from "@/components/app/A4Page";
import { Icon } from "@/components/app/icons";
import { Btn, Modal } from "@/components/app/ui";
import type { Job, Resume } from "@/lib/mock/types";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/**
 * 导出前的「打印预览」：把 A4 放大到接近真实观感，单独一层显示，
 * 确认后再下载服务端生成的 PDF（PDF 不包含页面 chrome / 浏览器插件）。
 */
export function PrintPreviewDialog({
  open,
  onClose,
  resume,
  job,
  photoUrl,
  exporting,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  resume: Resume;
  job?: Job;
  photoUrl?: string;
  exporting: boolean;
  onDownload: () => void | Promise<void>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    if (!open) return;
    const node = viewportRef.current;
    if (!node) return;
    const measure = () => {
      const width = Math.max(240, node.clientWidth - 32);
      const height = Math.max(240, node.clientHeight - 32);
      setScale(Math.max(0.24, Math.min(width / A4_WIDTH, height / A4_HEIGHT, 1.15)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="打印预览"
      description="确认版式后下载 PDF。导出文件只包含简历本身，不包含页面元素、浏览器插件或关键词高亮。"
      size="lg"
      className="ed-print-dialog"
      footer={
        <>
          <span className="ed-print-foot-note">
            <Icon name="fileText" size={13} /> A4 · 210 × 297 mm · 1 页
          </span>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn
            variant="primary"
            icon="download"
            loading={exporting}
            disabled={exporting}
            onClick={() => void onDownload()}
          >
            下载 PDF
          </Btn>
        </>
      }
    >
      <div className="ed-print-stage">
        <div className="ed-print-viewport" ref={viewportRef}>
          <div
            className="ed-print-canvas"
            style={{
              width: Math.round(A4_WIDTH * scale),
              height: Math.round(A4_HEIGHT * scale),
            }}
          >
            <div
              className="ed-print-scaled"
              style={{
                width: A4_WIDTH,
                height: A4_HEIGHT,
                transform: `scale(${scale})`,
              }}
            >
              <A4Page
                resume={resume}
                job={job?.title}
                photoUrl={photoUrl}
                accent={resume.accent}
                variant={resume.templateId}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
