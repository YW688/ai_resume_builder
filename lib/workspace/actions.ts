"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

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
import { requireUser } from "@/lib/dal";
import { extractKeywordsViaFunction } from "@/lib/functions/extract-keywords";
import { initialWorkspace } from "@/lib/mock/data";
import { shanghaiDateKey } from "@/lib/credits/server";
import type { CreditLedgerEntry, CreditsState } from "@/lib/credits/catalog";
import {
  getCreditLedger,
  getCreditsState,
} from "@/lib/credits/server";
import {
  purchaseCreditPackage,
  type PayProvider,
  type PurchaseOrder,
} from "@/lib/pay";
import type {
  AccentId,
  Application,
  ApplicationStage,
  Job,
  NotificationKind,
  Order,
  Plan,
  Preferences,
  Resume,
  ResumeStatus,
  TemplateId,
  User,
  WorkspaceState,
} from "@/lib/mock/types";
import { loadWorkspace } from "./load";
import {
  clearWorkspace,
  isDemoModeEnabled,
  seedDemoWorkspace,
} from "./seed";

export type WorkspaceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string };

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOrNow(value: string | null | undefined): Date {
  return toDate(value) ?? new Date();
}

// ---------------------------------------------------------------------------
// 工作区
// ---------------------------------------------------------------------------

export async function loadWorkspaceAction(): Promise<WorkspaceState> {
  const userId = await requireUser();
  try {
    return await loadWorkspace(userId);
  } catch (error) {
    // 会话在请求过程中失效（例如刚注销账号）时，按未登录处理。
    if (error instanceof Error && error.message.startsWith("UNAUTHORIZED")) {
      redirect("/sign-in");
    }
    throw error;
  }
}

export async function resetDemoAction(): Promise<WorkspaceResult<WorkspaceState>> {
  const userId = await requireUser();
  // 生产环境禁用演示重置：否则任何登录用户都能把账号恢复成 paid / 18 点。
  if (!isDemoModeEnabled()) {
    throw new Error("演示功能已禁用");
  }
  await clearWorkspace(userId);
  // 演示数据重置时把点数账户也恢复到示例状态，避免旧余额/流水残留。
  await db
    .update(users)
    .set({
      plan: "paid",
      planName: initialWorkspace.plan.name,
      planPriceFen: initialWorkspace.plan.priceFen,
      planExpiresAt: new Date(initialWorkspace.plan.expiresAt),
      creditsBalance: initialWorkspace.credits.balance,
      creditsExpireAt: initialWorkspace.credits.expiresAt
        ? new Date(initialWorkspace.credits.expiresAt)
        : null,
      dailyCreditsUsed: 0,
      dailyCreditsDate: shanghaiDateKey(),
    })
    .where(eq(users.id, userId));
  await seedDemoWorkspace(userId);
  return { ok: true, data: await loadWorkspace(userId) };
}

// ---------------------------------------------------------------------------
// 简历
// ---------------------------------------------------------------------------

async function ownsJob(userId: string, jobId: string | null): Promise<string | null> {
  if (!jobId) return null;
  const row = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  return row[0]?.id ?? null;
}

