"use client";

/* 弹窗打开时需要把改写阶段重置为 idle，属于对受控弹窗状态的外部同步。 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { highlightText } from "@/components/app/A4Page";
import { Btn, Modal, Pill } from "@/components/app/ui";
import { computeMatch } from "@/lib/mock/compute";
import type { Job, Resume } from "@/lib/mock/types";
import { JDPanel } from "./JDPanel";

export type RewriteMode = "summary" | "experience";

export type RewriteTarget = {
  mode: RewriteMode;
  /** mode=experience 时定位到具体经历。 */
  experienceId?: string;
  /** 弹窗内展示的段落名，例如「工作经历 1 · 产品经理」。 */
  label: string;
  /** 当前原文（只对比，不直接写回）。 */
  original: string;
};

const FALLBACK_KEYWORDS = ["数据分析", "跨部门协作", "项目管理"];

/** 优先用简历里还缺的 JD 关键词，其次用已命中的，凑够 3 个。 */
function rewriteKeywords(resume: Resume, job: Job): string[] {
  const match = computeMatch(resume, job);
  const picked = Array.from(new Set([...match.missing, ...match.hit])).slice(0, 3);
  for (const word of FALLBACK_KEYWORDS) {
    if (picked.length >= 3) break;
    if (!picked.includes(word)) picked.push(word);
  }
  return picked;
}

/**
 * 演示版 mock 改写：只做两段更量化、带 JD 关键词的中文表达，
 * 两个版本供「重新生成」切换；不调用任何真实 AI 接口。
 */
function buildVersions(target: RewriteTarget, job: Job, keywords: string[]): [string, string] {
  const [k1, k2, k3] = keywords;
  if (target.mode === "summary") {
    return [
      `5 年产品经验，聚焦${k1}与${k2}方向，主导过从 0 到 1 的增长项目。习惯用${k3}验证每一次迭代，能把复杂问题拆成可执行的需求与清晰指标。`,
      `具备${k1}、${k2}与${k3}的完整实践，主导的改版让核心指标连续 3 个季度提升。擅长跨部门协作与项目管理，在信息不完整时也能快速做出可验证的判断。`,
    ];
  }
  const company = job.company || "当前公司";
  return [
    `负责${company}方向的${k1}与${k2}落地，围绕核心用户路径重做 3 个关键功能，上线后核心转化率提升 12%。\n用${k3}复盘每一次迭代，把需求交付周期从 21 天压缩到 14 天。\n作为跨团队接口人协调设计、研发与运营，3 个版本全部按期交付。`,
    `主导${k1}方向的产品设计，通过${k2}拆解用户场景，把复杂流程拆成 4 个可交付模块。\n以${k3}为依据持续复盘，推动核心指标连续 2 个季度增长，季度收入提升 15%。\n推动跨部门协作流程标准化，需求评审一次通过率从 62% 提升到 88%。`,
  ];
}

type Phase = "idle" | "loading" | "ready";

export function RewriteDialog({
  open,
  target,
  resume,
  job,
  onClose,
  onApply,
}: {
  open: boolean;
  target: RewriteTarget | null;
  resume: Resume;
  job?: Job;
  onClose: () => void;
  onApply: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [versionIndex, setVersionIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keywords = useMemo(
    () => (job ? rewriteKeywords(resume, job) : FALLBACK_KEYWORDS),
    [job, resume],
  );
  const versions = useMemo<[string, string] | null>(
    () => (job && target ? buildVersions(target, job, keywords) : null),
    [job, target, keywords],
  );
  const match = useMemo(() => (job ? computeMatch(resume, job) : null), [job, resume]);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;
    clearTimer();
    setPhase("idle");
    setVersionIndex(0);
    return clearTimer;
  }, [open, target?.mode, target?.experienceId]);

  useEffect(() => clearTimer, []);

  function generate(nextIndex?: number) {
    clearTimer();
    setPhase("loading");
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (typeof nextIndex === "number") setVersionIndex(nextIndex);
      else setVersionIndex(0);
      setPhase("ready");
    }, 900);
  }

  function close() {
    clearTimer();
    onClose();
  }

  if (!target) return null;

  const missingJob = !job || !versions || !match;

  const footer = missingJob ? (
    <Btn variant="secondary" onClick={close}>
      关闭
    </Btn>
  ) : (
    <>
      {phase === "ready" ? (
        <Btn
          variant="ghost"
          icon="refresh"
          onClick={() => generate((versionIndex + 1) % 2)}
        >
          重新生成
        </Btn>
      ) : null}
      <Btn variant="secondary" onClick={close}>
        取消
      </Btn>
      {phase === "idle" ? (
        <Btn variant="primary" icon="sparkles" onClick={() => generate()}>
          生成改写
        </Btn>
      ) : (
        <Btn
          variant="primary"
          onClick={() => {
            if (!versions) return;
            const text = versions[versionIndex];
            clearTimer();
            onApply(text);
            onClose();
          }}
          loading={phase === "loading"}
          disabled={phase === "loading"}
        >
          应用替换
        </Btn>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title="对照 JD 改写"
      description={`${target.label} · 结果会替换当前段落，应用前可以随时取消。`}
      size="lg"
      footer={footer}
    >
      {missingJob ? (
        <div className="ed-rewrite-blocked">
          <Pill tone="warning">缺少目标岗位</Pill>
          <p className="ed-rewrite-blocked-text">
            还没有选择目标岗位或 JD，无法对照关键词改写。请先在顶栏选择一个目标岗位，再回到这里重试。
          </p>
        </div>
      ) : (
        <div className="ed-rewrite">
          <JDPanel job={job!} match={match!} jdMaxHeight={150} />

          <div className="ed-rewrite-grid">
            <section className="ed-rewrite-block" aria-labelledby="ed-original-title">
              <div className="ed-rewrite-label" id="ed-original-title">
                原文
                <span className="t-11 t-muted">只读对比，不会被自动改写</span>
              </div>
              <div className="ed-rewrite-original">
                {target.original.trim() || "（当前段落还没有内容）"}
              </div>
            </section>

            <section className="ed-rewrite-block" aria-labelledby="ed-result-title">
              <div className="ed-rewrite-label" id="ed-result-title">
                改写结果
                <span className="ed-rewrite-label-right">
                  {phase === "ready" ? (
                    <Pill tone="accent">版本 {versionIndex + 1} / 2</Pill>
                  ) : (
                    <span className="t-11 t-muted">优先覆盖缺失关键词</span>
                  )}
                </span>
              </div>

              {phase === "idle" ? (
                <div className="ed-rewrite-placeholder">
                  <p>点击「生成改写」，AI 会按目标岗位 JD 重写这段表达。</p>
                  <p className="t-11 t-muted">
                    演示环境为本地模拟，约 900ms，不调用真实 AI 接口。
                  </p>
                </div>
              ) : null}

              {phase === "loading" ? (
                <div className="ed-skeleton" role="status" aria-label="正在生成改写">
                  <span className="ed-skeleton-bar" />
                  <span className="ed-skeleton-bar" />
                  <span className="ed-skeleton-bar is-short" />
                </div>
              ) : null}

              {phase === "ready" ? (
                <div className="ed-rewrite-result" aria-live="polite">
                  {highlightText(versions![versionIndex], job!.keywords)}
                </div>
              ) : null}
            </section>
          </div>

          <p className="ed-rewrite-note">
            应用后：更新这段内容 · AI 改写次数 +1 · 顶栏保存状态自动同步。本次不消耗其他额度。
          </p>
        </div>
      )}
    </Modal>
  );
}
