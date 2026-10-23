"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import { Btn, Field, Modal } from "@/components/app/ui";

type FormState = {
  company: string;
  title: string;
  location: string;
  salary: string;
  source: string;
  jdText: string;
};

const EMPTY_FORM: FormState = {
  company: "",
  title: "",
  location: "",
  salary: "",
  source: "",
  jdText: "",
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export type PasteJdDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 保存完成后回传新岗位 id，便于列表自动选中。 */
  onSaved: (id: string) => void;
};

/**
 * 「粘贴 JD」弹窗（DESIGN §6.3）：表单 → 800ms 模拟分析 → addJob，
 * 关键词由 store 按 KEYWORD_DICTIONARY 从 JD 原文中提取。
 */
export function PasteJdDialog({ open, onClose, onSaved }: PasteJdDialogProps) {
  const { addJob, extractKeywords, toast } = useWorkspace();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitting(false);
  }

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) =>
      previous[key] ? { ...previous, [key]: undefined } : previous,
    );
  }

  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  function submit() {
    if (submitting) return;
    const nextErrors: FormErrors = {};
    if (!form.company.trim()) nextErrors.company = "请填写公司名称";
    if (!form.title.trim()) nextErrors.title = "请填写职位名称";
    if (!form.jdText.trim()) nextErrors.jdText = "请粘贴 JD 原文";
    else if (form.jdText.trim().length < 20) {
      nextErrors.jdText = "JD 太短，至少 20 个字才能提取关键词";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    const keywords = extractKeywords(form.jdText);
    timerRef.current = setTimeout(() => {
      const id = addJob({
        company: form.company,
        title: form.title,
        location: form.location,
        salary: form.salary,
        source: form.source,
        jdText: form.jdText,
      });
      setSubmitting(false);
      reset();
      onSaved(id);
      onClose();
      if (keywords.length > 0) {
        toast({
          title: "已保存并分析岗位",
          description: `识别到 ${keywords.length} 个关键词，已按 JD 计算匹配度。`,
          tone: "positive",
        });
      } else {
        toast({
          title: "已保存岗位",
          description: "未在 JD 中识别到关键词，可手动在详情里补充。",
        });
      }
    }, 800);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="粘贴 JD"
      description="保存后会自动从 JD 中提取关键词，并计算与简历的匹配度。"
      size="lg"
      footer={
        <>
          <Btn variant="secondary" onClick={close} disabled={submitting}>
            取消
          </Btn>
          <Btn variant="primary" onClick={submit} loading={submitting}>
            保存并分析
          </Btn>
        </>
      }
    >
      <div className="form-grid">
        <Field label="公司" required error={errors.company}>
          <input
            className="input"
            value={form.company}
            maxLength={40}
            placeholder="例如：字节跳动"
            onChange={(event) => update("company", event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="职位" required error={errors.title}>
          <input
            className="input"
            value={form.title}
            maxLength={40}
            placeholder="例如：高级产品经理"
            onChange={(event) => update("title", event.target.value)}
          />
        </Field>
        <Field label="地点">
          <input
            className="input"
            value={form.location}
            maxLength={40}
            placeholder="例如：上海 · 杨浦"
            onChange={(event) => update("location", event.target.value)}
          />
        </Field>
        <Field label="薪资">
          <input
            className="input"
            value={form.salary}
            maxLength={40}
            placeholder="例如：30-50K · 15 薪"
            onChange={(event) => update("salary", event.target.value)}
          />
        </Field>
        <Field label="来源" className="full">
          <input
            className="input"
            value={form.source}
            maxLength={40}
            placeholder="例如：BOSS 直聘"
            onChange={(event) => update("source", event.target.value)}
          />
        </Field>
        <Field
          label="JD 原文"
          required
          className="full"
          error={errors.jdText}
          hint="粘贴岗位职责与任职要求，关键词将从中自动提取。"
        >
          <textarea
            className="textarea"
            value={form.jdText}
            style={{ minHeight: 160 }}
            placeholder="岗位职责：…&#10;任职要求：…"
            onChange={(event) => update("jdText", event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
