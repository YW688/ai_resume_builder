"use client";

/* 本文件在挂载后同步 localStorage 演示数据与草稿状态，属于外部存储同步，非渲染派生状态。 */
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { A4Page } from "@/components/app/A4Page";
import { NewResumeButton } from "@/components/app/NewResumeDialog";
import { Btn, EmptyState, IconBtn, Pill, Progress } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import {
  computeCompletion,
  computeMatch,
  formatTime,
  mostRecentResume,
} from "@/lib/mock/compute";
import { useWorkspace } from "@/lib/mock/store";
import type {
  AccentId,
  Resume,
  TemplateId,
} from "@/lib/mock/types";
import {
  BasicInfoSection,
  EducationSection,
  ExperienceSection,
  PhotoSection,
  SkillsSection,
  SummarySection,
} from "./FormSections";
import { EditorPreview } from "./EditorPreview";
import { RewriteDialog, type RewriteTarget } from "./RewriteDialog";
import { TemplateDialog } from "./TemplateDialog";

type SectionId = "basic" | "summary" | "experience" | "education" | "skills" | "photo";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "basic", label: "基本信息" },
  { id: "summary", label: "求职总结" },
  { id: "experience", label: "工作经历" },
  { id: "education", label: "教育经历" },
  { id: "skills", label: "技能" },
  { id: "photo", label: "照片" },
];

const SAVE_DELAY = 600;
const FALLBACK_SETTLE = 350;

/** 只把内容字段写回 store；状态 / 时间戳由 store 负责。 */
function toPatch(value: Resume): Partial<Resume> {
  return {
    title: value.title,
    targetJobId: value.targetJobId,
    fullName: value.fullName,
    phone: value.phone,
    email: value.email,
    city: value.city,
    summary: value.summary,
    skills: value.skills,
    experiences: value.experiences,
    educations: value.educations,
    templateId: value.templateId,
    accent: value.accent,
    photoInitials: value.photoInitials,
  };
}

function cloneResume(value: Resume): Resume {
  return JSON.parse(JSON.stringify(value)) as Resume;
}