export async function saveResumeAction(resume: Resume): Promise<WorkspaceResult> {
  const userId = await requireUser();
  const id = resume.id;

  // 按 id 查归属：如果该 id 已属于其他用户，绝不能走 insert ... on conflict update
  // 去覆盖他人简历；直接拒绝。
  const existing = await db
    .select({ userId: resumes.userId })
    .from(resumes)
    .where(eq(resumes.id, id))
    .limit(1);
  if (existing[0] && existing[0].userId !== userId) {
    return { ok: false, error: "not_found", message: "简历不存在" };
  }
  const ownedResume = Boolean(existing[0]);

  const targetJobId = await ownsJob(userId, resume.targetJobId);
  const values = {
    targetJobId,
    title: clean(resume.title) || "我的简历",
    fullName: clean(resume.fullName),
    phone: clean(resume.phone),
    email: clean(resume.email),
    city: clean(resume.city),
    summary: resume.summary ?? "",
    skills: (resume.skills ?? []).join("\n"),
    templateId: (resume.templateId ?? "classic") as TemplateId,
    accent: (resume.accent ?? "blue") as AccentId,
    status: (resume.status ?? "draft") as ResumeStatus,
    updatedAt: new Date(),
  };

  try {
    if (ownedResume) {
      await db
        .update(resumes)
        .set(values)
        .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
    } else {
      const [saved] = await db
        .insert(resumes)
        .values({
          id,
          userId,
          ...values,
          createdAt: toDateOrNow(resume.createdAt),
        })
        // setWhere 兜底：并发下若 id 被他人占用，跳过更新而不是覆盖他人行。
        .onConflictDoUpdate({
          target: resumes.id,
          set: values,
          setWhere: eq(resumes.userId, userId),
        })
        .returning({ userId: resumes.userId });
      // 冲突到他人行时 DO UPDATE 被跳过、RETURNING 为空：拒绝继续写子表。
      if (!saved || saved.userId !== userId) {
        return { ok: false, error: "not_found", message: "简历不存在" };
      }
    }

    // 子项同步：先 upsert（并发保存时不会撞主键），再删掉本次未提交的行。
    // 不能用「先 delete 再 insert」：两次并发 action 交错时会 duplicate key。
    const experienceRows = (resume.experiences ?? []).map((item, index) => ({
      id: item.id,
      resumeId: id,
      company: clean(item.company),
      title: clean(item.title),
      startDate: clean(item.startDate),
      endDate: clean(item.endDate),
      description: item.description ?? "",
      sortOrder: index,
    }));
    const educationRows = (resume.educations ?? []).map((item, index) => ({
      id: item.id,
      resumeId: id,
      school: clean(item.school),
      degree: clean(item.degree),
      major: clean(item.major),
      startDate: clean(item.startDate),
      endDate: clean(item.endDate),
      sortOrder: index,
    }));

    // 子记录 id 由客户端提供：若该 id 已挂在其他简历（可能是其他用户）下，
    // 直接拒绝，避免通过 upsert 把他人工作经历/教育经历挂到自己的简历上。
    if (experienceRows.length) {
      const clashes = await db
        .select({ resumeId: experiences.resumeId })
        .from(experiences)
        .where(
          inArray(
            experiences.id,
            experienceRows.map((row) => row.id),
          ),
        );
      if (clashes.some((row) => row.resumeId !== id)) {
        return { ok: false, error: "not_found", message: "工作经历不存在" };
      }
    }
    if (educationRows.length) {
      const clashes = await db
        .select({ resumeId: educations.resumeId })
        .from(educations)
        .where(
          inArray(
            educations.id,
            educationRows.map((row) => row.id),
          ),
        );
      if (clashes.some((row) => row.resumeId !== id)) {
        return { ok: false, error: "not_found", message: "教育经历不存在" };
      }
    }

    if (experienceRows.length) {
      await db
        .insert(experiences)
        .values(experienceRows)
        .onConflictDoUpdate({
          target: experiences.id,
          set: {
            resumeId: sql`excluded.resume_id`,
            company: sql`excluded.company`,
            title: sql`excluded.title`,
            startDate: sql`excluded.start_date`,
            endDate: sql`excluded.end_date`,
            description: sql`excluded.description`,
            sortOrder: sql`excluded.sort_order`,
          },
          // 兜底：只允许更新当前简历下的行，冲突到他人行时跳过更新。
          setWhere: eq(experiences.resumeId, id),
        });
      await db
        .delete(experiences)
        .where(
          and(
            eq(experiences.resumeId, id),
            notInArray(experiences.id, experienceRows.map((row) => row.id)),
          ),
        );
    } else {
      await db.delete(experiences).where(eq(experiences.resumeId, id));
    }

    if (educationRows.length) {
      await db
        .insert(educations)
        .values(educationRows)
        .onConflictDoUpdate({
          target: educations.id,
          set: {
            resumeId: sql`excluded.resume_id`,
            school: sql`excluded.school`,
            degree: sql`excluded.degree`,
            major: sql`excluded.major`,
            startDate: sql`excluded.start_date`,
            endDate: sql`excluded.end_date`,
            sortOrder: sql`excluded.sort_order`,
          },
          setWhere: eq(educations.resumeId, id),
        });
      await db
        .delete(educations)
        .where(
          and(
            eq(educations.resumeId, id),
            notInArray(educations.id, educationRows.map((row) => row.id)),
          ),
        );
    } else {
      await db.delete(educations).where(eq(educations.resumeId, id));
    }
  } catch (error) {
    console.error("saveResumeAction failed", error);
    return { ok: false, error: "save_failed", message: "保存简历失败，请稍后重试" };
  }

  return { ok: true, data: undefined };
}

