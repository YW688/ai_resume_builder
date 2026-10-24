"use server";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiRewrites, educations, experiences, jobs, resumes } from "@/drizzle/schema";
import { requireUser } from "@/lib/dal";
import { CREDIT_FEATURES, type CreditFeature, type CreditsState } from "@/lib/credits/catalog";
import { consumeCredits, getCreditsState, refundCredits } from "@/lib/credits/server";
import {
  matchSkillFamilies,
  type SkillFamily,
} from "@/lib/skills";
import {
  AiNotConfiguredError,
  AiRequestError,
  callAi,
  isAiConfigured,
} from "./client";
import { AiParseError, parseGeneratedResume, parseParagraph, parsePlainText, parseSkills } from "./parse";
import {
  buildGenerateResumePrompt,
  buildJdRewritePrompt,
  buildProjectPolishPrompt,
  buildSkillsPolishPrompt,
  buildSummaryPolishPrompt,
  type PromptContext,
  type PromptExperience,
  type PromptResume,
} from "./prompts";

/**
 * AI 简历润色 Server Actions。
 *
 * 统一流程（同 task-3 契约）：
 *   requireUser() → 校验简历归属 / JD → **未配置 API 直接报错不扣点**
 *   → consumeCredits 预扣 → 调 DeepSeek → 失败 / 解析失败 refundCredits
 *   → 成功写 ai_rewrites → 用 getCreditsState 回读最新点数并随 data 返回。
 *
 * 所有返回值都是可序列化的普通对象（Server Action 的硬要求）。
 * 点数价格只从 `lib/credits/catalog.ts` 读取，不在本文件写死数字。
 */

export type AiErrorCode =
  | "unauthorized"
  | "invalid"
  | "ai_not_configured"
  | "insufficient_credits"
  | "ai_error"
  | "parse_error";

export type AiActionFailure = {
  ok: false;
  error: AiErrorCode;
  message: string;
  /** 本次应消耗 / 已退回的点数。 */
  cost?: number;
  /** 失败时的最新点数状态（额度不足时用于刷新 UI）。 */
  credits?: CreditsState;
};

export type AiActionSuccess<T> = {
  ok: true;
  data: T & { credits: CreditsState; cost: number; model: string };
};

export type AiActionResult<T> = AiActionSuccess<T> | AiActionFailure;