function BootSkeleton({ label }: { label: string }) {
  return (
    <div className="editor-root" aria-busy="true" aria-label={label}>
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

export function EditorScreen() {
  const searchParams = useSearchParams();
  const {
    state,
    resume: findResume,
    job: findJob,
    updateResume,
    recordAiRewrite,
    recordExport,
    toast,
  } = useWorkspace();

  const requestedId = searchParams.get("id");
  const printRequested = searchParams.get("print") === "1";

  const requestedResume = requestedId ? findResume(requestedId) : undefined;
  const fallbackResume = mostRecentResume(state.resumes) ?? state.resumes[0];

  // 无效 id：先给 localStorage 水合一点时间，再回退到最近更新的简历。
  const [pendingFallback, setPendingFallback] = useState(
    Boolean(requestedId) && !requestedResume,
  );
  useEffect(() => {
    if (!requestedId || requestedResume) {
      setPendingFallback(false);
      return;
    }
    setPendingFallback(true);
    const timer = setTimeout(() => setPendingFallback(false), FALLBACK_SETTLE);
    return () => clearTimeout(timer);
  }, [requestedId, requestedResume]);

  const resolved = requestedResume ?? (pendingFallback ? undefined : fallbackResume);

  const [draft, setDraft] = useState<Resume | null>(null);
  const draftRef = useRef<Resume | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedAtRef = useRef<string | null>(null);

  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [savedClock, setSavedClock] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("basic");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [highlight, setHighlight] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [rewriteTarget, setRewriteTarget] = useState<RewriteTarget | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  const scrollRef = useRef<HTMLElement | null>(null);
  const spySuppressedRef = useRef(false);
  const spyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackNotifiedRef = useRef(false);
  const autoPrintRef = useRef(false);
  const exportRef = useRef<() => void>(() => {});

  /* ------------------------------ 与 store 同步 ----------------------------- */

  useEffect(() => {
    if (!resolved) {
      draftRef.current = null;
      dirtyRef.current = false;
      setDraft(null);
      return;
    }
    const current = draftRef.current;
    const isSameResume = current?.id === resolved.id;
    const externalChange =
      !dirtyRef.current && lastSyncedAtRef.current !== resolved.updatedAt;
    if (isSameResume && !externalChange) return;

    const next = cloneResume(resolved);
    draftRef.current = next;
    lastSyncedAtRef.current = resolved.updatedAt;
    dirtyRef.current = false;
    setDraft(next);
    setSaveState("saved");
    setSavedClock(formatTime(resolved.updatedAt));
    setEditingTitle(false);
  }, [resolved]);

  const flushSave = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    updateResume(current.id, toPatch(current));
    dirtyRef.current = false;
    setSavedClock(formatTime(new Date().toISOString()));
    setSaveState("saved");
  }, [updateResume]);

  // 离开编辑器 / 关闭标签页时，把未落盘的改动写回 store。
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const current = draftRef.current;
      if (current && dirtyRef.current) updateResume(current.id, toPatch(current));
    };
  }, [updateResume]);

  function patchDraft(patch: Partial<Resume>) {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    draftRef.current = next;
    dirtyRef.current = true;
    setDraft(next);
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DELAY);
  }

  /* --------------------------------- 派生 --------------------------------- */

  const targetJob = draft?.targetJobId ? findJob(draft.targetJobId) : undefined;
  const match = draft && targetJob ? computeMatch(draft, targetJob) : null;
  const completion = draft ? computeCompletion(draft) : 0;
  const previewKeywords = targetJob?.keywords ?? [];

  const sectionDone = useMemo(() => {
    if (!draft) return null;
    return {
      basic: Boolean(
        draft.fullName.trim() &&
          draft.phone.trim() &&
          draft.email.trim() &&
          draft.city.trim(),
      ),
      summary: draft.summary.trim().length >= 40,
      experience: draft.experiences.some(
        (item) =>
          item.company.trim() &&
          item.title.trim() &&
          item.description.trim().length >= 30,
      ),
      education: draft.educations.some(
        (item) => item.school.trim() && item.degree.trim() && item.major.trim(),
      ),
      skills: draft.skills.filter((item) => item.trim()).length >= 3,
      photo: Boolean(draft.photoInitials),
    } satisfies Record<SectionId, boolean>;
  }, [draft]);

  /* -------------------------------- 无效 id 回退 ------------------------------- */

  useEffect(() => {
    if (!requestedId || pendingFallback || requestedResume) return;
    if (fallbackNotifiedRef.current) return;
    fallbackNotifiedRef.current = true;
    if (fallbackResume) {
      toast({
        title: "没有找到这份简历",
        description: "已回退到最近更新的简历。",
      });
    }
  }, [requestedId, pendingFallback, requestedResume, fallbackResume, toast]);

  /* --------------------------------- 导出 --------------------------------- */

  function handleExport() {
    flushSave();
    recordExport();
    toast({
      title: "已打开打印对话框",
      description: "选择「另存为 PDF」，纸张 A4、边距设为无，即得到可投递的 PDF。",
    });
    setTimeout(() => window.print(), 80);
  }

  useEffect(() => {
    exportRef.current = handleExport;
  });

  useEffect(() => {
    if (!printRequested || !draft || autoPrintRef.current) return;
    const timer = setTimeout(() => {
      if (autoPrintRef.current) return;
      autoPrintRef.current = true;
      exportRef.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [printRequested, draft]);

  /* --------------------------------- AI 改写 -------------------------------- */

  function applyRewrite(text: string) {
    const target = rewriteTarget;
    const current = draftRef.current;
    if (!target || !current) return;
    const next =
      target.mode === "summary"
        ? { ...current, summary: text }
        : {
            ...current,
            experiences: current.experiences.map((item) =>
              item.id === target.experienceId
                ? { ...item, description: text }
                : item,
            ),
          };
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    draftRef.current = next;
    dirtyRef.current = false;
    setDraft(next);
    updateResume(next.id, toPatch(next));
    recordAiRewrite();
    setSavedClock(formatTime(new Date().toISOString()));
    setSaveState("saved");
    toast({
      title: "已应用改写",
      description: "本次使用 1 次 AI 改写，内容已保存。",
      tone: "positive",
    });
  }

  function applyTemplate(patch: { templateId: TemplateId; accent: AccentId }) {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    draftRef.current = next;
    dirtyRef.current = false;
    setDraft(next);
    updateResume(next.id, patch);
    setSavedClock(formatTime(new Date().toISOString()));
    setSaveState("saved");
    toast({
      title: "已应用模板",
      description: "预览已更新，简历内容不变。",
      tone: "positive",
    });
  }

  /* --------------------------------- 标题 --------------------------------- */

  function startRename() {
    if (!draft) return;
    setTitleValue(draft.title);
    setEditingTitle(true);
  }

  function commitRename() {
    const current = draftRef.current;
    setEditingTitle(false);
    if (!current) return;
    const next = titleValue.trim().slice(0, 40) || current.title || "未命名简历";
    if (next !== current.title) patchDraft({ title: next });
  }

  /* -------------------------------- 段落导航 -------------------------------- */

  function goSection(id: SectionId) {
    setActiveSection(id);
    const root = scrollRef.current;
    const node = document.getElementById(`ed-section-${id}`);
    if (!root || !node) return;

    // 只滚动中栏这个滚动容器。不能用 scrollIntoView：它会连带把
    // .editor-root 这个 overflow:hidden 的外壳也程序化滚动，导致整页被顶飞、
    // 滚轮回不来（用户反馈的“点照片卡在最底部”）。
    const rootRect = root.getBoundingClientRect();
    const nodeTop =
      node.getBoundingClientRect().top - rootRect.top + root.scrollTop;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    const target = Math.min(maxScroll, Math.max(0, nodeTop - 12));

    // 平滑滚动期间先暂停滚动监听，避免导航高亮沿途乱跳、看起来像闪跳。
    spySuppressedRef.current = true;
    if (spyTimerRef.current) clearTimeout(spyTimerRef.current);
    spyTimerRef.current = setTimeout(() => {
      spySuppressedRef.current = false;
      spyTimerRef.current = null;
    }, 700);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
  }

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !draft) return;

    // 用滚动位置计算当前段落，而不是 IntersectionObserver：
    // 旧的 rootMargin 触区太窄，页首 / 页尾会漏判（高亮停在“求职总结”，
    // 点“照片”时又停在“教育经历”），滚动时还会来回闪。
    let frame = 0;
    const computeActive = () => {
      frame = 0;
      if (spySuppressedRef.current) return;
      const maxScroll = root.scrollHeight - root.clientHeight;
      if (maxScroll > 0 && root.scrollTop >= maxScroll - 4) {
        const last = SECTIONS[SECTIONS.length - 1].id;
        setActiveSection((current) => (current === last ? current : last));
        return;
      }
      const rootTop = root.getBoundingClientRect().top;
      let current = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const node = document.getElementById(`ed-section-${section.id}`);
        if (!node) continue;
        const top =
          node.getBoundingClientRect().top - rootTop + root.scrollTop;
        if (top <= root.scrollTop + 64) current = section.id;
      }
      setActiveSection((previous) => (previous === current ? previous : current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(computeActive);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [draft?.id]);

  useEffect(
    () => () => {
      if (spyTimerRef.current) clearTimeout(spyTimerRef.current);
    },
    [],
  );

  /* --------------------------------- 渲染 --------------------------------- */

  if (pendingFallback) {
    return <BootSkeleton label="正在打开简历" />;
  }

  if (!draft) {
    return (
      <div className="editor-root">
        <header className="ed-topbar">
          <Link className="ed-back" href="/dashboard" aria-label="返回工作台">
            <Icon name="arrowLeft" size={18} />
          </Link>
          <span className="ed-empty-heading">简历编辑器</span>
        </header>
        <div className="ed-empty-wrap">
          <EmptyState
            icon="fileText"
            title={state.resumes.length ? "没有可编辑的简历" : "还没有简历"}
            description={
              state.resumes.length
                ? "当前简历可能已被删除。回到简历库，或直接新建一份继续。"
                : "新建一份简历，填写基本信息后就能实时看到 A4 效果，并对照 JD 改写。"
            }
            action={<NewResumeButton />}
          />
        </div>
      </div>
    );
  }

  const jobOptions = state.jobs.map((item) => (
    <option key={item.id} value={item.id}>
      {item.company} · {item.title}
    </option>
  ));

  return (
    <div className="editor-root">
      <header className="ed-topbar">
        <Link className="ed-back" href="/dashboard" aria-label="返回工作台">
          <Icon name="arrowLeft" size={18} />
        </Link>

        <h1 className="ed-title-wrap">
          {editingTitle ? (
            <input
              className="ed-title-input"
              value={titleValue}
              maxLength={40}
              autoFocus
              aria-label="简历标题"
              onChange={(event) => setTitleValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="ed-title-btn"
              title="点击重命名简历"
              aria-label={`重命名简历「${draft.title}」`}
              onClick={startRename}
            >
              <span className="ed-title-text">{draft.title}</span>
              <Icon name="edit" size={13} className="ed-title-edit" />
            </button>
          )}
        </h1>

        <span
          className={`ed-save${saveState === "saving" ? " is-saving" : ""}`}
          aria-live="polite"
        >
          <Icon
            name={saveState === "saving" ? "refresh" : "checkCircle"}
            size={13}
          />
          {saveState === "saving" ? "保存中…" : `已保存 · ${savedClock}`}
        </span>

        <div className="ed-topbar-right">
          <select
            className="select select-sm ed-job-select"
            aria-label="目标岗位"
            value={draft.targetJobId ?? ""}
            onChange={(event) => patchDraft({ targetJobId: event.target.value || null })}
          >
            <option value="">未设目标岗位</option>
            {jobOptions}
          </select>

          {targetJob && match ? (
            <Pill tone="accent">匹配度 {match.score}</Pill>
          ) : (
            <Pill tone="outline">未设岗位</Pill>
          )}

          <Btn
            variant="secondary"
            size="sm"
            icon="eye"
            className="ed-preview-toggle"
            onClick={() => setPreviewOpen(true)}
          >
            预览
          </Btn>

          <Btn variant="primary" icon="download" onClick={handleExport}>
            导出 PDF
          </Btn>
        </div>
      </header>

      {/* 移动端：目标岗位与匹配度单独一行，避免顶栏溢出 */}
      <div className="ed-mobile-bar">
        <select
          className="select ed-job-select"
          aria-label="目标岗位"
          value={draft.targetJobId ?? ""}
          onChange={(event) => patchDraft({ targetJobId: event.target.value || null })}
        >
          <option value="">未设目标岗位</option>
          {jobOptions}
        </select>
        {targetJob && match ? (
          <Pill tone="accent">匹配度 {match.score}</Pill>
        ) : (
          <Pill tone="outline">未设岗位</Pill>
        )}
      </div>

      <div className="ed-body">
        <aside className="ed-rail" aria-label="段落导航">
          <div className="ed-rail-top">
            <p className="ed-rail-label">简历内容</p>
            <nav className="ed-nav">
              {SECTIONS.map((section) => {
                const done = sectionDone?.[section.id] ?? false;
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`ed-nav-item${active ? " is-active" : ""}`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => goSection(section.id)}
                  >
                    <span className="ed-nav-label">{section.label}</span>
                    <span
                      className={`ed-nav-dot${done ? " is-done" : ""}`}
                      role="img"
                      aria-label={done ? "已完成" : "待补充"}
                    />
                  </button>
                );
              })}
              <button
                type="button"
                className="ed-nav-item ed-rail-mobile-only"
                onClick={() => setTemplateOpen(true)}
              >
                <span className="ed-nav-label">模板与主色</span>
                <Icon name="sliders" size={14} />
              </button>
            </nav>
          </div>

          <div className="ed-rail-foot">
            <Btn
              variant="secondary"
              size="sm"
              icon="sliders"
              block
              onClick={() => setTemplateOpen(true)}
            >
              模板与主色
            </Btn>
            <div className="ed-rail-progress">
              <div className="ed-rail-progress-meta">
                <span>完成度</span>
                <span className="num">{completion}%</span>
              </div>
              <Progress value={completion} />
            </div>
          </div>
        </aside>

        <main className="ed-main" ref={scrollRef}>
          <form
            className="ed-form"
            noValidate
            onSubmit={(event) => event.preventDefault()}
          >
            <BasicInfoSection resume={draft} update={patchDraft} />
            <SummarySection
              resume={draft}
              update={patchDraft}
              job={targetJob}
              onRewrite={setRewriteTarget}
            />
            <ExperienceSection
              resume={draft}
              update={patchDraft}
              job={targetJob}
              onRewrite={setRewriteTarget}
            />
            <EducationSection resume={draft} update={patchDraft} />
            <SkillsSection
              resume={draft}
              update={patchDraft}
              missing={match?.missing ?? []}
              job={targetJob}
            />
            <PhotoSection resume={draft} update={patchDraft} toast={toast} />
            <p className="ed-form-foot">
              演示工作区 · 内容只保存在本机浏览器 · 编辑后 600ms 自动保存
            </p>
          </form>
        </main>

        <aside className="ed-preview" aria-label="A4 实时预览">
          <EditorPreview
            resume={draft}
            job={targetJob}
            keywords={previewKeywords}
            highlight={highlight}
            zoom={zoom}
            onZoomChange={setZoom}
            onToggleHighlight={setHighlight}
            onPrint={handleExport}
          />
        </aside>
      </div>

      {previewOpen ? (
        <div className="ed-overlay" role="dialog" aria-modal="true" aria-label="简历预览">
          <div className="ed-overlay-head">
            <span className="ed-overlay-title">
              <Icon name="eye" size={15} />
              <span className="truncate">预览 · {draft.title}</span>
            </span>
            <div className="row">
              <Btn variant="secondary" size="sm" icon="printer" onClick={handleExport}>
                导出 PDF
              </Btn>
              <IconBtn
                label="关闭预览"
                icon="close"
                onClick={() => setPreviewOpen(false)}
              />
            </div>
          </div>
          <EditorPreview
            resume={draft}
            job={targetJob}
            keywords={previewKeywords}
            highlight={highlight}
            zoom={zoom}
            onZoomChange={setZoom}
            onToggleHighlight={setHighlight}
            onPrint={handleExport}
            overlay
          />
        </div>
      ) : null}

      <TemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        resume={draft}
        jobTitle={targetJob?.title}
        onApply={applyTemplate}
      />

      <RewriteDialog
        open={Boolean(rewriteTarget)}
        target={rewriteTarget}
        resume={draft}
        job={targetJob}
        onClose={() => setRewriteTarget(null)}
        onApply={applyRewrite}
      />

      {/* 打印只输出这一张无缩放的 A4 页（样式见 app-ui.css 的 @media print） */}
      <div className="print-only">
        <A4Page resume={draft} job={targetJob?.title} />
      </div>
    </div>
  );
}
