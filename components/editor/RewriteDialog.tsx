"use client";

/* 弹窗打开时需要重置生成阶段，属于对受控弹窗状态的外部同步。 */
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { highlightText } from "@/components/app/A4Page";
import { Btn, Modal, Pill } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import { CREDIT_FEATURES, type CreditsState } from "@/lib/credits/catalog";
import { computeMatch } from "@/lib/mock/compute";
import type { Job, Resume, ToastInput } from "@/lib/mock/types";
import { polishProjectAction, polishSummaryAction } from "@/lib/ai/actions";
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

type Phase = "idle" | "loading" | "ready" | "error";

function availablePoints(credits: CreditsState): number {
  return credits.dailyRemaining + credits.balance;
}

function creditsSummary(credits: CreditsState): string {
  return `当前可用 ${availablePoints(credits)} 点（免费 ${credits.dailyRemaining} + 余额 ${credits.balance}）`;
}

/**
 * AI 润色弹窗：真实调用 Server Action（summary → polishSummaryAction，
 * experience → polishProjectAction），每次生成 / 重新生成都会消耗 1 点。
 *
 * 交互约定：
 * - 打开即显示本次消耗与当前余额；
 * - 余额不足时禁用生成，并给出购买引导（/dashboard/settings）；
 * - 生成成功后立即通过 onCreditsChange 同步最新点数；
 * - 失败展示服务端返回的 message（尤其是「未配置 API」的明确提示）。
 */
