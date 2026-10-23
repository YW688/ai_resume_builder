import { DEMO_NOW } from "./data";
import type {
  Application,
  ApplicationCounts,
  ApplicationStage,
  Job,
  MatchResult,
  Resume,
} from "./types";

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 固定时区（Asia/Shanghai）下的日期片段，保证服务端 / 客户端输出一致。 */
function tzParts(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    hh: String(shifted.getUTCHours()).padStart(2, "0"),
    mm: String(shifted.getUTCMinutes()).padStart(2, "0"),
    weekday: shifted.getUTCDay(),
  };
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function dayKey(input: string | Date): string {
  const p = tzParts(input);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function formatDate(input: string, style: "short" | "long" = "long"): string {
  const p = tzParts(input);
  return style === "short"
    ? `${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`
    : `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function formatDateTime(input: string): string {
  const p = tzParts(input);
  return `${formatDate(input, "short")} ${p.hh}:${p.mm}`;
}

export function formatTime(input: string): string {
  const p = tzParts(input);
  return `${p.hh}:${p.mm}`;
}

export function formatWeekday(input: string): string {
  return WEEKDAYS[tzParts(input).weekday];
}

/** 相对时间：今天 / 昨天 / 具体日期。基准固定为 DEMO_NOW。 */
export function formatRelative(input: string, now: Date = DEMO_NOW): string {
  const key = dayKey(input);
  const today = dayKey(now);
  if (key === today) return `今天 ${formatTime(input)}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === dayKey(yesterday)) return `昨天 ${formatTime(input)}`;
  const days = Math.round(
    (new Date(`${today}T00:00:00+08:00`).getTime() -
      new Date(`${key}T00:00:00+08:00`).getTime()) /
      86400000,
  );
  if (days > 1 && days < 7) return `${formatDate(input, "short")} ${formatTime(input)}`;
  return formatDate(input, "long");
}

