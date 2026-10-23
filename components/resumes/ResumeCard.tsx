"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { A4Thumb } from "@/components/app/A4Page";
import {
  IconBtn,
  Menu,
  Pill,
  Progress,
  type MenuItem,
  type PillTone,
} from "@/components/app/ui";
import {
  computeCompletion,
  computeMatch,
  formatRelative,
} from "@/lib/mock/compute";
import type { Job, Resume, ResumeStatus } from "@/lib/mock/types";

const STATUS_META: Record<ResumeStatus, { label: string; tone: PillTone }> = {
  draft: { label: "草稿", tone: "neutral" },
  ready: { label: "可投递", tone: "accent" },
  applied: { label: "已投递", tone: "positive" },
  archived: { label: "已归档", tone: "outline" },
};

export type ResumeCardProps = {
  resume: Resume;
  job?: Job;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * 简历库卡片（DESIGN §6.2）：真实 A4 缩略页 + 标题 + 目标岗位 + 状态 + 匹配度
 * + 完成度 + 更新时间 + 更多菜单。所有数字走 compute.ts。
 */
export function ResumeCard({
  resume,
  job,
  onRename,
  onDuplicate,
  onDelete,
}: ResumeCardProps) {
  const router = useRouter();
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const node = thumbRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.floor(node.clientWidth);
      setThumbWidth((previous) => (previous === next ? previous : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const match = job ? computeMatch(resume, job) : null;
  const completion = computeCompletion(resume);
  const status = STATUS_META[resume.status];
  const targetLabel = job ? `${job.company} · ${job.title}` : "未设目标岗位";

  const openEditor = () => router.push(`/editor?id=${resume.id}`);
  const exportPdf = () => router.push(`/editor?id=${resume.id}&print=1`);

  const items: MenuItem[] = [
    { label: "编辑", icon: "edit", onSelect: openEditor },
    { label: "重命名", icon: "fileText", onSelect: onRename },
    { label: "复制", icon: "copy", onSelect: onDuplicate },
    { label: "导出 PDF", icon: "printer", onSelect: exportPdf },
    { label: "删除", icon: "trash", danger: true, divider: true, onSelect: onDelete },
  ];

  return (
    <article
      className="panel resume-card"
      style={{ position: "relative", padding: 12, minWidth: 0 }}
    >
      <div style={{ position: "absolute", top: 18, right: 18, zIndex: 2 }}>
        <Menu
          align="right"
          trigger={
            <IconBtn
              label={`更多操作：${resume.title}`}
              icon="more"
              size={15}
              variant="bordered"
            />
          }
          items={items}
        />
      </div>

      <button
        type="button"
        onClick={openEditor}
        aria-label={`打开「${resume.title}」编辑器`}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div
          ref={thumbRef}
          style={{
            width: "100%",
            aspectRatio: thumbWidth > 0 ? undefined : "1 / 1.4142",
          }}
        >
          {thumbWidth > 0 ? (
            <A4Thumb
              resume={resume}
              width={thumbWidth}
              job={job ? `${job.company} · ${job.title}` : undefined}
            />
          ) : null}
        </div>
      </button>

      <h3
        style={{
          marginTop: 12,
          fontSize: 16,
          lineHeight: 1.4,
          fontWeight: 600,
          overflowWrap: "anywhere",
        }}
      >
        {resume.title}
      </h3>
      <p
        className={job ? "t-muted" : "t-faint"}
        style={{
          marginTop: 2,
          fontSize: 12.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {targetLabel}
      </p>

      <div className="row-between" style={{ marginTop: 12, gap: 8 }}>
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="row" style={{ gap: 6 }}>
          <span className="t-11 t-muted">匹配度</span>
          <span
            className="num"
            style={{
              fontSize: 18,
              fontWeight: 650,
              lineHeight: 1,
              color: match ? "var(--ui-accent)" : "var(--ui-faint)",
            }}
          >
            {match ? match.score : "—"}
          </span>
        </span>
      </div>

      <Progress
        className="mt-12"
        label="完成度"
        showValue
        value={completion}
      />

      <div
        className="t-11 t-faint"
        style={{ marginTop: "auto", paddingTop: 12 }}
      >
        更新于 {formatRelative(resume.updatedAt)}
      </div>
    </article>
  );
}
