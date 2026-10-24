"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Btn, ConfirmDialog, Field, IconBtn, KeywordChip } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import { CREDIT_FEATURES, type CreditsState } from "@/lib/credits/catalog";
import type { Education, Experience, Resume, ToastInput } from "@/lib/mock/types";
import type { RewriteTarget } from "./RewriteDialog";
import { useSectionCollapse } from "./sectionCollapse";

export type DraftUpdate = (patch: Partial<Resume>) => void;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function SectionCard({
  id,
  title,
  sub,
  actions,
  children,
  defaultCollapsed = false,
}: {
  id: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
}) {
  const { collapsed, toggle } = useSectionCollapse(id, defaultCollapsed);
  const bodyId = `ed-card-body-${id}`;

  return (
    <section
      className={`ed-card${collapsed ? " is-collapsed" : ""}`}
      id={`ed-section-${id}`}
      data-section={id}
      aria-labelledby={`ed-title-${id}`}
    >
      <div className="ed-card-head">
        <div className="ed-card-head-main">
          <h2 className="ed-card-title" id={`ed-title-${id}`}>
            <button
              type="button"
              className="ed-card-toggle"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              onClick={toggle}
            >
              <span className="ed-card-toggle-text">{title}</span>
              <Icon
                name="chevronDown"
                size={15}
                className="ed-card-chevron"
              />
            </button>
          </h2>
          {sub ? <p className="ed-card-sub">{sub}</p> : null}
        </div>
        {actions ? <div className="ed-card-actions">{actions}</div> : null}
      </div>
      <div
        className="ed-card-collapse"
        id={bodyId}
        data-open={!collapsed}
        inert={collapsed || undefined}
      >
        <div className="ed-card-body">{children}</div>
      </div>
    </section>
  );
}

/* -------------------------------- 基本信息 -------------------------------- */