/** 客户端可传入的经历快照：用于刚编辑、600ms 防抖还没落库的边界情况。 */
export type ExperienceSnapshot = {
  company?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function fail(
  error: AiErrorCode,
  message: string,
  extra?: { cost?: number; credits?: CreditsState },
): AiActionFailure {
  return { ok: false, error, message, ...extra };
}

type ResumeRow = typeof resumes.$inferSelect;
type ExperienceRow = typeof experiences.$inferSelect;

type LoadedResume = {
  resume: ResumeRow;
  experiences: ExperienceRow[];
  educations: (typeof educations.$inferSelect)[];
  /** 目标岗位名（用于匹配岗位族）；没有目标岗位时为 undefined。 */
  targetRole?: string;
};

/** 读取当前用户名下的简历 + 经历 + 教育 + 目标岗位（一次查询足够）。 */
async function loadOwnedResume(
  userId: string,
  resumeId: string,
): Promise<LoadedResume | null> {
  if (!isUuid(resumeId)) return null;

  const resumeRows = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .limit(1);
  const resume = resumeRows[0];
  if (!resume) return null;

  const [experienceRows, educationRows, jobRows] = await Promise.all([
    db
      .select()
      .from(experiences)
      .where(eq(experiences.resumeId, resume.id))
      .orderBy(asc(experiences.sortOrder)),
    db
      .select()
      .from(educations)
      .where(eq(educations.resumeId, resume.id))
      .orderBy(asc(educations.sortOrder)),
    resume.targetJobId
      ? db
          .select({ title: jobs.title, jdText: jobs.jdText })
          .from(jobs)
          .where(and(eq(jobs.id, resume.targetJobId), eq(jobs.userId, userId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    resume,
    experiences: experienceRows,
    educations: educationRows,
    targetRole: jobRows[0]?.title,
  };
}

function toPromptExperience(row: ExperienceRow): PromptExperience {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    startDate: row.startDate ?? "",
    endDate: row.endDate ?? "",
    description: row.description ?? "",
  };
}

function toPromptResume(loaded: LoadedResume): PromptResume {
  return {
    fullName: loaded.resume.fullName,
    city: loaded.resume.city ?? undefined,
    summary: loaded.resume.summary ?? "",
    skills: (loaded.resume.skills ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    experiences: loaded.experiences.map(toPromptExperience),
    educations: loaded.educations.map((row) => ({
      school: row.school,
      degree: row.degree ?? "",
      major: row.major ?? "",
      startDate: row.startDate ?? "",
      endDate: row.endDate ?? "",
    })),
  };
}

function buildContext(
  jd: string,
  targetRole: string | undefined,
  resume: PromptResume,
): PromptContext {
  const families: SkillFamily[] = matchSkillFamilies({
    jd,
    targetRole,
    limit: 2,
  });
  // 兜底：匹配不到时至少给「通用」参考（matchSkillFamilies 已内置，这里防御性处理）。
  return {
    jd,
    targetRole: targetRole || resume.experiences[0]?.title,
    families,
  };
}

/** 写 ai_rewrites 流水；失败只记日志，不影响用户已经拿到的结果。 */
async function recordAiRewrite(input: {
  userId: string;
  resumeId: string;
  experienceId?: string | null;
  jd: string;
  prompt: string;
  output: string;
  model: string;
}): Promise<void> {
  try {
    await db.insert(aiRewrites).values({
      userId: input.userId,
      resumeId: input.resumeId,
      experienceId:
        input.experienceId && isUuid(input.experienceId) ? input.experienceId : null,
      jdSnapshot: input.jd.slice(0, 8000),
      prompt: input.prompt.slice(0, 8000),
      output: input.output.slice(0, 12000),
      model: input.model,
    });
  } catch (error) {
    console.error("[ai] 写 ai_rewrites 失败", error);
  }
}

type PromptBundle = { system: string; user: string; mock: () => string };

type RunAiOptions<T> = {
  userId: string;
  feature: CreditFeature;
  /** 流水关联 id（ai_rewrites / credit_ledger 的 ref）。 */
  ref: string;
  jd: string;
  prompt: PromptBundle;
  format: "text" | "json";
  temperature?: number;
  parse: (raw: string) => T;
  record?: { resumeId: string; experienceId?: string | null };
};

/**
 * 预扣 → 调 AI → 解析 → 退款 / 流水 → 回读点数。
 * 成功返回 data + credits + cost + model；失败返回可序列化的错误对象。
 */
async function runAi<T>(options: RunAiOptions<T>): Promise<AiActionResult<T>> {
  const feature = options.feature;
  const cost = CREDIT_FEATURES[feature].cost;

  // 1) 未配置 Key：明确报错，**绝不扣点**。
  if (!isAiConfigured()) {
    return fail(
      "ai_not_configured",
      "DeepSeek API 尚未配置，请联系管理员填写 DEEPSEEK_API_KEY",
      { cost },
    );
  }

  // 2) 预扣点数。
  const consumed = await consumeCredits(options.userId, feature, {
    ref: options.ref,
    note: CREDIT_FEATURES[feature].label,
  });
  if (!consumed.ok) {
    if (consumed.code === "insufficient_credits") {
      return fail("insufficient_credits", consumed.message, {
        cost,
        credits: consumed.state,
      });
    }
    return fail("unauthorized", "登录状态已失效，请重新登录", { cost });
  }
  const stateAfterCharge = consumed.state;

  // 3) 调用 AI。
  let text: string;
  let model: string;
  try {
    const result = await callAi({
      system: options.prompt.system,
      user: options.prompt.user,
      format: options.format,
      temperature: options.temperature,
      mock: options.prompt.mock,
    });
    text = result.text;
    model = result.model;
  } catch (error) {
    await refundCredits(options.userId, cost, {
      feature,
      ref: options.ref,
      note: `${CREDIT_FEATURES[feature].label}失败，自动退回`,
      fromDaily: consumed.fromDaily,
      fromBalance: consumed.fromBalance,
    }).catch((refundError) => {
      console.error("[ai] 退款失败", refundError);
    });

    if (error instanceof AiNotConfiguredError) {
      return fail("ai_not_configured", error.message, { cost });
    }
    if (error instanceof AiRequestError) {
      return fail("ai_error", error.message, { cost });
    }
    console.error("[ai] 调用失败", error);
    return fail("ai_error", "AI 调用失败，本次点数已退回，请稍后重试", { cost });
  }

  // 4) 解析（模型可能返回脏格式）；解析失败同样退点。
  let parsed: T;
  try {
    parsed = options.parse(text);
  } catch (error) {
    await refundCredits(options.userId, cost, {
      feature,
      ref: options.ref,
      note: `${CREDIT_FEATURES[feature].label}结果解析失败，自动退回`,
      fromDaily: consumed.fromDaily,
      fromBalance: consumed.fromBalance,
    }).catch((refundError) => {
      console.error("[ai] 退款失败", refundError);
    });
    if (error instanceof AiParseError) {
      return fail("parse_error", "AI 返回内容格式异常，本次点数已退回，请重试", {
        cost,
      });
    }
    console.error("[ai] 解析失败", error);
    return fail("parse_error", "AI 返回内容格式异常，本次点数已退回，请重试", {
      cost,
    });
  }

  // 5) 写流水（失败不影响结果）。
  if (options.record) {
    await recordAiRewrite({
      userId: options.userId,
      resumeId: options.record.resumeId,
      experienceId: options.record.experienceId,
      jd: options.jd,
      prompt: options.prompt.user,
      output: text,
      model,
    });
  }

  // 6) 回读点数（以数据库为准，避免前端拿旧值）。
  const credits =
    (await getCreditsState(options.userId).catch(() => undefined)) ?? stateAfterCharge;

  return {
    ok: true,
    data: { ...(parsed as Record<string, unknown>), credits, cost, model } as T & {
      credits: CreditsState;
      cost: number;
      model: string;
    },
  };
}

function requireJd(jd: string): string | null {
  const value = clean(jd);
  return value.length > 0 ? value.slice(0, 8000) : null;
}

/* ------------------------------------------------------------------ */
/* 1. 整份简历生成（2 点）                                             */
/* ------------------------------------------------------------------ */

export type GenerateResumeData = {
  summary: string;
  skills: string[];
  experiences: { id: string; description: string }[];
};

export async function generateResumeAction(input: {
  resumeId: string;
  jd: string;
}): Promise<AiActionResult<GenerateResumeData>> {
  const userId = await requireUser();

  const loaded = await loadOwnedResume(userId, clean(input.resumeId));
  if (!loaded) return fail("invalid", "简历不存在或无权访问");

  const jd = requireJd(input.jd);
  if (!jd) return fail("invalid", "请先在顶栏选择目标岗位（或填写 JD），再生成整份简历");

  const promptResume = toPromptResume(loaded);
  const expectedIds = promptResume.experiences.map((item) => item.id);
  const context = buildContext(jd, loaded.targetRole, promptResume);
  const prompt = buildGenerateResumePrompt(promptResume, context);

  const result = await runAi<GenerateResumeData>({
    userId,
    feature: "resume_generate",
    ref: loaded.resume.id,
    jd,
    prompt,
    format: "json",
    temperature: 0.45,
    parse: (raw) => {
      const generated = parseGeneratedResume(raw, expectedIds);
      // 模型漏掉的字段用原文兜底，避免把简历写空。
      const summary = generated.summary || promptResume.summary.trim();
      if (!summary) throw new AiParseError("AI 没有返回求职总结，请重试");
      const skills = generated.skills.length > 0 ? generated.skills : promptResume.skills;
      if (skills.length === 0) throw new AiParseError("AI 没有返回技能内容，请重试");

      const byId = new Map(generated.experiences.map((item) => [item.id, item.description]));
      const experiences = promptResume.experiences.map((item) => ({
        id: item.id,
        description: byId.get(item.id) || item.description,
      }));
      return { summary, skills, experiences };
    },
    record: { resumeId: loaded.resume.id },
  });

  return result;
}

/* ------------------------------------------------------------------ */
/* 2. 单段经历润色（1 点）                                             */
/* ------------------------------------------------------------------ */

export async function polishProjectAction(input: {
  resumeId: string;
  experienceId: string;
  jd: string;
  /** 刚编辑、可能尚未落库的经历快照（可选兜底）。 */
  experience?: ExperienceSnapshot;
}): Promise<AiActionResult<{ text: string }>> {
  const userId = await requireUser();

  const loaded = await loadOwnedResume(userId, clean(input.resumeId));
  if (!loaded) return fail("invalid", "简历不存在或无权访问");

  const jd = requireJd(input.jd);
  if (!jd) return fail("invalid", "请先在顶栏选择目标岗位（或填写 JD），再润色这段经历");

  const experienceId = clean(input.experienceId);
  const row = loaded.experiences.find((item) => item.id === experienceId);

  // 刚新增 / 刚编辑的经历可能还没保存到数据库：允许用客户端快照兜底。
  const target: PromptExperience | null = row
    ? toPromptExperience(row)
    : experienceId && input.experience
      ? {
          id: experienceId,
          company: clean(input.experience.company),
          title: clean(input.experience.title),
          startDate: clean(input.experience.startDate),
          endDate: clean(input.experience.endDate),
          description: clean(input.experience.description),
        }
      : null;

  if (!target) return fail("invalid", "这段经历还没有保存成功，请稍后重试");
  if (!target.description && !target.title && !target.company) {
    return fail("invalid", "这段经历还没有内容，先填写经历描述再让 AI 润色");
  }

  const promptResume = toPromptResume(loaded);
  const context = buildContext(jd, loaded.targetRole, promptResume);
  const prompt = buildProjectPolishPrompt(target, context, {
    resumeSummary: promptResume.summary,
    resumeSkills: promptResume.skills,
  });

  return runAi<{ text: string }>({
    userId,
    feature: "experience_polish",
    ref: row?.id ?? loaded.resume.id,
    jd,
    prompt,
    format: "text",
    temperature: 0.4,
    parse: (raw) => ({ text: parsePlainText(raw) }),
    record: { resumeId: loaded.resume.id, experienceId: row?.id ?? null },
  });
}

/* ------------------------------------------------------------------ */
/* 3. 技能栏整理（1 点）                                               */
/* ------------------------------------------------------------------ */

export async function polishSkillsAction(input: {
  resumeId: string;
  jd: string;
}): Promise<AiActionResult<{ skills: string[] }>> {
  const userId = await requireUser();

  const loaded = await loadOwnedResume(userId, clean(input.resumeId));
  if (!loaded) return fail("invalid", "简历不存在或无权访问");

  const jd = requireJd(input.jd);
  if (!jd) return fail("invalid", "请先在顶栏选择目标岗位（或填写 JD），再整理技能栏");

  const promptResume = toPromptResume(loaded);
  const context = buildContext(jd, loaded.targetRole, promptResume);
  const prompt = buildSkillsPolishPrompt(promptResume, context);

  return runAi<{ skills: string[] }>({
    userId,
    feature: "skills_polish",
    ref: loaded.resume.id,
    jd,
    prompt,
    format: "json",
    temperature: 0.3,
    parse: (raw) => ({ skills: parseSkills(raw) }),
    record: { resumeId: loaded.resume.id },
  });
}

/* ------------------------------------------------------------------ */
/* 4. 求职总结 / 自我评价润色（1 点）                                  */
/* ------------------------------------------------------------------ */

export async function polishSummaryAction(input: {
  resumeId: string;
  jd: string;
}): Promise<AiActionResult<{ text: string }>> {
  const userId = await requireUser();

  const loaded = await loadOwnedResume(userId, clean(input.resumeId));
  if (!loaded) return fail("invalid", "简历不存在或无权访问");

  const jd = requireJd(input.jd);
  if (!jd) return fail("invalid", "请先在顶栏选择目标岗位（或填写 JD），再润色求职总结");

  const promptResume = toPromptResume(loaded);
  const context = buildContext(jd, loaded.targetRole, promptResume);
  const prompt = buildSummaryPolishPrompt(promptResume, context);

  return runAi<{ text: string }>({
    userId,
    feature: "summary_polish",
    ref: loaded.resume.id,
    jd,
    prompt,
    format: "text",
    temperature: 0.5,
    parse: (raw) => ({ text: parseParagraph(raw) }),
    record: { resumeId: loaded.resume.id },
  });
}

/* ------------------------------------------------------------------ */
/* 5. 对照 JD 单段改写（1 点，兼容旧 RewriteDialog 能力）              */
/* ------------------------------------------------------------------ */

export async function rewriteJdAction(input: {
  resumeId: string;
  experienceId?: string;
  jd: string;
}): Promise<AiActionResult<{ text: string }>> {
  const userId = await requireUser();

  const loaded = await loadOwnedResume(userId, clean(input.resumeId));
  if (!loaded) return fail("invalid", "简历不存在或无权访问");

  const jd = requireJd(input.jd);
  if (!jd) return fail("invalid", "请先粘贴或选择职位描述（JD），再改写");

  const promptResume = toPromptResume(loaded);
  const context = buildContext(jd, loaded.targetRole, promptResume);

  // 带 experienceId 时改写该段经历；否则以求职总结为改写对象（旧弹窗的 summary 模式）。
  const experienceId = clean(input.experienceId);
  const row = experienceId
    ? loaded.experiences.find((item) => item.id === experienceId)
    : undefined;

  if (experienceId && !row) return fail("invalid", "这段经历还没有保存成功，请稍后重试");

  const target: PromptExperience = row
    ? toPromptExperience(row)
    : {
        id: "resume-summary",
        company: loaded.resume.title,
        title: "求职总结",
        startDate: "",
        endDate: "",
        description: promptResume.summary,
      };

  const prompt = buildJdRewritePrompt(target, context);

  return runAi<{ text: string }>({
    userId,
    feature: "jd_rewrite",
    ref: loaded.resume.id,
    jd,
    prompt,
    format: "text",
    temperature: 0.4,
    parse: (raw) => ({ text: parsePlainText(raw) }),
    record: { resumeId: loaded.resume.id, experienceId: row?.id ?? null },
  });
}
