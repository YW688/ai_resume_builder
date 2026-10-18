import "server-only";
import OpenAI from "openai";

const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

function client() {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: BASE_URL,
  });
}

const SYSTEM_PROMPT = [
  "你是一位资深中文简历优化专家。",
  "用户会给你一段工作经历和一条职位描述（JD）。",
  "请把这段经历改写成针对该 JD 的版本，要求：",
  "1) 覆盖 JD 中的关键词与技能要求；",
  "2) 尽量给出可量化的成果（数字、百分比、规模）；",
  "3) 保持中文，简洁、有力、符合简历措辞；",
  "4) 只输出改写后的经历描述文本，不要任何解释、前缀或 Markdown。",
].join("\n");

export async function rewriteExperience(args: {
  experience: { company: string; title: string; description: string };
  jd: string;
}): Promise<string> {
  const { experience, jd } = args;

  const userContent = [
    "## 原工作经历",
    `公司：${experience.company}`,
    `职位：${experience.title}`,
    `描述：${experience.description || "（无）"}`,
    "",
    "## 目标职位描述（JD）",
    jd,
  ].join("\n");

  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}