export function BasicInfoSection({
  resume,
  update,
}: {
  resume: Resume;
  update: DraftUpdate;
}) {
  const [touched, setTouched] = useState({ name: false, email: false });

  const emailValue = resume.email.trim();
  const nameError = !resume.fullName.trim() && touched.name ? "姓名是必填项" : undefined;
  const emailError = !emailValue
    ? touched.email
      ? "邮箱是必填项，投递后 HR 会通过它联系你"
      : undefined
    : EMAIL_PATTERN.test(emailValue)
      ? undefined
      : "邮箱格式不正确，例如 linxiao@example.com";

  return (
    <SectionCard
      id="basic"
      title="基本信息"
      sub="会出现在 A4 页眉，请填写能联系到你的信息。"
    >
      <div className="form-grid">
        <Field label="姓名" required htmlFor="ed-fullName" error={nameError}>
          <input
            id="ed-fullName"
            className="input"
            value={resume.fullName}
            placeholder="例如 林晓"
            maxLength={20}
            onChange={(event) => update({ fullName: event.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            aria-invalid={Boolean(nameError)}
          />
        </Field>

        <Field label="手机" htmlFor="ed-phone" hint="国内手机号，可带空格">
          <input
            id="ed-phone"
            className="input"
            value={resume.phone}
            placeholder="例如 138 0000 0000"
            inputMode="tel"
            maxLength={20}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </Field>

        <Field label="邮箱" required htmlFor="ed-email" error={emailError}>
          <input
            id="ed-email"
            className="input"
            value={resume.email}
            placeholder="例如 linxiao@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            onChange={(event) => update({ email: event.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            aria-invalid={Boolean(emailError)}
          />
        </Field>

        <Field label="城市" htmlFor="ed-city" hint="写当前所在城市或期望城市">
          <input
            id="ed-city"
            className="input"
            value={resume.city}
            placeholder="例如 上海"
            maxLength={20}
            onChange={(event) => update({ city: event.target.value })}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* -------------------------------- 求职总结 -------------------------------- */

export function SummarySection({
  resume,
  update,
  job,
  onRewrite,
}: {
  resume: Resume;
  update: DraftUpdate;
  job?: { company: string; title: string };
  onRewrite: (target: RewriteTarget) => void;
}) {
  const length = resume.summary.trim().length;
  return (
    <SectionCard
      id="summary"
      title="求职总结"
      sub="3–5 句，说清方向、年限与最相关的一项成果。"
      actions={
        <Btn
          variant="secondary"
          size="sm"
          icon="sparkle"
          disabled={!job}
          title={
            job
              ? "对照目标岗位 JD 润色这段总结（消耗 1 点）"
              : "先选择目标岗位，AI 才能对照 JD 润色"
          }
          onClick={() =>
            onRewrite({
              mode: "summary",
              label: "求职总结",
              original: resume.summary,
            })
          }
        >
          AI 润色（1 点）
        </Btn>
      }
    >
      <textarea
        id="ed-summary"
        className="textarea ed-summary-input"
        value={resume.summary}
        placeholder="例如：5 年内容与 B 端产品经验，主导过从 0 到 1 的增长工具与商业化项目……"
        aria-label="求职总结"
        onChange={(event) => update({ summary: event.target.value })}
      />
      <div className="ed-field-foot">
        <span className="t-11 t-muted">{length} 字</span>
        <span className="t-11 t-muted">
          {job
            ? `AI 会优先覆盖「${job.company} · ${job.title}」JD 里缺失的关键词。`
            : "顶栏选择目标岗位后，AI 润色才可用。"}
        </span>
      </div>
    </SectionCard>
  );
}

/* -------------------------------- 工作经历 -------------------------------- */

export function ExperienceSection({
  resume,
  update,
  job,
  onRewrite,
}: {
  resume: Resume;
  update: DraftUpdate;
  job?: { company: string; title: string };
  onRewrite: (target: RewriteTarget) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const experiences = resume.experiences;

  function addExperience() {
    const next: Experience = {
      id: makeLocalId("e"),
      company: "",
      title: "",
      startDate: "",
      endDate: "",
      description: "",
    };
    update({ experiences: [...experiences, next] });
  }

  function patchExperience(id: string, patch: Partial<Experience>) {
    update({
      experiences: experiences.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function moveExperience(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= experiences.length) return;
    const next = experiences.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    update({ experiences: next });
  }

  function removeExperience(id: string) {
    update({ experiences: experiences.filter((item) => item.id !== id) });
  }

  return (
    <SectionCard
      id="experience"
      title="工作经历"
      sub="每段 2–3 条要点，写清做了什么、带来什么结果；可上下移动顺序。"
      actions={
        <Btn variant="secondary" size="sm" icon="plus" onClick={addExperience}>
          添加经历
        </Btn>
      }
    >
      {experiences.length === 0 ? (
        <div className="ed-inline-empty">
          <p className="ed-inline-empty-title">还没有工作经历</p>
          <p className="t-11 t-muted">
            补一段最近的工作，再让 AI 对照 JD 改写，匹配度会立刻变化。
          </p>
          <Btn variant="secondary" size="sm" icon="plus" onClick={addExperience}>
            添加第一段经历
          </Btn>
        </div>
      ) : null}

      <div className="ed-exp-list">
        {experiences.map((experience, index) => (
          <article className="ed-exp" key={experience.id}>
            <div className="ed-exp-head">
              <span className="ed-exp-index num">经历 {index + 1}</span>
              <div className="ed-exp-actions">
                <IconBtn
                  label="上移这段经历"
                  icon="arrowUp"
                  size={15}
                  disabled={index === 0}
                  onClick={() => moveExperience(index, -1)}
                />
                <IconBtn
                  label="下移这段经历"
                  icon="arrowDown"
                  size={15}
                  disabled={index === experiences.length - 1}
                  onClick={() => moveExperience(index, 1)}
                />
                <IconBtn
                  label="删除这段经历"
                  icon="trash"
                  size={15}
                  onClick={() => setPendingDelete(experience.id)}
                />
              </div>
            </div>

            <div className="form-grid">
              <Field label="公司" htmlFor={`ed-exp-company-${experience.id}`}>
                <input
                  id={`ed-exp-company-${experience.id}`}
                  className="input"
                  value={experience.company}
                  placeholder="例如 上海某内容科技公司"
                  maxLength={40}
                  onChange={(event) =>
                    patchExperience(experience.id, { company: event.target.value })
                  }
                />
              </Field>
              <Field label="职位" htmlFor={`ed-exp-title-${experience.id}`}>
                <input
                  id={`ed-exp-title-${experience.id}`}
                  className="input"
                  value={experience.title}
                  placeholder="例如 产品经理"
                  maxLength={30}
                  onChange={(event) =>
                    patchExperience(experience.id, { title: event.target.value })
                  }
                />
              </Field>
              <Field
                label="开始时间"
                htmlFor={`ed-exp-start-${experience.id}`}
                hint="格式 YYYY-MM"
              >
                <input
                  id={`ed-exp-start-${experience.id}`}
                  className="input num"
                  value={experience.startDate}
                  placeholder="2022-04"
                  maxLength={10}
                  onChange={(event) =>
                    patchExperience(experience.id, { startDate: event.target.value })
                  }
                />
              </Field>
              <Field
                label="结束时间"
                htmlFor={`ed-exp-end-${experience.id}`}
                hint="在职可填「至今」"
              >
                <input
                  id={`ed-exp-end-${experience.id}`}
                  className="input num"
                  value={experience.endDate}
                  placeholder="至今"
                  maxLength={10}
                  onChange={(event) =>
                    patchExperience(experience.id, { endDate: event.target.value })
                  }
                />
              </Field>
              <Field
                label="工作内容"
                htmlFor={`ed-exp-desc-${experience.id}`}
                className="full"
                hint="每行一条要点，尽量带数字。"
              >
                <textarea
                  id={`ed-exp-desc-${experience.id}`}
                  className="textarea ed-exp-textarea"
                  value={experience.description}
                  placeholder={"例如：\n负责内容社区的增长工具，上线后次日留存提升 8%。\n搭建内容侧指标体系与数据看板，支撑商业化改版。"}
                  onChange={(event) =>
                    patchExperience(experience.id, { description: event.target.value })
                  }
                />
              </Field>
            </div>

            <div className="ed-exp-foot">
              <Btn
                variant="secondary"
                size="sm"
                icon="sparkles"
                disabled={!job}
                title={
                  job
                    ? "对照目标岗位 JD 润色这段经历（消耗 1 点）"
                    : "先选择目标岗位，AI 才能对照 JD 润色"
                }
                onClick={() =>
                  onRewrite({
                    mode: "experience",
                    experienceId: experience.id,
                    label: `工作经历 ${index + 1}${experience.title ? ` · ${experience.title}` : ""}`,
                    original: experience.description,
                  })
                }
              >
                AI 润色（1 点）
              </Btn>
              {!job ? (
                <span className="t-11 t-muted">需要先在顶栏选择目标岗位</span>
              ) : (
                <span className="t-11 t-muted">
                  只润色你真实填写的内容，不会编造数字
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeExperience(pendingDelete);
        }}
        title="删除这段工作经历？"
        description="删除后 A4 预览会立即更新，且无法撤销。"
        confirmLabel="删除"
        tone="danger"
      />
    </SectionCard>
  );
}

/* -------------------------------- 教育经历 -------------------------------- */

export function EducationSection({
  resume,
  update,
}: {
  resume: Resume;
  update: DraftUpdate;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const educations = resume.educations;

  function addEducation() {
    const next: Education = {
      id: makeLocalId("ed"),
      school: "",
      degree: "",
      major: "",
      startDate: "",
      endDate: "",
    };
    update({ educations: [...educations, next] });
  }

  function patchEducation(id: string, patch: Partial<Education>) {
    update({
      educations: educations.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  return (
    <SectionCard
      id="education"
      title="教育经历"
      sub="写最高学历即可；学校、学历、专业都填上才算完成。"
      actions={
        <Btn variant="secondary" size="sm" icon="plus" onClick={addEducation}>
          添加教育
        </Btn>
      }
    >
      {educations.length === 0 ? (
        <div className="ed-inline-empty">
          <p className="ed-inline-empty-title">还没有教育经历</p>
          <p className="t-11 t-muted">补上学校与专业，完成度会提高 10%。</p>
          <Btn variant="secondary" size="sm" icon="plus" onClick={addEducation}>
            添加教育经历
          </Btn>
        </div>
      ) : null}

      <div className="ed-exp-list">
        {educations.map((education, index) => (
          <article className="ed-exp" key={education.id}>
            <div className="ed-exp-head">
              <span className="ed-exp-index num">教育 {index + 1}</span>
              <div className="ed-exp-actions">
                <IconBtn
                  label="删除这段教育经历"
                  icon="trash"
                  size={15}
                  onClick={() => setPendingDelete(education.id)}
                />
              </div>
            </div>

            <div className="form-grid">
              <Field label="学校" htmlFor={`ed-edu-school-${education.id}`}>
                <input
                  id={`ed-edu-school-${education.id}`}
                  className="input"
                  value={education.school}
                  placeholder="例如 华东师范大学"
                  maxLength={40}
                  onChange={(event) =>
                    patchEducation(education.id, { school: event.target.value })
                  }
                />
              </Field>
              <Field label="学历" htmlFor={`ed-edu-degree-${education.id}`}>
                <input
                  id={`ed-edu-degree-${education.id}`}
                  className="input"
                  value={education.degree}
                  placeholder="例如 本科"
                  maxLength={20}
                  onChange={(event) =>
                    patchEducation(education.id, { degree: event.target.value })
                  }
                />
              </Field>
              <Field
                label="专业"
                htmlFor={`ed-edu-major-${education.id}`}
                className="full"
              >
                <input
                  id={`ed-edu-major-${education.id}`}
                  className="input"
                  value={education.major}
                  placeholder="例如 信息管理与信息系统"
                  maxLength={40}
                  onChange={(event) =>
                    patchEducation(education.id, { major: event.target.value })
                  }
                />
              </Field>
              <Field label="开始时间" htmlFor={`ed-edu-start-${education.id}`} hint="格式 YYYY-MM">
                <input
                  id={`ed-edu-start-${education.id}`}
                  className="input num"
                  value={education.startDate}
                  placeholder="2015-09"
                  maxLength={10}
                  onChange={(event) =>
                    patchEducation(education.id, { startDate: event.target.value })
                  }
                />
              </Field>
              <Field label="结束时间" htmlFor={`ed-edu-end-${education.id}`} hint="格式 YYYY-MM">
                <input
                  id={`ed-edu-end-${education.id}`}
                  className="input num"
                  value={education.endDate}
                  placeholder="2019-06"
                  maxLength={10}
                  onChange={(event) =>
                    patchEducation(education.id, { endDate: event.target.value })
                  }
                />
              </Field>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            update({
              educations: educations.filter((item) => item.id !== pendingDelete),
            });
          }
        }}
        title="删除这段教育经历？"
        description="删除后 A4 预览会立即更新，且无法撤销。"
        confirmLabel="删除"
        tone="danger"
      />
    </SectionCard>
  );
}

/* ---------------------------------- 技能 ---------------------------------- */

export function SkillsSection({
  resume,
  update,
  missing,
  job,
  onPolishSkills,
  polishing = false,
  credits,
}: {
  resume: Resume;
  update: DraftUpdate;
  missing: string[];
  job?: { company: string; title: string };
  /** 调用 polishSkillsAction（EditorScreen 负责扣点与写回）。 */
  onPolishSkills?: () => void;
  polishing?: boolean;
  credits?: CreditsState;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cost = CREDIT_FEATURES.skills_polish.cost;
  const available = credits ? credits.dailyRemaining + credits.balance : null;
  const canAfford = available === null ? true : available >= cost;
  const polishDisabled = !job || polishing || !canAfford || !onPolishSkills;
  const polishHint = !job
    ? "先选择目标岗位，AI 才能按 JD 整理技能"
    : !canAfford
      ? `点数不足：本次需要 ${cost} 点，当前可用 ${available ?? 0} 点`
      : polishing
        ? "正在按岗位族与 JD 整理技能…"
        : `AI 按岗位族与 JD 整理技能（消耗 ${cost} 点）`;

  function addSkill(raw: string) {
    const skill = raw.trim();
    if (!skill) return;
    if (resume.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setError(`「${skill}」已经在技能里了`);
      return;
    }
    if (resume.skills.length >= 30) {
      setError("技能最多 30 个，先删掉几个不常用的");
      return;
    }
    setError(null);
    update({ skills: [...resume.skills, skill] });
    setValue("");
  }

  function removeSkill(skill: string) {
    update({ skills: resume.skills.filter((item) => item !== skill) });
  }

  return (
    <SectionCard
      id="skills"
      title="技能"
      sub="回车添加，点击 × 删除；技能会参与匹配度计算。"
      actions={
        <Btn
          variant="secondary"
          size="sm"
          icon="sparkles"
          loading={polishing}
          disabled={polishDisabled}
          title={polishHint}
          onClick={onPolishSkills}
        >
          AI 整理技能（{cost} 点）
        </Btn>
      }
    >
      <div className="ed-tag-input">
        <div className="ed-tags">
          {resume.skills.map((skill) => (
            <span className="ed-tag" key={skill}>
              <span className="truncate">{skill}</span>
              <button
                type="button"
                className="ed-tag-x"
                aria-label={`移除技能 ${skill}`}
                onClick={() => removeSkill(skill)}
              >
                <Icon name="close" size={11} />
              </button>
            </span>
          ))}
          <input
            className="ed-tag-field"
            value={value}
            placeholder={resume.skills.length ? "继续添加技能…" : "输入技能后回车，例如 数据分析"}
            aria-label="添加技能"
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSkill(value);
              } else if (event.key === "Backspace" && !value && resume.skills.length) {
                removeSkill(resume.skills[resume.skills.length - 1]);
              }
            }}
          />
        </div>
        <Btn
          variant="secondary"
          size="sm"
          icon="plus"
          disabled={!value.trim()}
          onClick={() => addSkill(value)}
        >
          添加
        </Btn>
      </div>
      {error ? (
        <div className="field-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="ed-ai-inline" role="note">
        <span className="ed-ai-inline-main">
          <Icon name="sparkles" size={13} />
          AI 整理技能消耗 {cost} 点
          {credits ? (
            <span className="t-muted">
              {" "}
              · 当前可用 {available} 点（免费 {credits.dailyRemaining} + 余额{" "}
              {credits.balance}）
            </span>
          ) : null}
        </span>
        {!canAfford ? (
          <Link className="ed-ai-inline-link" href="/dashboard/settings">
            去购买点数
          </Link>
        ) : !job ? (
          <span className="t-11 t-muted">先选择目标岗位</span>
        ) : null}
      </div>

      <div className="ed-skill-hint">
        <div className="ed-skill-hint-title">
          {job ? `「${job.company} · ${job.title}」还缺的关键词` : "JD 缺失关键词"}
        </div>
        {job ? (
          missing.length ? (
            <>
              <div className="chip-row">
                {missing.map((keyword) => (
                  <KeywordChip
                    key={keyword}
                    label={keyword}
                    state="missing"
                    onClick={() => addSkill(keyword)}
                  />
                ))}
              </div>
              <p className="t-11 t-muted">点击可直接加进技能，匹配度会随内容自动重算。</p>
            </>
          ) : (
            <p className="t-11 t-muted">这份 JD 的关键词已经全部覆盖了。</p>
          )
        ) : (
          <p className="t-11 t-muted">顶栏选择目标岗位后，这里会列出 JD 里还没覆盖的关键词。</p>
        )}
      </div>
    </SectionCard>
  );
}

/* ---------------------------------- 照片 ---------------------------------- */

export function PhotoSection({
  resume,
  update,
  toast,
  photoPreview,
  onPhotoPreviewChange,
}: {
  resume: Resume;
  update: DraftUpdate;
  toast: (input: ToastInput) => void;
  /** 本地选择的照片（data URL），由编辑器统一持有，A4 预览与 PDF 导出共用。 */
  photoPreview: string | null;
  onPhotoPreviewChange: (next: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initial = (resume.fullName.trim() || "林").slice(0, 1);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "只能选择图片文件",
        description: "支持 JPG / PNG，演示环境不会上传。",
        tone: "negative",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "图片太大了",
        description: "请选择 4MB 以内的图片。",
        tone: "negative",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onPhotoPreviewChange(typeof reader.result === "string" ? reader.result : null);
      toast({
        title: "已载入本地预览",
        description: "照片只会加入本次 A4 预览与导出，不会上传服务器。",
        tone: "positive",
      });
    };
    reader.onerror = () => {
      toast({ title: "读取图片失败", description: "换一张图片再试试。", tone: "negative" });
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    onPhotoPreviewChange(null);
    if (resume.photoInitials) update({ photoInitials: undefined });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <SectionCard
      id="photo"
      title="照片"
      sub="选择照片后会实时出现在右侧 A4 预览，并随「导出 PDF」一起导出；当前未配置对象存储，照片不会保存到账号。"
    >
      <div className="ed-photo-row">
        {photoPreview ? (
          <div
            className="ed-photo-preview"
            role="img"
            aria-label="本地照片预览"
            style={{ backgroundImage: `url(${photoPreview})` }}
          />
        ) : (
          <div className="ed-photo-placeholder" aria-hidden="true">
            {resume.photoInitials ? (
              <span className="ed-photo-initial">{resume.photoInitials}</span>
            ) : (
              <Icon name="user" size={26} />
            )}
          </div>
        )}

        <div className="ed-photo-main">
          <div className="ed-photo-actions">
            <Btn
              variant="secondary"
              size="sm"
              icon="upload"
              onClick={() => fileRef.current?.click()}
            >
              本地选择照片
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              icon="trash"
              disabled={!photoPreview && !resume.photoInitials}
              onClick={removePhoto}
            >
              移除
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="选择本地照片"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <div className="ed-photo-meta">
            {resume.photoInitials ? (
              <span className="t-11 t-muted">
                已启用首字母头像「{resume.photoInitials}」，会显示在 A4 页眉。
              </span>
            ) : (
              <span className="t-11 t-muted">
                不常放照片也没关系；需要时可用首字母头像占位。
              </span>
            )}
            {resume.photoInitials ? (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => update({ photoInitials: undefined })}
              >
                从 A4 中移除头像
              </Btn>
            ) : (
              <Btn
                variant="ghost"
                size="sm"
                disabled={!resume.fullName.trim()}
                title={resume.fullName.trim() ? undefined : "先填写姓名"}
                onClick={() => update({ photoInitials: initial })}
              >
                在 A4 中显示首字母头像
              </Btn>
            )}
          </div>
          <p className="t-11 t-faint">
            照片只存在当前编辑会话（FileReader，不会上传服务器）；刷新页面后需重新选择。配置 Neon Storage 后即可保存到账号。
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
