"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import { bestMatchForJob, formatDate } from "@/lib/mock/compute";
import { Btn, ConfirmDialog, EmptyState } from "@/components/app/ui";
import { JobDetail } from "./JobDetail";
import { PasteJdDialog } from "./PasteJdDialog";
import "./jobs.css";

/**
 * 目标岗位（DESIGN §6.3）：左 5/12 岗位列表 + 右 7/12 详情，窄屏自动堆叠。
 */
export function JobsScreen() {
  const { state, deleteJob, toast } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      state.jobs
        .map((job) => ({
          job,
          best: bestMatchForJob(state.resumes, job),
        }))
        .sort(
          (a, b) =>
            new Date(b.job.savedAt).getTime() -
            new Date(a.job.savedAt).getTime(),
        ),
    [state.jobs, state.resumes],
  );

  const selectedJob =
    state.jobs.find((job) => job.id === selectedId) ?? entries[0]?.job;

  const keywordCoverage = useMemo(
    () => new Set(state.jobs.flatMap((job) => job.keywords)).size,
    [state.jobs],
  );

  const keywordStats = useMemo(() => {
    const frequency = new Map<string, number>();
    for (const job of state.jobs) {
      for (const keyword of job.keywords) {
        frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1);
      }
    }
    return [...frequency.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 8);
  }, [state.jobs]);

  const deleteTarget = state.jobs.find((job) => job.id === deleteTargetId);
  const linkedResumeCount = deleteTarget
    ? state.resumes.filter((resume) => resume.targetJobId === deleteTarget.id)
        .length
    : 0;

  function handleSaved(id: string) {
    setSelectedId(id);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const label = `${deleteTarget.company} · ${deleteTarget.title}`;
    deleteJob(deleteTarget.id);
    if (selectedId === deleteTarget.id) setSelectedId(null);
    toast({
      title: "已删除目标岗位",
      description: `「${label}」已移除，相关简历的目标岗位已清空。`,
    });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">目标岗位</h1>
          <p className="page-sub">
            已保存 {state.jobs.length} 个岗位 · 覆盖 {keywordCoverage} 个关键词
          </p>
        </div>
        <div className="page-actions">
          <Btn
            variant="primary"
            icon="plus"
            onClick={() => setPasteOpen(true)}
          >
            粘贴 JD
          </Btn>
        </div>
      </div>

      <div className="jobs-layout">
        <div className="jobs-col-list jobs-stack">
        <section
          className="panel"
          aria-labelledby="jobs-list-title"
        >
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="jobs-list-title">
                岗位列表
              </h2>
              <p className="panel-sub">{state.jobs.length} 个已保存岗位</p>
            </div>
            <span className="t-11 t-faint">按保存时间</span>
          </div>
          <div className="panel-body">
            {state.jobs.length === 0 ? (
              <EmptyState
                icon="target"
                title="还没有目标岗位"
                description="粘贴一份 JD，保存后就能对照关键词检查简历还差什么。"
                action={
                  <Btn
                    variant="secondary"
                    icon="plus"
                    onClick={() => setPasteOpen(true)}
                  >
                    粘贴 JD
                  </Btn>
                }
              />
            ) : (
              <div className="jobs-list">
                {entries.map(({ job, best }) => {
                  const active = selectedJob?.id === job.id;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      aria-label={`查看 ${job.company} · ${job.title}`}
                      className={`job-row${active ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(job.id)}
                    >
                      <span
                        className="list-title truncate"
                        style={{ display: "block" }}
                      >
                        {job.company} · {job.title}
                      </span>
                      <span
                        className="list-sub truncate"
                        style={{ display: "block" }}
                      >
                        {job.location} · {job.salary}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                          marginTop: 5,
                        }}
                      >
                        <span className="t-11 t-faint">
                          保存于 {formatDate(job.savedAt)}
                        </span>
                        <span className="t-11 t-muted">
                          最佳匹配{" "}
                          <span
                            className="num fw-600"
                            style={{
                              color: best
                                ? "var(--ui-accent)"
                                : "var(--ui-faint)",
                            }}
                          >
                            {best ? best.score : "—"}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {state.jobs.length > 0 ? (
            <div className="panel-foot">
              <span>点击岗位查看命中详情</span>
              <span className="t-11 t-faint">缺失词可一键加入技能</span>
            </div>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="jobs-keywords-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="jobs-keywords-title">
                关键词速览
              </h2>
              <p className="panel-sub">在这些岗位里出现最多的要求</p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 12 }}>
            {keywordStats.length ? (
              <div className="chip-row">
                {keywordStats.map(([keyword, count]) => (
                  <span key={keyword} className="chipless">
                    {keyword}
                    <span className="chip-count">{count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="t-12 t-muted">保存目标岗位后，这里会汇总高频关键词。</p>
            )}
            <p className="t-11 t-muted" style={{ marginTop: 12 }}>
              点开右侧详情，可以把缺失词直接加入最佳匹配简历的技能。
            </p>
          </div>
        </section>
        </div>

        {selectedJob ? (
          <div className="jobs-col-detail">
            <JobDetail
              job={selectedJob}
              resumes={state.resumes}
              onRequestDelete={() => setDeleteTargetId(selectedJob.id)}
            />
          </div>
        ) : (
          <section
            className="panel jobs-col-detail"
            aria-label="岗位详情"
          >
            <div className="panel-body">
              <EmptyState
                icon="target"
                title="选择一个岗位查看详情"
                description="左侧保存的目标岗位会在这里展示关键词命中情况与匹配的简历。"
                action={
                  <Btn
                    variant="secondary"
                    icon="plus"
                    onClick={() => setPasteOpen(true)}
                  >
                    粘贴 JD
                  </Btn>
                }
              />
            </div>
          </section>
        )}
      </div>

      <PasteJdDialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== undefined}
        onClose={() => setDeleteTargetId(null)}
        title="删除这个目标岗位？"
        description={
          deleteTarget
            ? linkedResumeCount > 0
              ? `「${deleteTarget.company} · ${deleteTarget.title}」当前有 ${linkedResumeCount} 份简历把它设为目标岗位，删除后这些简历的目标岗位会被清空（简历内容与投递记录不受影响）。`
              : `「${deleteTarget.company} · ${deleteTarget.title}」将从目标岗位列表中移除。`
            : undefined
        }
        confirmLabel="删除岗位"
        tone="danger"
        onConfirm={confirmDelete}
      />
    </>
  );
}