export async function deleteResumeAction(resumeId: string): Promise<WorkspaceResult> {
  const userId = await requireUser();
  try {
    await db
      .delete(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)));
  } catch (error) {
    console.error("deleteResumeAction failed", error);
    return { ok: false, error: "delete_failed", message: "删除简历失败" };
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 岗位
// ---------------------------------------------------------------------------

export async function saveJobAction(job: Job): Promise<WorkspaceResult<{ keywords: string[] }>> {
  const userId = await requireUser();
  const existing = await db
    .select({ userId: jobs.userId })
    .from(jobs)
    .where(eq(jobs.id, job.id))
    .limit(1);
  if (existing[0] && existing[0].userId !== userId) {
    return { ok: false, error: "not_found", message: "岗位不存在" };
  }
  const ownedJob = Boolean(existing[0]);

  let keywords = (job.keywords ?? [])
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, 50);

  // 关键词由 Neon Function（部署在数据库同区域）提取；失败时回退到客户端词典结果，
  // 不阻塞保存。函数调用会带当前 Neon Auth 会话 JWT。
  if (clean(job.jdText)) {
    try {
      const fromFunction = await extractKeywordsViaFunction(job.jdText, { limit: 20 });
      const normalized = fromFunction.map((item) => clean(item)).filter(Boolean);
      if (normalized.length > 0) keywords = normalized.slice(0, 50);
    } catch (error) {
      console.warn(
        "[workspace] extractKeywordsViaFunction failed, keeping client keywords:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  const values = {
    company: clean(job.company),
    title: clean(job.title),
    location: clean(job.location),
    salary: clean(job.salary),
    source: clean(job.source),
    savedAt: toDateOrNow(job.savedAt),
    keywords,
    jdText: job.jdText ?? "",
  };

  try {
    if (ownedJob) {
      await db
        .update(jobs)
        .set(values)
        .where(and(eq(jobs.id, job.id), eq(jobs.userId, userId)));
    } else {
      const [saved] = await db
        .insert(jobs)
        .values({ id: job.id, userId, ...values })
        .onConflictDoUpdate({
          target: jobs.id,
          set: values,
          setWhere: eq(jobs.userId, userId),
        })
        .returning({ userId: jobs.userId });
      if (!saved || saved.userId !== userId) {
        return { ok: false, error: "not_found", message: "岗位不存在" };
      }
    }
  } catch (error) {
    console.error("saveJobAction failed", error);
    return { ok: false, error: "save_failed", message: "保存岗位失败，请稍后重试" };
  }

  return { ok: true, data: { keywords } };
}

export async function deleteJobAction(jobId: string): Promise<WorkspaceResult> {
  const userId = await requireUser();
  try {
    // resumes.target_job_id 由外键 ON DELETE SET NULL 自动置空
    await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  } catch (error) {
    console.error("deleteJobAction failed", error);
    return { ok: false, error: "delete_failed", message: "删除岗位失败" };
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 投递
// ---------------------------------------------------------------------------

export async function saveApplicationAction(application: Application): Promise<WorkspaceResult> {
  const userId = await requireUser();

  const resume = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.id, application.resumeId), eq(resumes.userId, userId)))
    .limit(1);
  if (!resume[0]) {
    return { ok: false, error: "invalid_resume", message: "投递关联的简历不存在" };
  }

  const existing = await db
    .select({ userId: applications.userId })
    .from(applications)
    .where(eq(applications.id, application.id))
    .limit(1);
  if (existing[0] && existing[0].userId !== userId) {
    return { ok: false, error: "not_found", message: "投递记录不存在" };
  }
  const ownedApplication = Boolean(existing[0]);

  const values = {
    company: clean(application.company),
    role: clean(application.role),
    resumeId: application.resumeId,
    stage: (application.stage ?? "applied") as ApplicationStage,
    appliedAt: toDateOrNow(application.appliedAt),
    nextStep: application.nextStep ? clean(application.nextStep) : null,
    nextAt: toDate(application.nextAt),
    note: application.note ? application.note : null,
    updatedAt: new Date(),
  };

  try {
    if (ownedApplication) {
      await db
        .update(applications)
        .set(values)
        .where(
          and(
            eq(applications.id, application.id),
            eq(applications.userId, userId),
          ),
        );
    } else {
      const [saved] = await db
        .insert(applications)
        .values({ id: application.id, userId, ...values })
        .onConflictDoUpdate({
          target: applications.id,
          set: values,
          setWhere: eq(applications.userId, userId),
        })
        .returning({ userId: applications.userId });
      if (!saved || saved.userId !== userId) {
        return { ok: false, error: "not_found", message: "投递记录不存在" };
      }
    }
  } catch (error) {
    console.error("saveApplicationAction failed", error);
    return { ok: false, error: "save_failed", message: "保存投递记录失败" };
  }

  return { ok: true, data: undefined };
}

export async function deleteApplicationAction(id: string): Promise<WorkspaceResult> {
  const userId = await requireUser();
  try {
    await db
      .delete(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  } catch (error) {
    console.error("deleteApplicationAction failed", error);
    return { ok: false, error: "delete_failed", message: "删除投递记录失败" };
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 账户 / 偏好
// ---------------------------------------------------------------------------

export async function updateUserAction(patch: Partial<User>): Promise<WorkspaceResult> {
  const userId = await requireUser();
  const values = {
    name: patch.name === undefined ? undefined : clean(patch.name),
    phone: patch.phone === undefined ? undefined : clean(patch.phone),
    city: patch.city === undefined ? undefined : clean(patch.city),
    targetRole: patch.targetRole === undefined ? undefined : clean(patch.targetRole),
    email: patch.email === undefined ? undefined : clean(patch.email),
  };
  try {
    await db
      .update(users)
      .set(
        Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== undefined),
        ),
      )
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("updateUserAction failed", error);
    return { ok: false, error: "update_failed", message: "保存个人资料失败" };
  }
  return { ok: true, data: undefined };
}

export async function updatePreferencesAction(
  patch: Partial<Preferences>,
): Promise<WorkspaceResult> {
  const userId = await requireUser();
  const values = {
    targetRoles: patch.targetRoles,
    cities: patch.cities,
    salary: patch.salary === undefined ? undefined : clean(patch.salary),
    jobType: patch.jobType === undefined ? undefined : clean(patch.jobType),
    weeklyDigest: patch.weeklyDigest,
    autoKeywordCheck: patch.autoKeywordCheck,
    updatedAt: new Date(),
  };
  try {
    const updated = await db
      .update(preferences)
      .set(
        Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== undefined),
        ),
      )
      .where(eq(preferences.userId, userId))
      .returning({ userId: preferences.userId });

    if (updated.length === 0) {
      await db.insert(preferences).values({
        userId,
        targetRoles: patch.targetRoles ?? [],
        cities: patch.cities ?? [],
        salary: patch.salary ?? "",
        jobType: patch.jobType ?? "",
        weeklyDigest: patch.weeklyDigest ?? true,
        autoKeywordCheck: patch.autoKeywordCheck ?? true,
      });
    }
  } catch (error) {
    console.error("updatePreferencesAction failed", error);
    return { ok: false, error: "update_failed", message: "保存求职偏好失败" };
  }
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// 通知 / 通行证 / 用量
// ---------------------------------------------------------------------------

export async function markNotificationReadAction(id: string): Promise<WorkspaceResult> {
  const userId = await requireUser();
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { ok: true, data: undefined };
}

export async function markAllNotificationsReadAction(): Promise<WorkspaceResult> {
  const userId = await requireUser();
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));
  return { ok: true, data: undefined };
}

