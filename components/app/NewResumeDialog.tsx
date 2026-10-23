"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/mock/store";
import { TEMPLATES } from "@/lib/mock/templates";
import type { TemplateId } from "@/lib/mock/types";
import { Btn, Field, Modal } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";

export function NewResumeDialog({
  open,
  onClose,
  defaultTargetJobId,
}: {
  open: boolean;
  onClose: () => void;
  defaultTargetJobId?: string | null;
}) {
  const router = useRouter();
  const { state, createResume, toast } = useWorkspace();
  const [title, setTitle] = useState("");
  const [targetJobId, setTargetJobId] = useState<string>(
    defaultTargetJobId ?? "",
  );
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setTitle("");
    setError(null);
    onClose();
  }

  function submit() {
    const trimmed = title.trim();
    if (trimmed.length > 40) {
      setError("简历名称请控制在 40 个字以内");
      return;
    }
    setSubmitting(true);
    const id = createResume({
      title: trimmed || "未命名简历",
      targetJobId: targetJobId || null,
      templateId,
    });
    toast({
      title: "已创建新简历",
      description: "正在打开编辑器，内容会自动保存。",
      tone: "positive",
    });
    router.push(`/editor?id=${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="新建简历"
      description="选择目标岗位和模板，创建后可以随时修改。"
      footer={
        <>
          <Btn variant="secondary" onClick={close} disabled={submitting}>
            取消
          </Btn>
          <Btn variant="primary" onClick={submit} loading={submitting}>
            创建并编辑
          </Btn>
        </>
      }
    >
      <div className="stack-16">
        <Field
          label="简历名称"
          hint="例如「产品经理 · 字节」，方便在简历库里区分。"
          error={error ?? undefined}
        >
          <input
            className="input"
            value={title}
            maxLength={40}
            placeholder="未命名简历"
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            autoFocus
          />
        </Field>

        <Field label="目标岗位" hint="用于对照 JD 计算关键词匹配度，可稍后设置。">
          <select
            className="select"
            value={targetJobId}
            onChange={(event) => setTargetJobId(event.target.value)}
          >
            <option value="">暂不设置</option>
            {state.jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.company} · {job.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="field">
          <span className="field-label">模板</span>
          <div className="stack-4" role="radiogroup" aria-label="简历模板">
            {TEMPLATES.map((template) => {
              const selected = template.id === templateId;
              return (
                <button
                  key={template.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplateId(template.id)}
                  className="row-between"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: `1px solid ${selected ? "var(--ui-accent)" : "var(--ui-border)"}`,
                    borderRadius: 6,
                    background: selected ? "var(--ui-accent-soft)" : "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span>
                    <span
                      className="fw-500"
                      style={{ display: "block", fontSize: 13 }}
                    >
                      {template.name}
                    </span>
                    <span className="t-muted t-11">{template.desc}</span>
                  </span>
                  {selected ? (
                    <Icon name="checkCircle" size={16} className="t-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function NewResumeButton({
  label = "新建简历",
  variant = "primary",
  size = "md",
  defaultTargetJobId,
  className,
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  defaultTargetJobId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn
        variant={variant}
        size={size}
        icon="plus"
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Btn>
      <NewResumeDialog
        open={open}
        onClose={() => setOpen(false)}
        defaultTargetJobId={defaultTargetJobId}
      />
    </>
  );
}
