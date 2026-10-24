import "server-only";

import { callAi } from "./ai/client";
import { parsePlainText } from "./ai/parse";

/**
 * 兼容旧调用入口（`lib/actions.ts` 的 rewriteExperienceAction 仍在使用）。
 *
 * 新代码请直接用：
 * - `lib/ai/actions.ts` 的 Server Actions（带点数预扣 / 退款 / 流水）
 * - `lib/ai/client.ts` 的 `callAi()`（底层 DeepSeek 客户端）
 */
export async function rewriteExperience(args: {
  experience: { company: string; title: string; description: string };
  jd: string;
}): Promise<string> {
  const { experience, jd } = args;

  const system = [
    "你是一位资深中文简历优化专家。",
    "用户会给你一段工作经历和一条职位描述（JD）。",
    "请把这段经历改写成针对该 JD 的版本，要求：",
    "1) 覆盖 JD 中的关键词与技能要求；",
    "2) 优先保留原文已有的量化成果，不得编造数字；",
    "3) 保持中文书面语，简洁、有力、符合简历措辞；",
    "4) 只输出改写后的经历描述文本，3–4 行用换行分隔，不要任何解释、前缀或 Markdown。",
  ].join("\n");

  const user = [
    "## 原工作经历",
    `公司：${experience.company}`,
    `职位：${experience.title}`,
    `描述：${experience.description || "（无）"}`,
    "",
    "## 目标职位描述（JD）",
    jd,
  ].join("\n");

  const result = await callAi({
    system,
    user,
    format: "text",
    temperature: 0.3,
    mock: () =>
      [
        `主导${experience.title || "核心"}方向的方案设计与落地，围绕 JD 要求推进关键任务并按期交付。`,
        "以数据复盘迭代效果，持续优化流程与用户路径，沉淀可复用的方法文档。",
        "协同跨团队推进执行，对齐需求与排期，保障版本稳定交付。",
      ].join("\n"),
  });

  return parsePlainText(result.text);
}