export async function renewPlanAction(): Promise<WorkspaceResult<Plan>> {
  const userId = await requireUser();
  // 该 action 不校验支付、只用于本地演示；生产环境绝不能把用户免费升级为 paid。
  if (!isDemoModeEnabled()) {
    throw new Error("演示功能已禁用");
  }
  try {
    const userRow = (
      await db.select().from(users).where(eq(users.id, userId)).limit(1)
    )[0];
    if (!userRow) return { ok: false, error: "not_found" };

    const now = new Date();
    const base = userRow.planExpiresAt && userRow.planExpiresAt > now
      ? userRow.planExpiresAt
      : now;
    const expiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    const priceFen = userRow.planPriceFen ?? 1900;

    await db
      .update(users)
      .set({
        plan: "paid",
        planName: userRow.planName ?? "30 天通行证",
        planStartedAt: now,
        planExpiresAt: expiresAt,
        planPriceFen: priceFen,
        autoRenew: false,
      })
      .where(eq(users.id, userId));

    const order: Order = {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      amountFen: priceFen,
      label: userRow.planName ?? "30 天通行证",
      status: "paid",
    };
    await db.insert(orders).values({
      id: order.id,
      userId,
      at: now,
      amountFen: order.amountFen,
      label: order.label,
      status: order.status,
    });

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId));

    const plan: Plan = {
      name: userRow.planName ?? "30 天通行证",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      priceFen,
      autoRenew: false,
      usage: { aiRewrites: userRow.aiUsed, exports: userRow.exportUsed },
      orders: orderRows
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .map((row) => ({
          id: row.id,
          at: row.at.toISOString(),
          amountFen: row.amountFen,
          label: row.label,
          status: "paid" as const,
        })),
    };

    return { ok: true, data: plan };
  } catch (error) {
    console.error("renewPlanAction failed", error);
    return { ok: false, error: "renew_failed", message: "续费失败，请稍后重试" };
  }
}

