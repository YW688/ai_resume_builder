import "server-only";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  applications,
  educations,
  experiences,
  jobs,
  notifications,
  orders,
  preferences,
  resumes,
  users,
} from "@/drizzle/schema";
import type { AuthSessionUser } from "@/lib/auth/server";
import { getSessionUser } from "@/lib/auth/server";
import { initialWorkspace } from "@/lib/mock/data";
import type {
  AccentId,
  Application,
  ApplicationStage,
  Job,
  Notification,
  NotificationKind,
  Plan,
  Preferences,
  Resume,
  ResumeStatus,
  TemplateId,
  User,
  WorkspaceState,
} from "@/lib/mock/types";
import { seedDemoWorkspace } from "./seed";

const EPOCH = new Date(0).toISOString();

function iso(value: Date | null | undefined): string {
  return value ? value.toISOString() : EPOCH;
}

function isoOrUndefined(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

type UserRow = typeof users.$inferSelect;

async function getOrCreateUser(
  userId: string,
  session: AuthSessionUser | null,
): Promise<UserRow | null> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  // 会话已失效（例如账号刚被注销）时不再补建 users 行，避免“删除后复活”。
  if (!session) return null;

  // Neon Auth 的会话数据在 cookie 内有短时缓存（默认 5 分钟），用户被删除后
  // getSession 仍可能短暂返回旧会话。这里以 neon_auth.user 为准：Auth 用户
  // 不存在时绝不补建应用侧 users 行。
  const authUserResult = await db.execute(
    sql`select 1 as ok from neon_auth."user" where id::text = ${userId} limit 1`,
  );
  const authUserExists = authUserResult.rows.length > 0;
  if (!authUserExists) return null;

  await db
    .insert(users)
    .values({
      id: userId,
      email: session?.email ?? "",
      name: session?.name ?? "",
    })
    .onConflictDoNothing();

  const created = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 竞态保护：如果本次请求开始后账号被注销（Neon Auth 用户已删除），
  // 刚补建的 users 行要立刻撤掉，避免“注销后数据复活”。
  const sessionStillValid = await getSessionUser();
  if (!sessionStillValid) {
    await db.delete(users).where(eq(users.id, userId));
    return null;
  }

  return created[0] ?? null;
}

/**
 * 读取某个用户的工作区；首次登录（没有 preferences 行）时写入演示种子数据，
 * 让界面与改造前保持一致，同时验证 Postgres 读写链路。
 */
