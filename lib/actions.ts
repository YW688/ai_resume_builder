"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  users,
  resumes,
  experiences,
  educations,
  aiRewrites,
} from "@/drizzle/schema";
import { getUserId } from "@/lib/dal";
import {
  consumeAi,
  canCreateResume,
  getUsage,
  FREE_LIMITS,
} from "@/lib/quota";
import { rewriteExperience } from "@/lib/ai";
import {
  uploadPhoto,
  deletePhoto,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_TYPES,
} from "@/lib/storage";
import { createCheckoutUrl } from "@/lib/lemonSqueezy";

// ---- 类型 ----
export type ExperienceInput = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EducationInput = {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type ResumeInput = {
  resumeId: string | null;
  title: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  skills: string;
  photoKey: string | null;
  experiences: ExperienceInput[];
  educations: EducationInput[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string };

// ---- 内部工具 ----
async function getOrCreateUser(userId: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (existing) return existing;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  await db.insert(users).values({ id: userId, email }).onConflictDoNothing();
  return (await db.query.users.findFirst({ where: eq(users.id, userId) }))!;
}

function photoUrl(photoKey: string | null): string | null {
  if (!photoKey) return null;
  const base = process.env.NEON_STORAGE_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/${photoKey}` : null;
}

// ---- 简历 ----
export async function saveResume(
  input: ResumeInput,
): Promise<ActionResult<{ resumeId: string }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const clean = (s: string) => (s ?? "").trim();
  let resumeId = input.resumeId;

  if (resumeId) {
    const owned = await db.query.resumes.findFirst({
      where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
    });
    if (!owned) return { ok: false, error: "not_found" };

    await db
      .update(resumes)
      .set({
        title: clean(input.title) || "我的简历",
        fullName: clean(input.fullName),
        phone: clean(input.phone),
        email: clean(input.email),
        city: clean(input.city),
        summary: input.summary,
        skills: input.skills,
        photoKey: input.photoKey,
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, resumeId));
  } else {
    const can = await canCreateResume(userId);
    if (!can) {
      return {
        ok: false,
        error: "limit_reached",
        message: `免费版只能创建 ${FREE_LIMITS.resumes} 份简历，升级付费版即可无限创建`,
      };
    }

    const [row] = await db
      .insert(resumes)
      .values({
        userId,
        title: clean(input.title) || "我的简历",
        fullName: clean(input.fullName),
        phone: clean(input.phone),
        email: clean(input.email),
        city: clean(input.city),
        summary: input.summary,
        skills: input.skills,
        photoKey: input.photoKey,
      })
      .returning({ id: resumes.id });
    resumeId = row.id;
  }

  // 全量替换子项（自动保存发送完整状态，sortOrder = 数组下标）
  await db.delete(experiences).where(eq(experiences.resumeId, resumeId));
  await db.delete(educations).where(eq(educations.resumeId, resumeId));

  for (const [i, e] of input.experiences.entries()) {
    await db.insert(experiences).values({
      resumeId,
      company: clean(e.company),
      title: clean(e.title),
      startDate: clean(e.startDate),
      endDate: clean(e.endDate),
      description: e.description,
      sortOrder: i,
    });
  }
  for (const [i, e] of input.educations.entries()) {
    await db.insert(educations).values({
      resumeId,
      school: clean(e.school),
      degree: clean(e.degree),
      major: clean(e.major),
      startDate: clean(e.startDate),
      endDate: clean(e.endDate),
      sortOrder: i,
    });
  }

  return { ok: true, data: { resumeId } };
}

export type ResumeData = {
  resumeId: string;
  title: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  skills: string;
  photoKey: string | null;
  photoUrl: string | null;
  experiences: ExperienceInput[];
  educations: EducationInput[];
};

export async function getLatestResume(): Promise<ActionResult<ResumeData | null>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const resume = await db.query.resumes.findFirst({
    where: eq(resumes.userId, userId),
    orderBy: [desc(resumes.updatedAt)],
  });
  if (!resume) return { ok: true, data: null };

  const exps = await db.query.experiences.findMany({
    where: eq(experiences.resumeId, resume.id),
    orderBy: [asc(experiences.sortOrder)],
  });
  const edus = await db.query.educations.findMany({
    where: eq(educations.resumeId, resume.id),
    orderBy: [asc(educations.sortOrder)],
  });

  return {
    ok: true,
    data: {
      resumeId: resume.id,
      title: resume.title,
      fullName: resume.fullName,
      phone: resume.phone ?? "",
      email: resume.email ?? "",
      city: resume.city ?? "",
      summary: resume.summary ?? "",
      skills: resume.skills ?? "",
      photoKey: resume.photoKey,
      photoUrl: photoUrl(resume.photoKey),
      experiences: exps.map((e) => ({
        company: e.company,
        title: e.title,
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        description: e.description ?? "",
      })),
      educations: edus.map((e) => ({
        school: e.school,
        degree: e.degree ?? "",
        major: e.major ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
      })),
    },
  };
}

export async function getResume(resumeId: string): Promise<ActionResult<ResumeData>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) return { ok: false, error: "not_found" };

  const exps = await db.query.experiences.findMany({
    where: eq(experiences.resumeId, resume.id),
    orderBy: [asc(experiences.sortOrder)],
  });
  const edus = await db.query.educations.findMany({
    where: eq(educations.resumeId, resume.id),
    orderBy: [asc(educations.sortOrder)],
  });

  return {
    ok: true,
    data: {
      resumeId: resume.id,
      title: resume.title,
      fullName: resume.fullName,
      phone: resume.phone ?? "",
      email: resume.email ?? "",
      city: resume.city ?? "",
      summary: resume.summary ?? "",
      skills: resume.skills ?? "",
      photoKey: resume.photoKey,
      photoUrl: photoUrl(resume.photoKey),
      experiences: exps.map((e) => ({
        company: e.company,
        title: e.title,
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        description: e.description ?? "",
      })),
      educations: edus.map((e) => ({
        school: e.school,
        degree: e.degree ?? "",
        major: e.major ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
      })),
    },
  };
}

export async function deleteResume(resumeId: string): Promise<ActionResult<null>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) return { ok: false, error: "not_found" };

  if (resume.photoKey) await deletePhoto(resume.photoKey).catch(() => {});
  await db.delete(resumes).where(eq(resumes.id, resumeId));

  return { ok: true, data: null };
}

// ---- 照片 ----
export async function uploadPhotoAction(
  formData: FormData,
): Promise<ActionResult<{ key: string; url: string }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "invalid" };
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: "type", message: "仅支持 jpg / png / webp 图片" };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "size", message: "图片不能超过 5MB" };
  }

  const key = await uploadPhoto(userId, file);
  const url = photoUrl(key);
  if (!url) return { ok: false, error: "storage", message: "存储配置缺失" };

  const oldKey = formData.get("oldKey");
  if (typeof oldKey === "string" && oldKey) {
    await deletePhoto(oldKey).catch(() => {});
  }

  return { ok: true, data: { key, url } };
}

// ---- AI 改写 ----
export async function rewriteExperienceAction(input: {
  resumeId: string | null;
  experience: ExperienceInput;
  jd: string;
}): Promise<ActionResult<{ text: string }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (!input.jd.trim()) {
    return { ok: false, error: "invalid", message: "请先粘贴职位描述（JD）" };
  }

  const usage = await getUsage(userId);
  if (usage.plan === "free" && usage.aiUsed >= FREE_LIMITS.ai) {
    return { ok: false, error: "limit_reached", message: "免费 AI 改写次数已用完，升级付费版解锁无限" };
  }

  let text: string;
  try {
    text = await rewriteExperience({
      experience: input.experience,
      jd: input.jd,
    });
  } catch {
    return { ok: false, error: "ai_error", message: "AI 改写失败，请稍后重试" };
  }

  const consumed = await consumeAi(userId);
  if (!consumed.ok) {
    return { ok: false, error: "limit_reached", message: consumed.message };
  }

  await db.insert(aiRewrites).values({
    userId,
    resumeId: input.resumeId,
    jdSnapshot: input.jd,
    output: text,
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  });

  return { ok: true, data: { text } };
}

// ---- 配额 / 账户 ----
export async function getUsageAction() {
  const userId = await getUserId();
  if (!userId) return null;
  return getUsage(userId);
}

export async function createCheckoutAction(): Promise<ActionResult<{ url: string }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  const user = await getOrCreateUser(userId);
  const url = await createCheckoutUrl({ userId, email: user.email });
  if (!url) {
    return { ok: false, error: "checkout", message: "支付配置缺失，请稍后再试" };
  }
  return { ok: true, data: { url } };
}

export async function deleteAccount(): Promise<ActionResult<null>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "unauthorized" };

  // 删除照片对象
  const userResumes = await db.query.resumes.findMany({
    where: eq(resumes.userId, userId),
    columns: { photoKey: true },
  });
  for (const r of userResumes) {
    if (r.photoKey) await deletePhoto(r.photoKey).catch(() => {});
  }

  // 取消 Lemon Squeezy 订阅（TODO M6：调 LS API 取消活跃订阅）

  // 级联删除 DB 数据
  await db.delete(users).where(eq(users.id, userId));

  // 删除 Clerk 用户（尽力而为）
  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch {
    // 若 Clerk 删除失败，本地数据已清，仅记录
  }

  return { ok: true, data: null };
}
