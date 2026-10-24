// 演示数据模型：产品原型的唯一类型来源。
// 真实产品中这些类型会由 Drizzle schema 派生；当前阶段全部由 lib/mock/data.ts 硬编码。

import type { CreditsState } from "@/lib/credits/catalog";

export type { CreditsState };

export type TemplateId = "classic" | "split" | "compact";
export type AccentId = "blue" | "ink" | "green";
export type ResumeStatus = "draft" | "ready" | "applied" | "archived";

export type Experience = {
  id: string;
  company: string;
  title: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM 或 "至今"
  description: string; // 换行分隔的要点
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type Resume = {
  id: string;
  title: string;
  targetJobId: string | null;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  skills: string[];
  experiences: Experience[];
  educations: Education[];
  templateId: TemplateId;
  accent: AccentId;
  status: ResumeStatus;
  updatedAt: string; // ISO
  createdAt: string; // ISO
  photoInitials?: string; // 演示头像：首字母，不上传真实照片
  /** 真实照片的公开地址（Neon Storage）；未配置存储或未上传时为空。 */
  photoUrl?: string;
};

export type Job = {
  id: string;
  company: string;
  title: string;
  location: string;
  salary: string;
  source: string;
  savedAt: string; // ISO
  keywords: string[];
  jdText: string;
};

export type ApplicationStage = "applied" | "read" | "interview" | "offer" | "rejected";

export type Application = {
  id: string;
  company: string;
  role: string;
  resumeId: string;
  stage: ApplicationStage;
  appliedAt: string; // ISO
  nextStep?: string;
  nextAt?: string; // ISO
  note?: string;
};

export type NotificationKind = "plan" | "application" | "resume";

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string; // ISO
  read: boolean;
  kind: NotificationKind;
};

export type Order = {
  id: string;
  at: string; // ISO
  amountFen: number;
  label: string;
  status: "paid";
  /** 本单到账点数（新计费模型；旧订单可能为 undefined） */
  credits?: number;
  /** 套餐 id，例如 "jobhunt" */
  packageId?: string;
};

export type Plan = {
  name: string;
  startedAt: string;
  expiresAt: string;
  priceFen: number;
  autoRenew: boolean;
  usage: { aiRewrites: number; exports: number };
  orders: Order[];
};

export type User = {
  name: string;
  email: string;
  phone: string;
  city: string;
  targetRole: string;
  joinedAt: string;
};

export type Preferences = {
  targetRoles: string[];
  cities: string[];
  salary: string;
  jobType: string;
  weeklyDigest: boolean;
  autoKeywordCheck: boolean;
};

export type WorkspaceState = {
  user: User;
  preferences: Preferences;
  plan: Plan;
  /** AI 点数状态：余额、每日免费额度、重置时间（新计费模型）。 */
  credits: CreditsState;
  resumes: Resume[];
  jobs: Job[];
  applications: Application[];
  notifications: Notification[];
};

export type MatchResult = {
  score: number;
  hit: string[];
  missing: string[];
};

export type ApplicationCounts = {
  total: number;
  active: number;
  interview: number;
  offer: number;
  rejected: number;
  thisWeek: number;
};

export type ToastInput = {
  title: string;
  description?: string;
  tone?: "default" | "positive" | "negative";
};
