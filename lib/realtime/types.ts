/**
 * Realtime 订阅行类型（客户端与服务端共用，不包含任何 secret）。
 *
 * 字段名与 PostgreSQL 列名保持一致：Drizzle adapter 会把每列名原样放进
 * sealed query 的结果集，客户端按同样的 key 解析（见 references/queries.md
 * “Column name casing”）。时间列经过 realtime parsers 解码为 Date。
 */

import type { SealedLiveQuery } from "@neon/realtime/client";

export type LiveApplication = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  resume_id: string;
  stage: string;
  applied_at: Date;
  next_step: string | null;
  next_at: Date | null;
  note: string | null;
  updated_at: Date;
};

export type LiveNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  at: Date;
  read: boolean;
  kind: string;
};

export type LiveJob = {
  id: string;
  user_id: string;
  company: string;
  title: string;
  location: string | null;
  salary: string | null;
  source: string | null;
  saved_at: Date;
  keywords: string[];
};

/** 服务端返回给浏览器的一组 sealed query（每个都是一次性只读能力）。 */
export type SealedWorkspaceQueries = {
  /** 该用户的投递记录（按 updated_at 倒序，最多 20 条） */
  applications: SealedLiveQuery<LiveApplication>;
  /** 该用户的站内通知（按 at 倒序，最多 10 条） */
  notifications: SealedLiveQuery<LiveNotification>;
  /** 该用户收藏/粘贴的职位（按 saved_at 倒序，最多 10 条） */
  jobs: SealedLiveQuery<LiveJob>;
  /** 三个 capability 中最早的过期时间（Unix ms），客户端据此提前续签 */
  expiresAt: number;
};

/** 浏览器端订阅到的 workspace 快照（与 sealed query 一一对应）。 */
export type LiveWorkspaceData = {
  applications: readonly LiveApplication[];
  notifications: readonly LiveNotification[];
  jobs: readonly LiveJob[];
};
