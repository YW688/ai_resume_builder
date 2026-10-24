import "server-only";

import { desc, eq } from "drizzle-orm";
import { createRealtime } from "@neon/realtime/server";
import { drizzleAdapter } from "@neon/realtime-drizzle";

import { db } from "@/lib/db";
import { applications, jobs, notifications } from "@/drizzle/schema";
import type {
  LiveApplication,
  LiveJob,
  LiveNotification,
  SealedWorkspaceQueries,
} from "@/lib/realtime/types";

/** 从 DATABASE_URL 取数据库名（createRealtime 的 db 参数，会写进 capability）。 */
function databaseName(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  try {
    const name = new URL(url).pathname.replace(/^\/+/, "");
    return name || "neondb";
  } catch {
    return "neondb";
  }
}

export const REALTIME_DATABASE = databaseName();

/**
 * 服务端 Realtime 实例：只负责 seal（本地 Web Crypto，无网络请求）。
 * secret 只能留在服务端，绝不下发浏览器。
 */
export const realtime = createRealtime({
  secret: process.env.NEON_REALTIME_SECRET!,
  db: REALTIME_DATABASE,
  adapter: drizzleAdapter(),
});

// ---------------------------------------------------------------------------
// workspace 快照查询
//
// 三个只读查询分别对应当前登录用户的三张列表。Realtime 是“行级”的：一个
// live query 只跟踪一个结果集，因此把 workspace 快照拆成三个 sealed query，
// 每个都由同一个 userId 参数化、权限直接内联在 WHERE 里。三个查询都没有
// now()/gen_random_uuid()，参数化、无字符串拼接。
//
// 每个 selected key 都与数据库列名一致（Drizzle adapter 要求）。
// ---------------------------------------------------------------------------

export function applicationsQuery(userId: string) {
  return db
    .select({
      id: applications.id,
      user_id: applications.userId,
      company: applications.company,
      role: applications.role,
      resume_id: applications.resumeId,
      stage: applications.stage,
      applied_at: applications.appliedAt,
      next_step: applications.nextStep,
      next_at: applications.nextAt,
      note: applications.note,
      updated_at: applications.updatedAt,
    })
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .limit(20);
}

export function notificationsQuery(userId: string) {
  return db
    .select({
      id: notifications.id,
      user_id: notifications.userId,
      title: notifications.title,
      body: notifications.body,
      at: notifications.at,
      read: notifications.read,
      kind: notifications.kind,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.at))
    .limit(10);
}

export function jobsQuery(userId: string) {
  return db
    .select({
      id: jobs.id,
      user_id: jobs.userId,
      company: jobs.company,
      title: jobs.title,
      location: jobs.location,
      salary: jobs.salary,
      source: jobs.source,
      saved_at: jobs.savedAt,
      keywords: jobs.keywords,
    })
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.savedAt))
    .limit(10);
}

/**
 * 为已认证用户 seal 一份 workspace 快照。
 *
 * 只能在可信服务端调用（Route Handler / Server Action / Server Component）。
 * 每次调用都生成新的短期 capability；客户端用 POST /api/realtime/workspace
 * 续签同一组查询。
 */
export async function sealWorkspaceQueries(userId: string): Promise<SealedWorkspaceQueries> {
  const [applicationsSealed, notificationsSealed, jobsSealed] = await Promise.all([
    realtime.seal({ query: applicationsQuery(userId) }),
    realtime.seal({ query: notificationsQuery(userId) }),
    realtime.seal({ query: jobsQuery(userId) }),
  ]);

  return {
    applications: applicationsSealed,
    notifications: notificationsSealed,
    jobs: jobsSealed,
    expiresAt: Math.min(
      applicationsSealed.expiresAt,
      notificationsSealed.expiresAt,
      jobsSealed.expiresAt,
    ),
  } as SealedWorkspaceQueries;
}

export type { LiveApplication, LiveJob, LiveNotification };