export function RewriteDialog({
  open,
  target,
  resume,
  job,
  credits,
  onClose,
  onApply,
  onCreditsChange,
  toast,
}: {
  open: boolean;
  target: RewriteTarget | null;
  resume: Resume;
  job?: Job;
  credits: CreditsState;
  onClose: () => void;
  onApply: (text: string) => void;
  onCreditsChange: (credits: CreditsState) => void;
  toast: (input: ToastInput) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [lastModel, setLastModel] = useState("");
  const [lastCost, setLastCost] = useState(0);

  const feature = target?.mode === "summary" ? "summary_polish" : "experience_polish";
  const cost = CREDIT_FEATURES[feature].cost;
  const available = availablePoints(credits);
  const canAfford = available >= cost;
  const jd = job?.jdText?.trim() ?? "";
  const missingJob = !job || !jd;
  const match = useMemo(() => (job && jd ? computeMatch(resume, job) : null), [job, jd, resume]);

  // 切换目标 / 重新打开时重置阶段；点数余额变化不影响已生成结果。
  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setResult("");
    setErrorMessage("");
    setErrorCode("");
    setLastModel("");
    setLastCost(0);
  }, [open, target?.mode, target?.experienceId]);

  if (!target) return null;

  async function generate() {
    if (!target || !job || !jd || phase === "loading") return;
    if (!canAfford) {
      toast({
        title: "点数不足",
        description: `本次需要 ${cost} 点，当前可用 ${available} 点。可到账户设置购买点数包，或明天再试（每日赠送 ${credits.dailyFree} 点）。`,
        tone: "negative",
      });
      return;
    }

    setPhase("loading");
    setErrorMessage("");
    setErrorCode("");

    try {
      if (target.mode === "summary") {
        const response = await polishSummaryAction({ resumeId: resume.id, jd });
        if (!response.ok) {
          if (response.credits) onCreditsChange(response.credits);
          setPhase("error");
          setErrorCode(response.error);
          setErrorMessage(response.message);
          toast({ title: "AI 润色失败", description: response.message, tone: "negative" });
          return;
        }
        onCreditsChange(response.data.credits);
        setResult(response.data.text);
        setLastModel(response.data.model);
        setLastCost(response.data.cost);
        setPhase("ready");
        return;
      }

      const experience = resume.experiences.find(
        (item) => item.id === target.experienceId,
      );
      const response = await polishProjectAction({
        resumeId: resume.id,
        experienceId: target.experienceId ?? "",
        jd,
        // 刚编辑、600ms 防抖还没保存时，用当前草稿兜底，避免服务端读不到最新内容。
        experience: experience
          ? {
              company: experience.company,
              title: experience.title,
              startDate: experience.startDate,
              endDate: experience.endDate,
              description: experience.description,
            }
          : undefined,
      });
      if (!response.ok) {
        if (response.credits) onCreditsChange(response.credits);
        setPhase("error");
        setErrorCode(response.error);
        setErrorMessage(response.message);
        toast({ title: "AI 润色失败", description: response.message, tone: "negative" });
        return;
      }
      onCreditsChange(response.data.credits);
      setResult(response.data.text);
      setLastModel(response.data.model);
      setLastCost(response.data.cost);
      setPhase("ready");
    } catch (error) {
      console.error("[editor] AI 润色失败", error);
      setPhase("error");
      setErrorCode("ai_error");
      setErrorMessage("请求没有完成，请检查网络后重试（若已扣点数，会自动退回）。");
      toast({
        title: "AI 润色失败",
        description: "请求没有完成，请稍后重试。",
        tone: "negative",
      });
    }
  }

  function applyResult() {
    if (!result) return;
    onApply(result);
    onClose();
  }

  const insufficient = !canAfford;

  const footer = missingJob ? (
    <Btn variant="secondary" onClick={onClose}>
      关闭
    </Btn>
  ) : (
    <>
      {phase === "ready" || phase === "error" ? (
        <Btn
          variant="ghost"
          icon="refresh"
          disabled={insufficient}
          title={
            insufficient
              ? "点数不足，无法重新生成"
              : `重新生成会再次消耗 ${cost} 点`
          }
          onClick={() => void generate()}
        >
          重新生成（再扣 {cost} 点）
        </Btn>
      ) : null}
      <Btn variant="secondary" onClick={onClose}>
        取消
      </Btn>
      {phase === "ready" ? (
        <Btn variant="primary" onClick={applyResult}>
          应用替换
        </Btn>
      ) : (
        <Btn
          variant="primary"
          icon="sparkles"
          loading={phase === "loading"}
          disabled={insufficient || phase === "loading"}
          title={
            insufficient
              ? "点数不足，先去账户设置购买点数"
              : `生成会消耗 ${cost} 点`
          }
          onClick={() => void generate()}
        >
          {phase === "error" ? `重试（${cost} 点）` : `生成润色（${cost} 点）`}
        </Btn>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 润色 · 对照 JD"
      description={`${target.label} · 结果会替换当前段落，应用前可以随时取消。`}
      size="lg"
      footer={footer}
    >
      {missingJob ? (
        <div className="ed-rewrite-blocked">
          <Pill tone="warning">缺少目标岗位</Pill>
          <p className="ed-rewrite-blocked-text">
            还没有选择目标岗位或 JD，无法对照关键词润色。请先在顶栏选择一个目标岗位，再回到这里重试。
          </p>
        </div>
      ) : (
        <div className="ed-rewrite">
          <div className="ed-ai-costline" role="note">
            <span className="ed-ai-costline-main">
              <Icon name="sparkles" size={14} />
              本次消耗 <strong className="num">{cost}</strong> 点 · {creditsSummary(credits)}
            </span>
            <span className="ed-ai-costline-sub">
              每日免费额度 {credits.dailyFree} 点，北京时间 0 点重置
              {credits.expiresAt ? " · 购买点数在有效期内不过期" : ""}
            </span>
          </div>

          {insufficient ? (
            <div className="ed-ai-notice" role="alert">
              <span className="ed-ai-notice-title">
                <Icon name="warning" size={14} />
                点数不足，暂时不能生成
              </span>
              <span className="ed-ai-notice-text">
                本次需要 {cost} 点，当前可用 {available} 点。可以明天再试（每日赠送{" "}
                {credits.dailyFree} 点），或购买点数包后立即继续。
              </span>
              <Link className="btn btn-primary btn-sm" href="/dashboard/settings">
                去购买点数
              </Link>
            </div>
          ) : null}

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
                润色结果
                <span className="ed-rewrite-label-right">
                  {phase === "ready" ? (
                    <Pill tone="accent">已消耗 {lastCost} 点</Pill>
                  ) : (
                    <span className="t-11 t-muted">优先覆盖缺失关键词</span>
                  )}
                </span>
              </div>

              {phase === "idle" ? (
                <div className="ed-rewrite-placeholder">
                  <p>点击「生成润色」，AI 会按目标岗位 JD 重写这段表达。</p>
                  <p className="t-11 t-muted">
                    只润色你真实填写的内容：不编造公司、学历与数字；没有数字时用可验证的规模表达。
                  </p>
                </div>
              ) : null}

              {phase === "loading" ? (
                <div className="ed-skeleton" role="status" aria-label="正在生成润色">
                  <span className="ed-skeleton-bar" />
                  <span className="ed-skeleton-bar" />
                  <span className="ed-skeleton-bar is-short" />
                </div>
              ) : null}

              {phase === "ready" ? (
                <div className="ed-rewrite-result" aria-live="polite">
                  <div className="ed-rewrite-result-text">
                    {highlightText(result, job!.keywords)}
                  </div>
                  <div className="ed-ai-meta">
                    <span>模型：{lastModel || "deepseek-chat"}</span>
                    <span>重新生成会再次扣 {cost} 点</span>
                  </div>
                </div>
              ) : null}

              {phase === "error" ? (
                <div className="ed-ai-error" role="alert">
                  <span className="ed-ai-error-title">
                    <Icon name="warning" size={14} />
                    {errorCode === "ai_not_configured"
                      ? "AI 服务尚未配置"
                      : errorCode === "insufficient_credits"
                        ? "点数不足"
                        : "生成失败"}
                  </span>
                  <p className="ed-ai-error-text">{errorMessage}</p>
                  {errorCode === "insufficient_credits" ? (
                    <Link className="btn btn-primary btn-sm" href="/dashboard/settings">
                      去购买点数
                    </Link>
                  ) : null}
                  {errorCode === "ai_error" || errorCode === "parse_error" ? (
                    <p className="t-11 t-muted">
                      本次点数已自动退回；可以点「重试」再生成一次。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <p className="ed-rewrite-note">
            应用后：更新这段内容并自动保存 · 本次消耗 {cost} 点（服务端预扣，失败自动退回）·
            点数余额会立即刷新。
          </p>
        </div>
      )}
    </Modal>
  );
}
