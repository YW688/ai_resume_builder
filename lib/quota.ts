import "server-only";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, resumes } from "@/drizzle/schema";

export const FREE_LIMITS = {
  resumes: 1,
  ai: 2,
  exports: 2,
} as const;

export type QuotaResult =
  | { ok: true }
  | { ok: false; code: "limit_reached"; message: string };

function limitMessage(kind: string): string {
  return `免费额度已用完（${kind}），升级到付费版即可无限使用`;
}

/**
 * 原子地消耗一次 AI 改写额度。
 * 付费用户不限；免费用户超过 FREE_LIMITS.ai 则拒绝。
 */
export async function consumeAi(userId: string): Promise<QuotaResult> {
  const updated = await db
    .update(users)
    .set({ aiUsed: sql`${users.aiUsed} + 1` })
    .where(
      and(
        eq(users.id, userId),
        or(eq(users.plan, "paid"), sql`${users.aiUsed} < ${FREE_LIMITS.ai}`),
      ),
    )
    .returning({ id: users.id });

  if (updated.length === 0) {
    return { ok: false, code: "limit_reached", message: limitMessage("AI 改写") };
  }
  return { ok: true };
}

/** 原子地消耗一次 PDF 导出额度。 */
export async function consumeExport(userId: string): Promise<QuotaResult> {
  const updated = await db
    .update(users)
    .set({ exportUsed: sql`${users.exportUsed} + 1` })
    .where(
      and(
        eq(users.id, userId),
        or(
          eq(users.plan, "paid"),
          sql`${users.exportUsed} < ${FREE_LIMITS.exports}`,
        ),
      ),
    )
    .returning({ id: users.id });

  if (updated.length === 0) {
    return { ok: false, code: "limit_reached", message: limitMessage("PDF 下载") };
  }
  return { ok: true };
}

/** 免费档是否还能新建简历。付费用户不限。 */
export async function canCreateResume(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.plan === "paid") return true;
  const count = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(resumes)
    .where(eq(resumes.userId, userId));
  return (count[0]?.n ?? 0) < FREE_LIMITS.resumes;
}

export type Usage = {
  plan: "free" | "paid";
  aiUsed: number;
  exportUsed: number;
  resumeCount: number;
  // null = 不限（付费）
  aiLimit: number | null;
  exportLimit: number | null;
  resumeLimit: number | null;
};

export async function getUsage(userId: string): Promise<Usage> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const paid = user?.plan === "paid";
  const resumeCount =
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(resumes)
        .where(eq(resumes.userId, userId))
    )[0]?.n ?? 0;

  return {
    plan: paid ? "paid" : "free",
    aiUsed: user?.aiUsed ?? 0,
    exportUsed: user?.exportUsed ?? 0,
    resumeCount,
    aiLimit: paid ? null : FREE_LIMITS.ai,
    exportLimit: paid ? null : FREE_LIMITS.exports,
    resumeLimit: paid ? null : FREE_LIMITS.resumes,
  };
}
