import "server-only";

/**
 * AI 输出解析与校验。
 *
 * DeepSeek 偶尔会：带 ```json 代码块围栏、在 JSON 前后加解释、把要点写成
 * Markdown 列表。这里做宽容解析 + 严格校验，任何不满足契约的输出都抛
 * `AiParseError`，由 action 退点并返回 parse_error，避免把坏内容写进简历。
 */

export class AiParseError extends Error {
  readonly code = "parse_error" as const;

  constructor(message = "AI 返回格式异常，请重试") {
    super(message);
    this.name = "AiParseError";
  }
}

/** 去掉 ```json / ``` 代码块围栏。 */
export function stripCodeFence(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text.startsWith("```")) return text;
  text = text.replace(/^```[^\n]*\n?/, "");
  text = text.replace(/\n?```\s*$/, "");
  return text.trim();
}

/** 尝试从文本中提取第一个 JSON 对象（容忍前后有解释文字）。 */
function extractJsonObject(raw: string): Record<string, unknown> {
  const text = stripCodeFence(raw);
  const candidates = [text];

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 继续尝试下一个候选。
    }
  }
  throw new AiParseError();
}

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*•·●○\u2022]+\s*/, "")
    .replace(/^\d{1,2}[.、)）]\s*/, "")
    .replace(/^[（(]\d{1,2}[)）]\s*/, "")
    .replace(/^(要点|关键点|成果)[：:]\s*/, "")
    .trim();
}

/** 多行要点：去列表符号、去空行、去重；单段长文本按句号拆行。 */
export function normalizeBulletLines(raw: string): string[] {
  const text = stripCodeFence(raw).replace(/\r\n?/g, "\n");
  let lines = text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  // 模型有时把 3 条要点写成一段；这里按中文句号切成行，保证编辑器里仍是多行。
  if (lines.length === 1 && lines[0].length > 80) {
    const sentences = lines[0]
      .split(/(?<=[。！？!?])/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (sentences.length >= 2) lines = sentences;
  }

  const unique: string[] = [];
  for (const line of lines) {
    if (!unique.includes(line)) unique.push(line);
  }
  return unique.slice(0, 8);
}

/** 解析项目 / 经历 / JD 改写：纯文本多行。 */
export function parsePlainText(raw: string): string {
  const lines = normalizeBulletLines(raw);
  if (lines.length === 0) throw new AiParseError();
  return lines.join("\n");
}

/** 解析一段话（求职总结）：折叠换行与多余空白。 */
export function parseParagraph(raw: string): string {
  const text = stripCodeFence(raw)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 10) throw new AiParseError();
  return text.slice(0, 800);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(cleanLine)
    .filter(Boolean);
}

function dedupeSkills(skills: string[]): string[] {
  const unique: string[] = [];
  for (const skill of skills) {
    const value = skill.trim().slice(0, 48);
    if (!value) continue;
    if (unique.some((item) => item.toLowerCase() === value.toLowerCase())) continue;
    unique.push(value);
    if (unique.length >= 16) break;
  }
  return unique;
}

/** 解析技能栏：优先 JSON `{skills:[...]}`，兼容换行 / 顿号分隔的纯文本。 */
export function parseSkills(raw: string): string[] {
  const text = stripCodeFence(raw);
  try {
    const parsed = extractJsonObject(text);
    const skills = dedupeSkills(asStringArray(parsed.skills));
    if (skills.length > 0) return skills;
  } catch {
    // 回退到纯文本解析。
  }

  const lines = text
    .split(/\n|、|，|,|；|;/)
    .map(cleanLine)
    .filter(Boolean);
  const skills = dedupeSkills(lines);
  if (skills.length === 0) throw new AiParseError();
  return skills;
}

export type GeneratedResume = {
  summary: string;
  skills: string[];
  experiences: { id: string; description: string }[];
};

function parseExperienceItems(value: unknown): { id: string; description: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id.trim() : "",
      description:
        typeof item.description === "string"
          ? item.description
          : typeof item.text === "string"
            ? item.text
            : "",
    }))
    .map((item) => ({
      id: item.id,
      description: item.description ? normalizeBulletLines(item.description).join("\n") : "",
    }))
    .filter((item) => item.description);
}

/**
 * 解析整份简历生成结果。
 *
 * @param expectedIds 数据库里该简历的所有经历 id（顺序即前端顺序）。
 * 模型返回的 id 必须能对上；对不上的按顺序兜底。一条都拿不到时抛 parse_error。
 */
export function parseGeneratedResume(raw: string, expectedIds: string[]): GeneratedResume {
  const parsed = extractJsonObject(raw);
  // 总结缺失 / 过短时不让整份生成失败：交给 action 用原文兜底，再判断是否真的为空。
  let summary = "";
  if (typeof parsed.summary === "string" && parsed.summary.trim()) {
    try {
      summary = parseParagraph(parsed.summary);
    } catch {
      summary = stripCodeFence(parsed.summary).replace(/\s+/g, " ").trim().slice(0, 800);
    }
  }

  let skills = dedupeSkills(asStringArray(parsed.skills));
  if (skills.length === 0 && typeof parsed.skills === "string") {
    skills = dedupeSkills(parseSkills(parsed.skills));
  }

  const items = parseExperienceItems(parsed.experiences);
  const byId = new Map(items.map((item) => [item.id, item.description]));
  const ordered: { id: string; description: string }[] = [];
  for (const id of expectedIds) {
    const description = byId.get(id);
    if (description) ordered.push({ id, description });
  }

  // 模型没回 id 时，按顺序兜底（数量一致才敢对齐，避免张冠李戴）。
  if (ordered.length === 0 && items.length === expectedIds.length) {
    expectedIds.forEach((id, index) => {
      ordered.push({ id, description: items[index]!.description });
    });
  }

  if (expectedIds.length > 0 && ordered.length === 0) {
    throw new AiParseError("AI 没有返回可用的经历内容，请重试");
  }

  return { summary, skills, experiences: ordered };
}
