"use client";

import { useId, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import { formatDate, formatTime, stageLabel } from "@/lib/mock/compute";
import type { Application, ApplicationStage } from "@/lib/mock/types";
import { Btn, Field, Modal } from "@/components/app/ui";

const STAGES: ApplicationStage[] = [
  "applied",
  "read",
  "interview",
  "offer",
  "rejected",
];

type FormState = {
  company: string;
  role: string;
  resumeId: string;
  stage: ApplicationStage;
  appliedAt: string;
  nextStep: string;
  nextAt: string;
};

type FormErrors = {
  company?: string;
  role?: string;
  resumeId?: string;
};

/** 演示数据统一按 Asia/Shanghai 展示；日期输入仅编辑「日」，时间固定 09:00。 */
function todayInput(): string {
  return formatDate(new Date().toISOString(), "long");
}

function dateInput(iso: string): string {
  return formatDate(iso, "long");
}

function dateTimeInput(iso: string): string {
  return `${formatDate(iso, "long")}T${formatTime(iso)}`;
}

function dateValueToIso(value: string): string {
  return `${value}T09:00:00+08:00`;
}

function dateTimeValueToIso(value: string): string {
  return `${value}:00+08:00`;
}

function initialForm(
  application: Application | null,
  firstResumeId: string,
  fallbackAppliedAt: string,
): FormState {
  if (application) {
    return {
      company: application.company,
      role: application.role,
      resumeId: application.resumeId,
      stage: application.stage,
      appliedAt: dateInput(application.appliedAt),
      nextStep: application.nextStep ?? "",
      nextAt: application.nextAt ? dateTimeInput(application.nextAt) : "",
    };
  }
  return {
    company: "",
    role: "",
    resumeId: firstResumeId,
    stage: "applied",
    appliedAt: fallbackAppliedAt,
    nextStep: "",
    nextAt: "",
  };
}

export type ApplicationDialogProps = {
  application: Application | null;
  onClose: () => void;
};

/**
 * 「记录投递」与「编辑投递」复用同一个弹窗。
 * 由父级在需要时挂载（而不是常驻 + open 切换），
 * 这样「默认投递日期」只在客户端打开弹窗时读取，避免预渲染读取不稳定时间。
 */
export function ApplicationDialog({
  application,
  onClose,
}: ApplicationDialogProps) {
  const { state, addApplication, updateApplication, toast } = useWorkspace();
  const fieldId = useId();
  const [form, setForm] = useState<FormState>(() =>
    initialForm(application, state.resumes[0]?.id ?? "", todayInput()),
  );
  const [errors, setErrors] = useState<FormErrors>({});

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === "company" || key === "role" || key === "resumeId") {
      setErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  }

  function handleSave() {
    const company = form.company.trim();
    const role = form.role.trim();
    const nextErrors: FormErrors = {};
    if (!company) nextErrors.company = "请填写公司名称";
    if (!role) nextErrors.role = "请填写岗位名称";
    if (!form.resumeId) nextErrors.resumeId = "请选择使用的简历";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload: Omit<Application, "id"> = {
      company,
      role,
      resumeId: form.resumeId,
      stage: form.stage,
      appliedAt: form.appliedAt
        ? dateValueToIso(form.appliedAt)
        : new Date().toISOString(),
      nextStep: form.nextStep.trim() || undefined,
      nextAt: form.nextAt ? dateTimeValueToIso(form.nextAt) : undefined,
    };

    if (application) {
      updateApplication(application.id, payload);
      toast({
        title: "已保存修改",
        description: `${company} · ${role}`,
        tone: "positive",
      });
    } else {
      addApplication(payload);
      toast({
        title: "已记录投递",
        description: `${company} · ${role}`,
        tone: "positive",
      });
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={application ? "编辑投递" : "记录投递"}
      description="投递记录用于统计漏斗与面试提醒，数据只保存在本机。"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={handleSave}>
            {application ? "保存修改" : "保存记录"}
          </Btn>
        </>
      }
    >
      <div className="form-grid">
        <Field
          label="公司"
          required
          htmlFor={`${fieldId}-company`}
          error={errors.company}
        >
          <input
            id={`${fieldId}-company`}
            className="input"
            value={form.company}
            onChange={(event) => patch("company", event.target.value)}
            placeholder="例如：字节跳动"
            autoComplete="organization"
          />
        </Field>

        <Field
          label="岗位"
          required
          htmlFor={`${fieldId}-role`}
          error={errors.role}
        >
          <input
            id={`${fieldId}-role`}
            className="input"
            value={form.role}
            onChange={(event) => patch("role", event.target.value)}
            placeholder="例如：高级产品经理"
          />
        </Field>

        <Field
          label="使用简历"
          htmlFor={`${fieldId}-resume`}
          error={errors.resumeId}
          hint={
            state.resumes.length
              ? "选择这次投递实际发出的那份简历"
              : "还没有简历，请先到简历库新建一份"
          }
        >
          <select
            id={`${fieldId}-resume`}
            className="select"
            value={form.resumeId}
            onChange={(event) => patch("resumeId", event.target.value)}
            disabled={state.resumes.length === 0}
          >
            {state.resumes.length === 0 ? (
              <option value="">还没有简历</option>
            ) : null}
            {state.resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="阶段" htmlFor={`${fieldId}-stage`}>
          <select
            id={`${fieldId}-stage`}
            className="select"
            value={form.stage}
            onChange={(event) =>
              patch("stage", event.target.value as ApplicationStage)
            }
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="投递日期" htmlFor={`${fieldId}-applied`}>
          <input
            id={`${fieldId}-applied`}
            className="input"
            type="date"
            value={form.appliedAt}
            onChange={(event) => patch("appliedAt", event.target.value)}
          />
        </Field>

        <Field
          label="下一步时间"
          htmlFor={`${fieldId}-next-at`}
          hint="可选，用于近期面试提醒"
        >
          <input
            id={`${fieldId}-next-at`}
            className="input"
            type="datetime-local"
            value={form.nextAt}
            onChange={(event) => patch("nextAt", event.target.value)}
          />
        </Field>

        <Field
          label="下一步说明"
          htmlFor={`${fieldId}-next-step`}
          className="full"
          hint="例如：二面 · 现场面试 / 等待 HR 初筛"
        >
          <input
            id={`${fieldId}-next-step`}
            className="input"
            value={form.nextStep}
            onChange={(event) => patch("nextStep", event.target.value)}
            placeholder="等待 HR 初筛"
          />
        </Field>
      </div>
    </Modal>
  );
}
