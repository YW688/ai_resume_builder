"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/mock/store";
import {
  bestMatchForJob,
  computeMatch,
  formatRelative,
} from "@/lib/mock/compute";
import type { Job, Resume } from "@/lib/mock/types";
import { highlightText } from "@/components/app/A4Page";
import { Btn, KeywordChip } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";

export type JobDetailProps = {
  job: Job;
  resumes: Resume[];
  onRequestDelete: () => void;
};

/**
 * 目标岗位详情（DESIGN §6.3）：元信息 + 操作 + 关键词命中/缺失 + 匹配简历 +
 * JD 原文高亮。命中/缺失与匹配度全部来自 compute.ts。
 */
export function JobDetail({ job, resumes, onRequestDelete }: JobDetailProps) {
  const router = useRouter();
  const { updateResume, toast } = useWorkspace();

  const best = bestMatchForJob(resumes, job);
  const match = best
    ? computeMatch(best.resume, job)
    : { score: 0, hit: [] as string[], missing: job.keywords };

  const ranked = resumes
    .map((resume) => ({ resume, score: computeMatch(resume, job).score }))
    .sort((a, b) => b.score - a.score);

  function rewriteWithJob() {
    if (!best) return;
    router.push(`/editor?id=${best.resume.id}`);
  }

  function addKeyword(keyword: string) {
    if (!best) return;
    updateResume(best.resume.id, {
      skills: Array.from(new Set([...best.resume.skills, keyword])),
    });
    toast({
      title: "已加入技能",
      description: `「${keyword}」已加入「${best.resume.title}」的技能，匹配度已重新计算。`,
      tone: "positive",
    });
  }

  return (
    <section className="panel" style={{ minWidth: 0 }} aria-labelledby="job-detail-title">
      <div className="panel-head has-rule job-detail-head">
        <div style={{ minWidth: 0 }}>
          <h2
            className="panel-title"
            id="job-detail-title"
            style={{ fontSize: 17, overflowWrap: "anywhere" }}
          >
            {job.company} · {job.title}
          </h2>
          <p className="panel-sub">
            {job.location} · {job.salary} · {job.source} · 保存于{" "}
            {formatRelative(job.savedAt)}
          </p>
        </div>
        <div
          className="panel-head-actions job-detail-actions"
          style={{ flexWrap: "wrap", justifyContent: "flex-end" }}
        >
          <Btn
            variant="primary"
            icon="sparkle"
            onClick={rewriteWithJob}
            disabled={!best}
          >
            用这份 JD 改写
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            icon="trash"
            style={{ color: "var(--ui-negative)" }}
            onClick={onRequestDelete}
          >
            删除
          </Btn>
        </div>
      </div>

      <div
        className="panel-body"
        style={{ display: "flex", flexDirection: "column", gap: 22 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="row-between" style={{ gap: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600 }}>
                关键词命中{" "}
                <span className="num t-accent">
                  {match.hit.length}/{job.keywords.length}
                </span>
              </h3>
              <span className="t-11 t-faint">
                {best ? `针对「${best.resume.title}」` : "暂无简历可对照"}
              </span>
            </div>

            {job.keywords.length === 0 ? (
              <p className="t-12 t-muted" style={{ marginTop: 10 }}>
                这份 JD 还没有识别到关键词，可重新粘贴更完整的 JD 后再对照。
              </p>
            ) : (
              <div className="chip-row" style={{ marginTop: 10 }}>
                {match.hit.map((keyword) => (
                  <KeywordChip key={`hit-${keyword}`} label={keyword} state="hit" />
                ))}
                {match.missing.map((keyword) => (
                  <KeywordChip
                    key={`missing-${keyword}`}
                    label={keyword}
                    state="missing"
                    onClick={best ? () => addKeyword(keyword) : undefined}
                  />
                ))}
              </div>
            )}

            <p className="t-11 t-muted" style={{ marginTop: 12 }}>
              {best
                ? "点击带 + 的关键词，可加入该岗位最佳匹配简历的技能。"
                : "先创建一份简历，才能把缺失的关键词加入技能。"}
            </p>
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="row-between" style={{ gap: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600 }}>匹配的简历</h3>
              <span className="t-11 t-faint">{resumes.length} 份</span>
            </div>
            {ranked.length === 0 ? (
              <p className="t-12 t-muted" style={{ marginTop: 10 }}>
                还没有简历，无法计算匹配度。
              </p>
            ) : (
              <div className="list" style={{ marginTop: 4 }}>
                {ranked.map(({ resume, score }) => (
                  <div
                    key={resume.id}
                    className="list-row"
                    style={{ alignItems: "center" }}
                  >
                    <div className="list-row-main">
                      <div className="list-title truncate">{resume.title}</div>
                      <div className="list-sub">
                        {resume.targetJobId === job.id
                          ? "已设为本岗位目标简历"
                          : "未关联此岗位"}
                      </div>
                    </div>
                    <span
                      className="num"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--ui-accent)",
                        minWidth: 24,
                        textAlign: "right",
                      }}
                    >
                      {score}
                    </span>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/editor?id=${resume.id}`)}
                    >
                      编辑
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="row-between" style={{ gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>JD 原文</h3>
            <span
              className="row t-11 t-faint"
              style={{ gap: 5, whiteSpace: "nowrap" }}
            >
              <Icon name="eye" size={13} /> 关键词已高亮 · 限高滚动
            </span>
          </div>
          <div
            className="well"
            style={{
              maxHeight: 260,
              overflowY: "auto",
              background: "var(--ui-surface)",
              border: "1px solid var(--ui-border)",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 12.5,
              lineHeight: 1.8,
              padding: "14px 16px",
              color: "var(--ui-text)",
            }}
          >
            {highlightText(job.jdText, job.keywords)}
          </div>
        </div>
      </div>
    </section>
  );
}
