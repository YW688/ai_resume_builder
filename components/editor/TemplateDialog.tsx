"use client";

/* 弹窗打开时同步当前简历模板与主色，属于对受控弹窗状态的外部同步。 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { A4Thumb } from "@/components/app/A4Page";
import { Btn, Modal } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import { ACCENTS, TEMPLATES } from "@/lib/mock/templates";
import type { AccentId, Resume, TemplateId } from "@/lib/mock/types";

/**
 * 模板 / 主色选择：3 个真实 A4 缩略（同一 A4Page 组件缩放），
 * 「应用」后才写回 store；取消不改变预览。
 */
export function TemplateDialog({
  open,
  onClose,
  resume,
  jobTitle,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  resume: Resume;
  jobTitle?: string;
  onApply: (patch: { templateId: TemplateId; accent: AccentId }) => void;
}) {
  const [templateId, setTemplateId] = useState<TemplateId>(resume.templateId);
  const [accent, setAccent] = useState<AccentId>(resume.accent);

  useEffect(() => {
    if (!open) return;
    setTemplateId(resume.templateId);
    setAccent(resume.accent);
  }, [open, resume.templateId, resume.accent]);

  const staged: Resume = { ...resume, templateId, accent };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="模板与主色"
      description="模板决定版面结构，主色只影响标题与分隔线，不改动内容。"
      size="lg"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>
            取消
          </Btn>
          <Btn
            variant="primary"
            onClick={() => {
              onApply({ templateId, accent });
              onClose();
            }}
          >
            应用
          </Btn>
        </>
      }
    >
      <div className="ed-template-grid" role="radiogroup" aria-label="简历模板">
        {TEMPLATES.map((template) => {
          const selected = template.id === templateId;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`ed-template-card${selected ? " is-active" : ""}`}
              onClick={() => setTemplateId(template.id)}
            >
              <span className="ed-template-thumb">
                <A4Thumb
                  resume={staged}
                  variant={template.id}
                  accent={accent}
                  job={jobTitle}
                  width={126}
                />
              </span>
              <span className="ed-template-name">
                {template.name}
                {selected ? (
                  <Icon name="checkCircle" size={15} className="t-accent" />
                ) : null}
              </span>
              <span className="ed-template-desc">{template.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="ed-accent-block">
        <div className="ed-accent-label">
          主色
          <span className="t-11 t-muted">作用于段落标题与姓名下方的短横线</span>
        </div>
        <div className="ed-accent-row" role="radiogroup" aria-label="主色">
          {ACCENTS.map((item) => {
            const selected = item.id === accent;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`ed-accent${selected ? " is-active" : ""}`}
                onClick={() => setAccent(item.id)}
              >
                <span
                  className="ed-accent-swatch"
                  style={{ background: item.value }}
                  aria-hidden="true"
                />
                <span>{item.name}</span>
                {selected ? <Icon name="check" size={14} className="t-accent" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