export async function loadWorkspace(userId: string): Promise<WorkspaceState> {
  const session = await getSessionUser();
  let user = await getOrCreateUser(userId, session);
  if (!user) throw new Error("UNAUTHORIZED: session 已失效，无法加载工作区");

  const existingPreferences = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .limit(1);

  if (!existingPreferences[0]) {
    await seedDemoWorkspace(userId);
    // 种子只补空字段，真实用户填过的不覆盖
    await db
      .update(users)
      .set({
        name: user.name || initialWorkspace.user.name,
        phone: user.phone ?? initialWorkspace.user.phone,
        city: user.city ?? initialWorkspace.user.city,
        targetRole: user.targetRole ?? initialWorkspace.user.targetRole,
        joinedAt: user.joinedAt ?? new Date(initialWorkspace.user.joinedAt),
        plan: user.plan === "free" ? "paid" : user.plan,
        planName: user.planName ?? initialWorkspace.plan.name,
        planStartedAt:
          user.planStartedAt ?? new Date(initialWorkspace.plan.startedAt),
        planExpiresAt:
          user.planExpiresAt ?? new Date(initialWorkspace.plan.expiresAt),
        planPriceFen: user.planPriceFen ?? initialWorkspace.plan.priceFen,
        autoRenew: initialWorkspace.plan.autoRenew,
      })
      .where(eq(users.id, userId));

    user = (
      await db.select().from(users).where(eq(users.id, userId)).limit(1)
    )[0]!;
  }

  const [jobRows, resumeRows, applicationRows, notificationRows, orderRows, preferenceRows] =
    await Promise.all([
      db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.savedAt)),
      db
        .select()
        .from(resumes)
        .where(eq(resumes.userId, userId))
        .orderBy(desc(resumes.updatedAt)),
      db
        .select()
        .from(applications)
        .where(eq(applications.userId, userId))
        .orderBy(desc(applications.appliedAt)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.at)),
      db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.at)),
      db.select().from(preferences).where(eq(preferences.userId, userId)).limit(1),
    ]);

  const resumeIds = resumeRows.map((row) => row.id);
  const [experienceRows, educationRows] =
    resumeIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(experiences)
            .where(inArray(experiences.resumeId, resumeIds))
            .orderBy(asc(experiences.sortOrder)),
          db
            .select()
            .from(educations)
            .where(inArray(educations.resumeId, resumeIds))
            .orderBy(asc(educations.sortOrder)),
        ])
      : [[], []];

  const jobList: Job[] = jobRows.map((row) => ({
    id: row.id,
    company: row.company,
    title: row.title,
    location: row.location ?? "",
    salary: row.salary ?? "",
    source: row.source ?? "",
    savedAt: iso(row.savedAt),
    keywords: row.keywords,
    jdText: row.jdText,
  }));

  const resumeList: Resume[] = resumeRows.map((row) => {
    const rowExperiences = experienceRows.filter((item) => item.resumeId === row.id);
    const rowEducations = educationRows.filter((item) => item.resumeId === row.id);
    return {
      id: row.id,
      title: row.title,
      targetJobId: row.targetJobId,
      fullName: row.fullName,
      phone: row.phone ?? "",
      email: row.email ?? "",
      city: row.city ?? "",
      summary: row.summary ?? "",
      skills: (row.skills ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      experiences: rowExperiences.map((item) => ({
        id: item.id,
        company: item.company,
        title: item.title,
        startDate: item.startDate ?? "",
        endDate: item.endDate ?? "",
        description: item.description ?? "",
      })),
      educations: rowEducations.map((item) => ({
        id: item.id,
        school: item.school,
        degree: item.degree ?? "",
        major: item.major ?? "",
        startDate: item.startDate ?? "",
        endDate: item.endDate ?? "",
      })),
      templateId: row.templateId as TemplateId,
      accent: row.accent as AccentId,
      status: row.status as ResumeStatus,
      updatedAt: iso(row.updatedAt),
      createdAt: iso(row.createdAt),
      photoInitials: row.fullName ? row.fullName.slice(0, 1) : undefined,
    };
  });

  const applicationList: Application[] = applicationRows.map((row) => ({
    id: row.id,
    company: row.company,
    role: row.role,
    resumeId: row.resumeId,
    stage: row.stage as ApplicationStage,
    appliedAt: iso(row.appliedAt),
    nextStep: row.nextStep ?? undefined,
    nextAt: isoOrUndefined(row.nextAt),
    note: row.note ?? undefined,
  }));

  const notificationList: Notification[] = notificationRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    at: iso(row.at),
    read: row.read,
    kind: row.kind as NotificationKind,
  }));

  const plan: Plan = {
    name: user.planName ?? "免费版",
    startedAt: iso(user.planStartedAt ?? user.joinedAt ?? user.createdAt),
    expiresAt: iso(user.planExpiresAt ?? user.joinedAt ?? user.createdAt),
    priceFen: user.planPriceFen ?? 0,
    autoRenew: user.autoRenew,
    usage: { aiRewrites: user.aiUsed, exports: user.exportUsed },
    orders: orderRows.map((row) => ({
      id: row.id,
      at: iso(row.at),
      amountFen: row.amountFen,
      label: row.label,
      status: "paid" as const,
    })),
  };

  const preference = preferenceRows[0];
  const preferenceState: Preferences = {
    targetRoles: preference?.targetRoles ?? [],
    cities: preference?.cities ?? [],
    salary: preference?.salary ?? "",
    jobType: preference?.jobType ?? "",
    weeklyDigest: preference?.weeklyDigest ?? true,
    autoKeywordCheck: preference?.autoKeywordCheck ?? true,
  };

  const userState: User = {
    name: user.name || "求职者",
    email: user.email || session?.email || "",
    phone: user.phone ?? "",
    city: user.city ?? "",
    targetRole: user.targetRole ?? "",
    joinedAt: iso(user.joinedAt ?? user.createdAt),
  };

  return {
    user: userState,
    preferences: preferenceState,
    plan,
    resumes: resumeList,
    jobs: jobList,
    applications: applicationList,
    notifications: notificationList,
  };
}
