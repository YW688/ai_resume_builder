import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  resumes,
  experiences,
  educations,
  jobs,
} from "@/drizzle/schema";
import { getUserId } from "@/lib/dal";
import {
  renderResumePdf,
  type ResumePdfEducation,
  type ResumePdfExperience,
  type ResumePdfInput,
} from "@/lib/pdf";
import type { AccentId, TemplateId } from "@/lib/mock/types";

/** 照片既支持已上传的公开 URL，也支持编辑器里尚未保存的本地 data URL。 */
function photoUrl(photoKey: string | null): string | null {
  if (!photoKey) return null;
  const base = process.env.NEON_STORAGE_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/${photoKey}` : null;
}

function pdfResponse(pdf: Buffer, fullName: string): Response {
  const safeName =
    fullName.replace(/[\\/:*?"<>|\r\n]/g, "").trim().slice(0, 40) || "简历";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // HTTP 头只能是 latin1：中文文件名放 filename*（RFC 5987），ASCII 用 filename 兜底。
      "Content-Disposition": `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(
        `${safeName}.pdf`,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}

function rowToPdfInput(input: {
  resume: typeof resumes.$inferSelect;
  experiences: (typeof experiences.$inferSelect)[];
  educations: (typeof educations.$inferSelect)[];
  jobTitle?: string;
}): ResumePdfInput {
  return {
    fullName: input.resume.fullName,
    phone: input.resume.phone ?? "",
    email: input.resume.email ?? "",
    city: input.resume.city ?? "",
    summary: input.resume.summary ?? "",
    skills: input.resume.skills ?? "",
    photoUrl: photoUrl(input.resume.photoKey),
    // 与 loadWorkspace 的展示规则一致：默认用姓名首字作头像。
    photoInitials: input.resume.fullName ? input.resume.fullName.slice(0, 1) : "",
    templateId: (input.resume.templateId as TemplateId) ?? "classic",
    accent: (input.resume.accent as AccentId) ?? "blue",
    jobTitle: input.jobTitle,
    experiences: input.experiences.map((exp) => ({
      company: exp.company ?? "",
      title: exp.title ?? "",
      startDate: exp.startDate ?? "",
      endDate: exp.endDate ?? "",
      description: exp.description ?? "",
    })),
    educations: input.educations.map((edu) => ({
      school: edu.school ?? "",
      degree: edu.degree ?? "",
      major: edu.major ?? "",
      startDate: edu.startDate ?? "",
      endDate: edu.endDate ?? "",
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resumeId: string }> },
) {
  const { resumeId } = await params;

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  const resume = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
  });
  if (!resume) {
    return NextResponse.json({ message: "简历不存在" }, { status: 404 });
  }

  // 导出免费、不限次数（新计费模型只对 AI 能力收取点数）。
  const [exps, edus, jobRows] = await Promise.all([
    db.query.experiences.findMany({
      where: eq(experiences.resumeId, resumeId),
      orderBy: [asc(experiences.sortOrder)],
    }),
    db.query.educations.findMany({
      where: eq(educations.resumeId, resumeId),
      orderBy: [asc(educations.sortOrder)],
    }),
    resume.targetJobId
      ? db
          .select({ title: jobs.title })
          .from(jobs)
          .where(and(eq(jobs.id, resume.targetJobId), eq(jobs.userId, userId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const pdf = await renderResumePdf(
    rowToPdfInput({
      resume,
      experiences: exps,
      educations: edus,
      jobTitle: jobRows[0]?.title,
    }),
  );

  return pdfResponse(pdf, resume.fullName);
}

/* ------------------------------------------------------------------ */
/* POST：编辑器当前草稿直接导出（含未落库的编辑与本地预览照片）          */
/* ------------------------------------------------------------------ */

const MAX_BODY_CHARS = 8_000_000;
const MAX_PHOTO_CHARS = 5_000_000;
const TEMPLATES: TemplateId[] = ["classic", "split", "compact"];
const ACCENTS: AccentId[] = ["blue", "ink", "green"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * 照片 URL 白名单：只接受本地 data:image 或 Neon Storage 公开前缀下的地址。
 * 不能放行任意 https://（服务端渲染 PDF 时会把 URL 交给图片加载器，形成 SSRF）。
 * 不匹配时直接丢弃并回退到姓名首字，不抛错。
 */
function sanitizePhoto(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length > MAX_PHOTO_CHARS) return null;
  if (value.startsWith("data:image/")) return value;
  const base = (process.env.NEON_STORAGE_PUBLIC_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (base && value.startsWith(`${base}/`)) return value;
  return null;
}

function sanitizeExperiences(value: unknown): ResumePdfExperience[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      company: text(row.company, 100),
      title: text(row.title, 100),
      startDate: text(row.startDate, 20),
      endDate: text(row.endDate, 20),
      description: text(row.description, 8_000),
    };
  });
}

function sanitizeEducations(value: unknown): ResumePdfEducation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      school: text(row.school, 100),
      degree: text(row.degree, 100),
      major: text(row.major, 100),
      startDate: text(row.startDate, 20),
      endDate: text(row.endDate, 20),
    };
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resumeId: string }> },
) {
  const { resumeId } = await params;

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 });
  }

  // 只校验归属；内容以客户端传来的当前草稿为准（避免 600ms 防抖未落库的竞态）。
  const owned = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
    columns: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ message: "简历不存在" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ message: "简历数据过大" }, { status: 413 });
    }
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "请求格式不正确" }, { status: 400 });
  }

  const resume = (body.resume ?? {}) as Record<string, unknown>;
  const templateId = TEMPLATES.includes(resume.templateId as TemplateId)
    ? (resume.templateId as TemplateId)
    : "classic";
  const accent = ACCENTS.includes(resume.accent as AccentId)
    ? (resume.accent as AccentId)
    : "blue";

  const pdf = await renderResumePdf({
    fullName: text(resume.fullName, 60),
    phone: text(resume.phone, 40),
    email: text(resume.email, 120),
    city: text(resume.city, 60),
    summary: text(resume.summary, 4_000),
    skills: Array.isArray(resume.skills)
      ? resume.skills.slice(0, 30).map((item) => text(item, 60))
      : text(resume.skills, 2_000),
    experiences: sanitizeExperiences(resume.experiences),
    educations: sanitizeEducations(resume.educations),
    jobTitle: text(resume.jobTitle, 100),
    photoUrl: sanitizePhoto(body.photoUrl),
    // 客户端显式传空表示移除了头像；不传则退回姓名首字。
    photoInitials:
      resume.photoInitials === undefined
        ? undefined
        : text(resume.photoInitials, 4),
    templateId,
    accent,
  });

  return pdfResponse(pdf, text(resume.fullName, 60));
}
