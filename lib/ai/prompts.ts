import "server-only";

import {
  buildSkillReference,
  canonicalizeSkill,
  type SkillFamily,
} from "@/lib/skills";

/**
 * 中文简历 AI 提示词。
 *
 * 所有提示词共享同一套「简历专家 + 事实约束」系统提示词：
 * - 只润色用户真实提供的信息，不编造公司 / 学历 / 项目 / 数据；
 * - 量化优先，但**没有真实数字时禁止硬造百分比**，改用可验证的口径 / 规模；
 * - 对齐 JD 关键词，但不堆砌、不添加用户没做过的技能；
 * - 中文书面语、每条一行、严格按 action 输出 JSON 或纯文本。
 *
 * 技能参考来自 `lib/skills`（按岗位族匹配），只作为「规范写法」参考，
 * 不构成事实，不能凭空写进简历。
 */

export type PromptExperience = {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type PromptResume = {
  fullName: string;
  city?: string;
  summary: string;
  skills: string[];
  experiences: PromptExperience[];
  educations: {
    school: string;
    degree: string;
    major: string;
    startDate: string;
    endDate: string;
  }[];
};

export type PromptContext = {
  jd: string;
  /** 目标岗位名（顶栏选择的岗位 title），用于匹配岗位族。 */
  targetRole?: string;
  families: SkillFamily[];
};

const COMMON_RULES = `【硬性规则 · 违反即视为失败】
1. 只基于用户提供的真实信息改写。不得编造公司、职位、项目、学历、证书、奖项、时间，也不得虚构职责范围。
2. 量化优先，但**绝不编造数字**。用户原文没有数字时：
   - 可以用原文里已有的规模 / 口径（业务线数量、团队人数、覆盖城市、版本数等）做「可验证的规模描述」；
   - 完全没有任何数据时，用定性成果表达（如「按期交付」「形成可复用流程」），不要硬造百分比、金额、人数。
   - 用户原文有数字时必须保留，不能改大或改小。
3. 对齐目标 JD：自然融入 JD 关键词，而不是把关键词堆在句尾；不得添加用户没做过 / 没掌握过的技能。
4. 用中文书面语，简洁、具体、有力：用动作动词开头，结果 / 影响收尾；避免「负责了」「参与了」连续堆叠，避免空话套话。
5. 不输出解释、前言、道歉、Markdown 标题或代码块围栏（JSON 格式除外），不输出用户没问的内容。`;

function truncate(text: string, max: number): string {
  const value = (text ?? "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function formatSkillsReference(families: SkillFamily[]): string {
  const reference = buildSkillReference(families);
  if (!reference) return "";
  return `## 岗位技能参考（只用于规范写法与关键词对齐，不能当作事实新增）
${reference}`;
}

function formatExperiences(experiences: PromptExperience[]): string {
  if (experiences.length === 0) return "（暂无工作 / 项目经历）";
  return experiences
    .map((experience, index) => {
      const period = [experience.startDate, experience.endDate].filter(Boolean).join(" – ");
      return [
        `[经历 ${index + 1}｜id=${experience.id}]`,
        `公司：${experience.company || "（未填写）"}｜职位：${experience.title || "（未填写）"}${
          period ? `｜时间：${period}` : ""
        }`,
        "原文：",
        experience.description.trim() || "（暂无描述）",
      ].join("\n");
    })
    .join("\n\n");
}

function formatEducations(resume: PromptResume): string {
  if (resume.educations.length === 0) return "（暂无教育经历）";
  return resume.educations
    .map((education) => {
      const period = [education.startDate, education.endDate].filter(Boolean).join(" – ");
      return `- ${[education.school, education.degree, education.major]
        .filter(Boolean)
        .join("｜")}${period ? `（${period}）` : ""}`;
    })
    .join("\n");
}

function contextLine(context: PromptContext): string {
  const role =
    context.targetRole?.trim() || context.families.map((family) => family.name).join(" / ");
  return role ? `目标岗位：${role}` : "目标岗位：（未提供）";
}

/* ------------------------------------------------------------------ */
/* 1. 整份简历生成（resume_generate，2 点）                            */
/* ------------------------------------------------------------------ */

export function buildGenerateResumePrompt(
  resume: PromptResume,
  context: PromptContext,
): { system: string; user: string; mock: () => string } {
  const system = [
    "你是一位服务中国求职者的资深简历顾问，擅长把普通经历改写成针对目标岗位、可投递的中文简历。",
    COMMON_RULES,
    `【本次任务】按目标 JD 生成整份简历内容：求职总结、技能栏、所有工作 / 项目经历描述。
- 求职总结：2–4 句，说清方向、年限、最相关的一项成果，自然覆盖 JD 核心关键词。
- 技能栏：8–12 个技能，用行业通用写法，优先用户已掌握 / 原文出现过的技能；可把口语化写法规范化，但不得新增用户没掌握的技术或能力。
- 经历描述：每条 2–4 行，每行一个要点，用「动词 + 做了什么 + 结果」；必须覆盖输入里的每一个经历 id，id 原样返回。
- 教育经历保持事实不变，不在本次输出范围内。
【输出格式】严格只输出一个 JSON 对象，不要代码块、不要解释：
{"summary":"…","skills":["…"],"experiences":[{"id":"原样返回的 id","description":"第 1 行\\n第 2 行\\n第 3 行"}]}`,
    formatSkillsReference(context.families),
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    contextLine(context),
    "",
    "## 目标 JD",
    truncate(context.jd, 6000),
    "",
    "## 当前简历",
    `姓名：${resume.fullName || "（未填写）"}${resume.city ? `｜城市：${resume.city}` : ""}`,
    `现有求职总结：${resume.summary.trim() || "（暂无）"}`,
    `现有技能：${resume.skills.length ? resume.skills.join("、") : "（暂无）"}`,
    "",
    "## 工作 / 项目经历",
    formatExperiences(resume.experiences),
    "",
    "## 教育经历（仅作为背景，不要改写）",
    formatEducations(resume),
    "",
    "请按系统提示词的 JSON 格式输出整份内容。",
  ].join("\n");

  return { system, user, mock: () => mockGeneratedResume(resume, context) };
}

/* ------------------------------------------------------------------ */
/* 2. 单段经历润色（experience_polish，1 点）                          */
/* ------------------------------------------------------------------ */

export function buildProjectPolishPrompt(
  experience: PromptExperience,
  context: PromptContext,
  extra?: { resumeSummary?: string; resumeSkills?: string[] },
): { system: string; user: string; mock: () => string } {
  const system = [
    "你是一位服务中国求职者的资深简历顾问，擅长把一段工作 / 项目经历改写成针对目标 JD 的高质量中文要点。",
    COMMON_RULES,
    `【本次任务】只改写给定的这一段经历，输出 3–4 条要点，每条单独一行（用换行分隔）。
- 用「动作动词 + 具体做了什么 + 结果 / 影响」的结构（STAR 精简版）。
- 优先把用户原文里已有的数字放到结果位置；原文没有数字时不要编造，改用可验证的规模 / 口径或定性成果。
- 自然覆盖 JD 关键词，但不要为了关键词牺牲可信度。
- 不要输出 "- "、"•"、"1." 等列表符号，不要加标题，只输出纯文本要点。
【输出格式】严格只输出纯文本：3–4 行，行间用换行分隔，不要任何 JSON / Markdown / 解释。`,
    formatSkillsReference(context.families),
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    contextLine(context),
    "",
    "## 目标 JD",
    truncate(context.jd, 6000),
    "",
    "## 待润色的经历",
    `公司：${experience.company || "（未填写）"}｜职位：${experience.title || "（未填写）"}`,
    "原文：",
    truncate(experience.description, 4000) || "（暂无描述）",
    "",
    "## 简历背景（只作一致性参考，不要写进这段经历）",
    `求职总结：${truncate(extra?.resumeSummary ?? "", 600) || "（暂无）"}`,
    `已掌握技能：${extra?.resumeSkills?.length ? extra.resumeSkills.join("、") : "（暂无）"}`,
    "",
    "请只输出 3–4 行润色后的要点。",
  ].join("\n");

  return { system, user, mock: () => mockProjectText(experience, context) };
}

/* ------------------------------------------------------------------ */
/* 3. 技能栏整理（skills_polish，1 点）                               */
/* ------------------------------------------------------------------ */

export function buildSkillsPolishPrompt(
  resume: PromptResume,
  context: PromptContext,
): { system: string; user: string; mock: () => string } {
  const system = [
    "你是一位服务中国求职者的资深简历顾问，擅长按目标岗位整理中文简历的技能栏。",
    COMMON_RULES,
    `【本次任务】整理技能栏，输出 8–12 个技能：
- 只保留 / 规范化用户确实掌握或原文出现过的技能；把口语化写法改成行业通用写法（例如「会 SQL」→「SQL（窗口函数、复杂查询）」）。
- 可以补充与 JD 高度相关、且能从用户现有技能 / 经历合理看出的能力，但不得凭空添加用户没做过的工具或技术。
- 技能按「核心技能 → 工具 → 通用能力」排序，同类合并，去掉重复与过空泛的词。
- 教育经历保持事实不变，不改写。
【输出格式】严格只输出一个 JSON 对象，不要代码块、不要解释：
{"skills":["技能 1","技能 2"]}`,
    formatSkillsReference(context.families),
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    contextLine(context),
    "",
    "## 目标 JD",
    truncate(context.jd, 6000),
    "",
    "## 当前简历",
    `现有技能：${resume.skills.length ? resume.skills.join("、") : "（暂无）"}`,
    `求职总结：${truncate(resume.summary, 800) || "（暂无）"}`,
    "经历摘要：",
    truncate(
      resume.experiences
        .map((item) => `${item.title || "岗位"}：${item.description}`)
        .join("\n"),
      3000,
    ) || "（暂无）",
    "",
    "请按系统提示词的 JSON 格式输出整理后的技能栏。",
  ].join("\n");

  return { system, user, mock: () => mockSkills(resume, context) };
}

/* ------------------------------------------------------------------ */
/* 4. 自我评价 / 求职总结润色（summary_polish，1 点）                  */
/* ------------------------------------------------------------------ */

export function buildSummaryPolishPrompt(
  resume: PromptResume,
  context: PromptContext,
): { system: string; user: string; mock: () => string } {
  const system = [
    "你是一位服务中国求职者的资深简历顾问，擅长写中文简历的求职总结 / 自我评价。",
    COMMON_RULES,
    `【本次任务】写一段 2–4 句的求职总结：
- 第一句说清方向与经验年限（年限只能来自用户真实信息），后面 1–2 句写最相关的成果与优势，最后可点出与目标岗位的匹配点。
- 自然融入 JD 核心关键词，不堆砌；不添加用户没做过的项目或技能。
- 用第一人称隐含表达（中文简历习惯省略「我」），句子之间用中文标点，不要分点。
【输出格式】严格只输出纯文本一段话，不要 JSON、不要标题、不要解释。`,
    formatSkillsReference(context.families),
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    contextLine(context),
    "",
    "## 目标 JD",
    truncate(context.jd, 6000),
    "",
    "## 当前简历",
    `现有求职总结：${truncate(resume.summary, 1500) || "（暂无，请根据经历生成）"}`,
    `技能：${resume.skills.length ? resume.skills.join("、") : "（暂无）"}`,
    "工作 / 项目经历：",
    truncate(formatExperiences(resume.experiences), 4000),
    "",
    "请只输出一段 2–4 句的求职总结。",
  ].join("\n");

  return { system, user, mock: () => mockSummaryText(resume, context) };
}

/* ------------------------------------------------------------------ */
/* 5. 对照 JD 单段改写（jd_rewrite，1 点，兼容旧 RewriteDialog）        */
/* ------------------------------------------------------------------ */

export function buildJdRewritePrompt(
  experience: PromptExperience,
  context: PromptContext,
): { system: string; user: string; mock: () => string } {
  const system = [
    "你是一位服务中国求职者的资深简历顾问，擅长对照目标 JD 改写简历中的单段表达。",
    COMMON_RULES,
    `【本次任务】对照 JD 改写给定的一段经历，输出 3–4 条要点，每条单独一行（用换行分隔）：
- 优先覆盖 JD 中用户真实具备、但原文没写出来的关键词；
- 不改变事实，不添加用户没做过的职责；
- 用动作动词开头，结果收尾；原文有数字必须保留，没有数字不要编造。
- 不要列表符号、不要标题。
【输出格式】严格只输出纯文本：3–4 行，行间用换行分隔。`,
    formatSkillsReference(context.families),
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    contextLine(context),
    "",
    "## 目标 JD",
    truncate(context.jd, 6000),
    "",
    "## 待改写经历",
    `公司：${experience.company || "（未填写）"}｜职位：${experience.title || "（未填写）"}`,
    "原文：",
    truncate(experience.description, 4000) || "（暂无描述）",
    "",
    "请只输出改写后的 3–4 行要点。",
  ].join("\n");

  return { system, user, mock: () => mockProjectText(experience, context) };
}

/* ------------------------------------------------------------------ */
/* 演示模式（AI_MOCK=1）的确定性示例                                   */
/* ------------------------------------------------------------------ */

function familyKeywords(families: SkillFamily[]): string[] {
  const keywords: string[] = [];
  for (const family of families) {
    for (const keyword of family.jdKeywords) {
      if (!keywords.includes(keyword)) keywords.push(keyword);
    }
    for (const skill of family.coreSkills) {
      if (!keywords.includes(skill)) keywords.push(skill);
    }
  }
  return keywords;
}

function mockSkills(resume: PromptResume, context: PromptContext): string {
  const families = context.families;
  const existing = resume.skills
    .map((skill) => canonicalizeSkill(skill, families) ?? skill)
    .filter(Boolean);
  const pool = existing.length > 0 ? existing : families.flatMap((family) => family.coreSkills);
  const unique: string[] = [];
  for (const skill of pool) {
    if (!unique.some((item) => item.toLowerCase() === skill.toLowerCase())) unique.push(skill);
    if (unique.length >= 10) break;
  }
  return JSON.stringify({ skills: unique });
}

function mockSummaryText(resume: PromptResume, context: PromptContext): string {
  const role = context.targetRole?.trim() || context.families[0]?.name || "目标岗位";
  const keywords = familyKeywords(context.families);
  const [k1 = "需求分析", k2 = "跨部门协作", k3 = "数据复盘"] = keywords;
  const skills = resume.skills.slice(0, 3);
  const skillPhrase = skills.length > 0 ? skills.join("、") : `${k1}、${k2}`;
  return `围绕${role}方向持续积累，熟悉${skillPhrase}，能够把业务目标拆解为可执行的动作并推进落地。习惯以${k3}的方式验证每一次迭代，在信息不完整时也能快速对齐关键问题、给出可交付的方案。希望在${role}岗位上把${k1}与${k2}的经验转化为可衡量的业务结果。`;
}

function mockProjectText(experience: PromptExperience, context: PromptContext): string {
  const role = experience.title.trim() || context.targetRole?.trim() || "核心业务";
  const company = experience.company.trim();
  const keywords = familyKeywords(context.families);
  const [k1 = "需求分析", k2 = "跨部门协作", k3 = "数据复盘"] = keywords;
  const subject = company ? `${company}的${role}相关` : `${role}相关`;
  return [
    `围绕${subject}工作，主导${k1}与方案设计，把业务目标拆解为可交付的任务并按期推进落地。`,
    `以${k3}的方式跟踪关键指标与用户反馈，持续优化流程与体验，沉淀可复用的方法文档。`,
    `协同${k2}推进跨团队执行，对齐需求与排期，保障各版本稳定交付并完成复盘。`,
  ].join("\n");
}

function mockGeneratedResume(resume: PromptResume, context: PromptContext): string {
  const summary = mockSummaryText(resume, context);
  const skills = (
    JSON.parse(mockSkills(resume, context)) as { skills?: string[] }
  ).skills ?? [];
  const experiences = resume.experiences.map((experience) => ({
    id: experience.id,
    description: mockProjectText(experience, context),
  }));
  return JSON.stringify({ summary, skills, experiences });
}
