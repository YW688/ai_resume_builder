import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  applications,
  creditLedger,
  educations,
  experiences,
  jobs,
  notifications,
  orders,
  preferences,
  resumes,
} from "@/drizzle/schema";
import { initialWorkspace } from "@/lib/mock/data";

/**
 * 演示数据的服务端种子逻辑。
 *
 * 历史遗留数据（lib/mock/data.ts）用的是 `r1` / `j1` 这类字符串 id，
 * 而数据库主键是 uuid，所以这里建立 id 映射，把演示数据完整写入某个
 * 真实用户（Neon Auth user id）名下。首登录与「重置演示数据」共用。
 */
const DEMO = initialWorkspace;

/**
 * 演示数据 / 演示功能是否启用。
 * 生产环境默认关闭；只有本地开发或显式 `DEMO_MODE=1` 时才允许写入演示
 * 套餐、点数与业务数据，避免线上新用户被免费提权。
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1";
}

function uuid(): string {
  return crypto.randomUUID();
}

/** 清空某个用户的全部业务数据（保留 users 行本身）。 */
export async function clearWorkspace(userId: string): Promise<void> {
  // applications 依赖 resumes，先删
  await db.delete(applications).where(eq(applications.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(resumes).where(eq(resumes.userId, userId)); // experiences/educations 级联
  await db.delete(jobs).where(eq(jobs.userId, userId));
  await db.delete(orders).where(eq(orders.userId, userId));
  await db.delete(creditLedger).where(eq(creditLedger.userId, userId));
  await db.delete(preferences).where(eq(preferences.userId, userId));
}

/**
 * 把演示工作区写入指定用户。调用方负责先清空（或确认是空账号）。
 * 返回写入后的 id 映射，便于调用方继续引用。
 */
export async function seedDemoWorkspace(userId: string): Promise<void> {
  const jobIds = new Map(DEMO.jobs.map((job) => [job.id, uuid()]));
  const resumeIds = new Map(DEMO.resumes.map((resume) => [resume.id, uuid()]));

  const experienceRows = DEMO.resumes.flatMap((resume) => {
    const resumeId = resumeIds.get(resume.id)!;
    return resume.experiences.map((experience, index) => ({
      id: uuid(),
      resumeId,
      company: experience.company,
      title: experience.title,
      startDate: experience.startDate,
      endDate: experience.endDate,
      description: experience.description,
      sortOrder: index,
    }));
  });

  const educationRows = DEMO.resumes.flatMap((resume) => {
    const resumeId = resumeIds.get(resume.id)!;
    return resume.educations.map((education, index) => ({
      id: uuid(),
      resumeId,
      school: education.school,
      degree: education.degree,
      major: education.major,
      startDate: education.startDate,
      endDate: education.endDate,
      sortOrder: index,
    }));
  });

  // 首登录种子会被 /dashboard 首屏阻塞，尽量并行化独立的写入波次：
  // users 已存在；jobs / preferences / notifications / orders 互不依赖，先并行；
  // resumes 依赖 jobs；experiences / educations / applications 依赖 resumes。
  await Promise.all([
    DEMO.jobs.length > 0
      ? db.insert(jobs).values(
          DEMO.jobs.map((job, index) => ({
            id: jobIds.get(job.id)!,
            userId,
            company: job.company,
            title: job.title,
            location: job.location,
            salary: job.salary,
            source: job.source,
            savedAt: new Date(job.savedAt),
            keywords: job.keywords,
            jdText: job.jdText,
            sortOrder: index,
          })),
        )
      : Promise.resolve(),
    db
      .insert(preferences)
      .values({
        userId,
        targetRoles: DEMO.preferences.targetRoles,
        cities: DEMO.preferences.cities,
        salary: DEMO.preferences.salary,
        jobType: DEMO.preferences.jobType,
        weeklyDigest: DEMO.preferences.weeklyDigest,
        autoKeywordCheck: DEMO.preferences.autoKeywordCheck,
      })
      .onConflictDoNothing(),
    DEMO.notifications.length > 0
      ? db.insert(notifications).values(
          DEMO.notifications.map((notification, index) => ({
            id: uuid(),
            userId,
            title: notification.title,
            body: notification.body,
            at: new Date(notification.at),
            read: notification.read,
            kind: notification.kind,
            sortOrder: index,
          })),
        )
      : Promise.resolve(),
    DEMO.plan.orders.length > 0
      ? db.insert(orders).values(
          DEMO.plan.orders.map((order, index) => ({
            id: uuid(),
            userId,
            at: new Date(order.at),
            amountFen: order.amountFen,
            label: order.label,
            status: order.status,
            packageId: order.packageId ?? null,
            credits: order.credits ?? 0,
            provider: "manual",
            paidAt: new Date(order.at),
            sortOrder: index,
          })),
        )
      : Promise.resolve(),
    // 演示点数流水：让「余额 18」在设置页的明细里有据可查（45 购买 - 27 消耗）。
    db.insert(creditLedger).values([
      {
        userId,
        delta: 45,
        balanceAfter: 45,
        kind: "purchase",
        feature: null,
        ref: null,
        note: "求职包 · 45 点（演示数据）",
        createdAt: new Date("2026-10-06T10:12:00+08:00"),
      },
      {
        userId,
        delta: -27,
        balanceAfter: 18,
        kind: "spend",
        feature: "resume_generate",
        ref: null,
        note: "AI 整份生成与段落润色（演示数据）",
        createdAt: new Date("2026-10-20T21:30:00+08:00"),
      },
    ]),
  ]);

  if (DEMO.resumes.length > 0) {
    await db.insert(resumes).values(
      DEMO.resumes.map((resume, index) => ({
        id: resumeIds.get(resume.id)!,
        userId,
        targetJobId: resume.targetJobId
          ? (jobIds.get(resume.targetJobId) ?? null)
          : null,
        title: resume.title,
        fullName: resume.fullName,
        phone: resume.phone,
        email: resume.email,
        city: resume.city,
        summary: resume.summary,
        skills: resume.skills.join("\n"),
        templateId: resume.templateId,
        accent: resume.accent,
        status: resume.status,
        createdAt: new Date(resume.createdAt),
        updatedAt: new Date(resume.updatedAt),
        // 仅用于让后续列表顺序与演示数组一致；数据库没有该列时忽略
        _demoIndex: index,
      })).map(({ _demoIndex: _ignored, ...row }) => row),
    );
  }

  await Promise.all([
    experienceRows.length > 0
      ? db.insert(experiences).values(experienceRows)
      : Promise.resolve(),
    educationRows.length > 0
      ? db.insert(educations).values(educationRows)
      : Promise.resolve(),
    DEMO.applications.length > 0
      ? db.insert(applications).values(
          DEMO.applications.map((application, index) => ({
            id: uuid(),
            userId,
            company: application.company,
            role: application.role,
            resumeId: resumeIds.get(application.resumeId)!,
            stage: application.stage,
            appliedAt: new Date(application.appliedAt),
            nextStep: application.nextStep ?? null,
            nextAt: application.nextAt ? new Date(application.nextAt) : null,
            note: application.note ?? null,
            sortOrder: index,
          })),
        )
      : Promise.resolve(),
  ]);
}