export function formatMoney(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`;
}

export function startOfWeek(now: Date = DEMO_NOW): Date {
  const p = tzParts(now);
  const diff = (p.weekday + 6) % 7; // 周一为一周起点
  return new Date(
    Date.UTC(p.y, p.m - 1, p.d - diff) - TZ_OFFSET_MS,
  );
}

export function daysLeft(expiresAt: string, now: Date = DEMO_NOW): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86400000));
}

/* ---------------- 完成度 ---------------- */

function hasText(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

/**
 * 简历内容完成度（0–100）。权重写在函数里，所有页面必须调用它，不要手写百分比。
 * 25 基本信息 + 10 目标岗位 + 15 总结 + 30 经历 + 10 教育 + 5 技能 + 5 头像
 */
export function computeCompletion(resume: Resume): number {
  let score = 0;
  if (hasText(resume.fullName)) score += 6;
  if (hasText(resume.phone)) score += 6;
  if (hasText(resume.email)) score += 7;
  if (hasText(resume.city)) score += 6;
  if (resume.targetJobId) score += 10;
  if (resume.summary.trim().length >= 40) score += 15;
  const experiences = resume.experiences.slice(0, 2);
  for (const exp of experiences) {
    const complete =
      hasText(exp.company) &&
      hasText(exp.title) &&
      hasText(exp.startDate) &&
      hasText(exp.endDate) &&
      exp.description.trim().length >= 30;
    if (complete) score += 15;
  }
  if (
    resume.educations.some(
      (edu) => hasText(edu.school) && hasText(edu.degree) && hasText(edu.major),
    )
  ) {
    score += 10;
  }
  if (resume.skills.filter(hasText).length >= 3) score += 5;
  if (resume.photoInitials) score += 5;
  return Math.min(100, Math.round(score));
}

/* ---------------- JD 匹配 ---------------- */

export function resumeText(resume: Resume): string {
  return [
    resume.summary,
    resume.skills.join(" "),
    ...resume.experiences.map(
      (exp) => `${exp.company} ${exp.title} ${exp.description}`,
    ),
    ...resume.educations.map((edu) => `${edu.school} ${edu.major}`),
  ]
    .join("\n")
    .toLowerCase();
}

export function computeMatch(resume: Resume, job: Job): MatchResult {
  const text = resumeText(resume);
  const hit: string[] = [];
  const missing: string[] = [];
  for (const keyword of job.keywords) {
    if (text.includes(keyword.toLowerCase())) hit.push(keyword);
    else missing.push(keyword);
  }
  return {
    hit,
    missing,
    score: job.keywords.length
      ? Math.round((hit.length / job.keywords.length) * 100)
      : 0,
  };
}

export function bestMatchForJob(resumes: Resume[], job: Job) {
  let best: { resume: Resume; score: number } | null = null;
  for (const resume of resumes) {
    const { score } = computeMatch(resume, job);
    if (!best || score > best.score) best = { resume, score };
  }
  return best;
}

/* ---------------- 投递 ---------------- */

export const STAGE_META: Record<
  ApplicationStage,
  { label: string; tone: "neutral" | "accent" | "positive" | "negative" | "warning" }
> = {
  applied: { label: "已投递", tone: "neutral" },
  read: { label: "已读", tone: "neutral" },
  interview: { label: "面试中", tone: "accent" },
  offer: { label: "Offer", tone: "positive" },
  rejected: { label: "未通过", tone: "negative" },
};

export function stageLabel(stage: ApplicationStage): string {
  return STAGE_META[stage].label;
}

export function stageTone(stage: ApplicationStage) {
  return STAGE_META[stage].tone;
}

export function applicationCounts(
  applications: Application[],
  now: Date = DEMO_NOW,
): ApplicationCounts {
  const weekStart = startOfWeek(now).getTime();
  return {
    total: applications.length,
    active: applications.filter((a) => a.stage !== "rejected" && a.stage !== "offer")
      .length,
    interview: applications.filter((a) => a.stage === "interview").length,
    offer: applications.filter((a) => a.stage === "offer").length,
    rejected: applications.filter((a) => a.stage === "rejected").length,
    thisWeek: applications.filter(
      (a) => new Date(a.appliedAt).getTime() >= weekStart,
    ).length,
  };
}

export function applicationFunnel(applications: Application[]) {
  const total = applications.length;
  const screened = applications.filter((a) =>
    ["read", "interview", "offer"].includes(a.stage),
  ).length;
  const interviewed = applications.filter((a) =>
    ["interview", "offer"].includes(a.stage),
  ).length;
  const offers = applications.filter((a) => a.stage === "offer").length;
  return [
    { label: "累计投递", value: total },
    { label: "进入筛选", value: screened },
    { label: "进入面试", value: interviewed },
    { label: "收到 Offer", value: offers },
  ];
}

export function upcomingInterviews(
  applications: Application[],
  now: Date = DEMO_NOW,
): Application[] {
  return applications
    .filter(
      (a) =>
        a.stage === "interview" &&
        a.nextAt &&
        new Date(a.nextAt).getTime() >= now.getTime(),
    )
    .sort((a, b) => new Date(a.nextAt!).getTime() - new Date(b.nextAt!).getTime());
}

/** 近期日程（含时间）统一格式：「10-24 周六 10:30」。 */
export function formatSchedule(iso: string): string {
  return `${formatDate(iso, "short")} ${formatWeekday(iso)} ${formatTime(iso)}`;
}

/* ---------------- 其他 ---------------- */

export function mostRecentResume(resumes: Resume[]): Resume | undefined {
  return [...resumes]
    .filter((r) => r.status !== "archived")
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
}

export function unreadNotifications(
  notifications: { read: boolean }[],
): number {
  return notifications.filter((n) => !n.read).length;
}

export function byUpdatedDesc(a: Resume, b: Resume): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
