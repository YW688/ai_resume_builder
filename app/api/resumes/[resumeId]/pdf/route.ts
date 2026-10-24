import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumes, experiences, educations } from "@/drizzle/schema";
import { getUserId } from "@/lib/dal";
import { renderResumePdf } from "@/lib/pdf";

function photoUrl(photoKey: string | null): string | null {
  if (!photoKey) return null;
  const base = process.env.NEON_STORAGE_PUBLIC_URL;
  return base ? `${base.replace(/\/$/, "")}/${photoKey}` : null;
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

  // PDF 导出免费、不限次数（新计费模型只对 AI 能力收取点数）。
  const exps = await db.query.experiences.findMany({
    where: eq(experiences.resumeId, resumeId),
    orderBy: [asc(experiences.sortOrder)],
  });
  const edus = await db.query.educations.findMany({
    where: eq(educations.resumeId, resumeId),
    orderBy: [asc(educations.sortOrder)],
  });

  const pdf = await renderResumePdf({
    fullName: resume.fullName,
    phone: resume.phone ?? "",
    email: resume.email ?? "",
    city: resume.city ?? "",
    summary: resume.summary ?? "",
    skills: resume.skills ?? "",
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
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="简历.pdf"`,
    },
  });
}
