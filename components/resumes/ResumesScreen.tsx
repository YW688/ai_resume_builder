"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import {
  byUpdatedDesc,
  computeCompletion,
  computeMatch,
  formatRelative,
} from "@/lib/mock/compute";
import type { Resume, ResumeStatus } from "@/lib/mock/types";
import {
  Btn,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
} from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import {
  NewResumeButton,
  NewResumeDialog,
} from "@/components/app/NewResumeDialog";
import { ResumeCard } from "./ResumeCard";
import "./resumes.css";

type StatusFilter = "all" | ResumeStatus;
type SortKey = "updated" | "match" | "completion";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "ready", label: "可投递" },
  { value: "applied", label: "已投递" },
  { value: "archived", label: "已归档" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "最近更新" },
  { value: "match", label: "匹配度" },
  { value: "completion", label: "完成度" },
];

export function ResumesScreen() {
  const {
    state,
    resume: findResume,
    updateResume,
    duplicateResume,
    deleteResume,
    toast,
  } = useWorkspace();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Resume | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resume | null>(null);

  const rows = useMemo(
    () =>
      state.resumes.map((item) => {
        const targetJob = item.targetJobId
          ? state.jobs.find((job) => job.id === item.targetJobId)
          : undefined;
        return {
          resume: item,
          job: targetJob,
          matchScore: targetJob ? computeMatch(item, targetJob).score : null,
          completion: computeCompletion(item),
        };
      }),
    [state.resumes, state.jobs],
  );

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: state.resumes.length,
      draft: 0,
      ready: 0,
      applied: 0,
      archived: 0,
    };
    for (const item of state.resumes) base[item.status] += 1;
    return base;
  }, [state.resumes]);

  const latestUpdated = useMemo(() => {
    const latest = [...state.resumes].sort(byUpdatedDesc)[0];
    return latest ? formatRelative(latest.updatedAt) : null;
  }, [state.resumes]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = rows.filter(({ resume, job }) => {
      if (filter !== "all" && resume.status !== filter) return false;
      if (!keyword) return true;
      const haystack = `${resume.title} ${
        job ? `${job.company} ${job.title}` : ""
      }`.toLowerCase();
      return haystack.includes(keyword);
    });
    return list.sort((a, b) => {
      if (sort === "match") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if (sort === "completion") return b.completion - a.completion;
      return byUpdatedDesc(a.resume, b.resume);
    });
  }, [rows, filter, query, sort]);

  const emptyLibrary = state.resumes.length === 0;

  function openRename(resume: Resume) {
    setRenameTarget(resume);
    setRenameValue(resume.title);
    setRenameError(null);
  }

  function saveRename() {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) {
      setRenameError("请输入简历名称");
      return;
    }
    if (title.length > 40) {
      setRenameError("简历名称请控制在 40 个字以内");
      return;
    }
    updateResume(renameTarget.id, { title });
    toast({ title: "已重命名简历", description: `现在叫「${title}」。` });
    setRenameTarget(null);
  }

  function duplicate(resume: Resume) {
    const id = duplicateResume(resume.id);
    if (!id) {
      toast({
        title: "复制失败",
        description: "没有找到要复制的简历。",
        tone: "negative",
      });
      return;
    }
    const copy = findResume(id);
    toast({
      title: "已复制简历",
      description: `「${copy?.title ?? `${resume.title} 副本`}」已加入简历库。`,
      tone: "positive",
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteResume(deleteTarget.id);
    toast({
      title: "已删除简历",
      description: `「${deleteTarget.title}」已从简历库移除。`,
    });
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">简历库</h1>
          <p className="page-sub">
            共 {state.resumes.length} 份
            {latestUpdated ? ` · 最近更新 ${latestUpdated}` : ""}
          </p>
        </div>
        <div className="page-actions">
          <NewResumeButton label="新建简历" />
        </div>
      </div>

      {!emptyLibrary ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-body" style={{ padding: "12px 16px" }}>
            <div
              className="row-between"
              style={{ flexWrap: "wrap", gap: 12 }}
            >
              <div
                className="row"
                style={{ flexWrap: "wrap", gap: 10, flex: "1 1 360px" }}
              >
                <div className="searchbox" style={{ maxWidth: 280 }}>
                  <Icon
                    name="search"
                    size={15}
                    className="search-icon"
                  />
                  <input
                    className="input"
                    type="search"
                    value={query}
                    placeholder="搜索简历标题或目标岗位"
                    aria-label="搜索简历"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="chip-row">
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`chip${filter === item.value ? " is-active" : ""}`}
                      aria-pressed={filter === item.value}
                      onClick={() => setFilter(item.value)}
                    >
                      {item.label}
                      <span className="chip-count">{counts[item.value]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="row" style={{ gap: 6 }}>
                <span className="t-11 t-muted">排序</span>
                <select
                  className="select select-sm"
                  value={sort}
                  aria-label="排序方式"
                  onChange={(event) =>
                    setSort(event.target.value as SortKey)
                  }
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {emptyLibrary ? (
        <div className="panel">
          <div className="panel-body">
            <EmptyState
              icon="file"
              title="简历库还是空的"
              description="新建一份简历，设置目标岗位后就能看到匹配度与完成度。"
              action={<NewResumeButton variant="secondary" />}
            />
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <EmptyState
              icon="search"
              title="没有符合条件的简历"
              description="换一个关键词，或清除当前的筛选条件再试试。"
              action={
                <Btn variant="secondary" onClick={clearFilters}>
                  清除筛选
                </Btn>
              }
            />
          </div>
        </div>
      ) : (
        <div className="resume-grid">
          {visible.map(({ resume, job }) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              job={job}
              onRename={() => openRename(resume)}
              onDuplicate={() => duplicate(resume)}
              onDelete={() => setDeleteTarget(resume)}
            />
          ))}
          <button
            type="button"
            className="dashed-add"
            style={{ height: "100%", minHeight: 200 }}
            onClick={() => setNewOpen(true)}
          >
            <Icon name="plus" size={20} />
            <span>新建简历</span>
            <span className="t-11 t-faint">标题、目标岗位、模板</span>
          </button>
        </div>
      )}

      <NewResumeDialog open={newOpen} onClose={() => setNewOpen(false)} />

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="重命名简历"
        description="名称只用于简历库区分，不会出现在简历正文里。"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRenameTarget(null)}>
              取消
            </Btn>
            <Btn variant="primary" onClick={saveRename}>
              保存
            </Btn>
          </>
        }
      >
        <Field label="简历名称" error={renameError ?? undefined}>
          <input
            className="input"
            value={renameValue}
            maxLength={40}
            autoFocus
            placeholder="例如「产品经理 · 字节」"
            onChange={(event) => {
              setRenameValue(event.target.value);
              setRenameError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveRename();
              }
            }}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除这份简历？"
        description={
          deleteTarget
            ? `「${deleteTarget.title}」删除后不可恢复，关联的投递记录也会一并移除。`
            : undefined
        }
        confirmLabel="删除简历"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </>
  );
}
