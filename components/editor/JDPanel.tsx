"use client";

import { highlightText } from "@/components/app/A4Page";
import { KeywordChip } from "@/components/app/ui";
import type { Job, MatchResult } from "@/lib/mock/types";

/**
 * JD 摘要 + 关键词命中 + JD 原文（命中 / 缺失关键词用共享 KeywordChip 呈现）。
 * 改写弹窗复用；只展示，不写数据。
 */
export function JDPanel({
  job,
  match,
  jdMaxHeight = 200,
}: {
  job: Job;
  match: MatchResult;
  jdMaxHeight?: number;
}) {
  const hitSet = new Set(match.hit);
  return (
    <div className="ed-jd">
      <div className="ed-jd-head">
        <div className="ed-jd-head-main">
          <div className="ed-jd-title">
            {job.company} · {job.title}
          </div>
          <div className="ed-jd-meta">
            {job.location} · {job.salary} · {job.source}
          </div>
        </div>
        <div className="ed-jd-score" aria-label={`匹配度 ${match.score} 分`}>
          <span className="ed-jd-score-value num">{match.score}</span>
          <span className="ed-jd-score-unit">/100</span>
        </div>
      </div>

      <div className="ed-jd-kwline">
        <span>
          关键词命中 <strong className="num">{match.hit.length}</strong> /{" "}
          <span className="num">{job.keywords.length}</span>
        </span>
        <span className="t-11 t-muted">
          淡黄 = JD 原文里出现的词，改写结果会优先覆盖缺失项
        </span>
      </div>
      <div className="chip-row ed-jd-chips">
        {job.keywords.map((keyword) => (
          <KeywordChip
            key={keyword}
            label={keyword}
            state={hitSet.has(keyword) ? "hit" : "missing"}
          />
        ))}
      </div>

      <div className="ed-jd-label">JD 原文</div>
      <div
        className="ed-jd-body"
        style={{ maxHeight: jdMaxHeight }}
        tabIndex={0}
        role="region"
        aria-label="职位描述原文"
      >
        {highlightText(job.jdText, job.keywords)}
      </div>
    </div>
  );
}