export async function recordUsageAction(kind: "ai" | "export"): Promise<WorkspaceResult> {
  const userId = await requireUser();
  try {
    await db
      .update(users)
      .set(
        kind === "ai"
          ? { aiUsed: sql`${users.aiUsed} + 1` }
          : { exportUsed: sql`${users.exportUsed} + 1` },
      )
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("recordUsageAction failed", error);
    return { ok: false, error: "usage_failed" };
  }
  return { ok: true, data: undefined };
}

// 显式引用以保持导出类型稳定（避免 tsc 未使用告警）
export type { Job, NotificationKind };

// ---------------------------------------------------------------------------
// AI 点数（2026-10 计费重构）
// ---------------------------------------------------------------------------

export type PurchaseCreditsData = {
  credits: CreditsState;
  order: PurchaseOrder;
  provider: PayProvider;
  simulated: boolean;
};

/**
 * 购买点数套餐（一次性，不自动续费）。
 * manual 渠道会同步到账；真实渠道未接入时返回明确错误而不是假成功。
 */
export async function purchaseCreditsAction(
  packageId: string,
): Promise<WorkspaceResult<PurchaseCreditsData>> {
  const userId = await requireUser();
  try {
    const result = await purchaseCreditPackage(userId, packageId);
    if (!result.ok) {
      return { ok: false, error: result.error, message: result.message };
    }
    return {
      ok: true,
      data: {
        credits: result.credits,
        order: result.order,
        provider: result.provider,
        simulated: result.simulated,
      },
    };
  } catch (error) {
    console.error("purchaseCreditsAction failed", error);
    return { ok: false, error: "purchase_failed", message: "购买失败，请稍后重试" };
  }
}

/** 只刷新点数状态（AI 调用后、跨天后下拉刷新等场景）。 */
export async function refreshCreditsAction(): Promise<CreditsState> {
  const userId = await requireUser();
  return getCreditsState(userId);
}

/** 最近点数流水（设置页「点数明细」）。 */
export async function getCreditLedgerAction(): Promise<CreditLedgerEntry[]> {
  const userId = await requireUser();
  return getCreditLedger(userId, 20);
}
