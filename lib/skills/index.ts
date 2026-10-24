import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import algorithmAi from "./data/algorithm-ai.json";
import backend from "./data/backend.json";
import dataAnalysis from "./data/data-analysis.json";
import design from "./data/design.json";
import finance from "./data/finance.json";
import frontend from "./data/frontend.json";
import general from "./data/general.json";
import hr from "./data/hr.json";
import marketingBrand from "./data/marketing-brand.json";
import operationsGrowth from "./data/operations-growth.json";
import product from "./data/product.json";
import sales from "./data/sales.json";

/**
 * 中文求职「技能参考库」加载器。
 *
 * 数据在 `lib/skills/data/*.json`：每个文件是一个岗位族。新增岗位族有两种方式：
 * 1. 在下面 `BUNDLED_DATA` 里加一行 import（推荐，构建期打包，部署后一定可用）；
 * 2. 只丢一个 JSON 到 `lib/skills/data/`，服务端启动/首次调用时会自动扫描加载
 *    （本地 dev / 常规 `next start` 有效；无源码的 Serverless 产物拿不到目录，静默跳过）。
 *
 * 该模块仅供服务端使用（提示词与 Server Action），插件 `server-only` 防止被客户端误引入。
 */

export type SkillCanonical = {
  /** 口语化 / 简写写法（如 “sql”“会 SQL”）。 */
  from: string;
  /** 规范写法（如 “SQL（窗口函数、复杂查询）”）。 */
  to: string;
};

export type SkillFamily = {
  /** 稳定 id，用作文件名与匹配键。 */
  id: string;
  /** 中文岗位族名。 */
  name: string;
  /** 岗位关键词 / 别名（用于匹配 JD 与目标岗位）。 */
  aliases: string[];
  /** 核心技能。 */
  coreSkills: string[];
  /** 常用工具。 */
  tools: string[];
  /** 常见 JD 关键词。 */
  jdKeywords: string[];
  /** 可复用的动作动词（简历句首用）。 */
  actionVerbs: string[];
  /** 可复用但**必须来自真实信息**的量化口径模板。 */
  quantTemplates: string[];
  /** 技能规范化示例：仅当用户确实掌握时才采用规范写法。 */
  canonical: SkillCanonical[];
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFamily(raw: unknown): SkillFamily | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!id || !name) return null;
  const canonicalRaw = Array.isArray(record.canonical) ? record.canonical : [];
  const canonical: SkillCanonical[] = canonicalRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      from: typeof item.from === "string" ? item.from.trim() : "",
      to: typeof item.to === "string" ? item.to.trim() : "",
    }))
    .filter((item) => item.from && item.to);

  return {
    id,
    name,
    aliases: asStringArray(record.aliases),
    coreSkills: asStringArray(record.coreSkills),
    tools: asStringArray(record.tools),
    jdKeywords: asStringArray(record.jdKeywords),
    actionVerbs: asStringArray(record.actionVerbs),
    quantTemplates: asStringArray(record.quantTemplates),
    canonical,
  };
}

const BUNDLED_DATA: unknown[] = [
  general,
  product,
  operationsGrowth,
  frontend,
  backend,
  dataAnalysis,
  algorithmAi,
  design,
  marketingBrand,
  sales,
  hr,
  finance,
];

/** 运行时扫描目录补充 JSON（本地 / 有源码的部署生效；失败时静默忽略）。 */
function loadExtraFiles(knownIds: Set<string>): SkillFamily[] {
  const dir = path.join(process.cwd(), "lib", "skills", "data");
  let files: string[];
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }

  const families: SkillFamily[] = [];
  for (const file of files) {
    if (knownIds.has(file.replace(/\.json$/, ""))) continue;
    try {
      const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as unknown;
      const family = normalizeFamily(raw);
      if (family && !knownIds.has(family.id)) {
        knownIds.add(family.id);
        families.push(family);
      }
    } catch {
      // 单个 JSON 损坏不影响其它岗位族。
    }
  }
  return families;
}

let cache: SkillFamily[] | null = null;

/** 全部岗位族（内置 12 类 + 目录里新增的 JSON）。 */
export function listSkillFamilies(): SkillFamily[] {
  if (cache) return cache;
  const families: SkillFamily[] = [];
  const knownIds = new Set<string>();
  for (const raw of BUNDLED_DATA) {
    const family = normalizeFamily(raw);
    if (family && !knownIds.has(family.id)) {
      knownIds.add(family.id);
      families.push(family);
    }
  }
  families.push(...loadExtraFiles(knownIds));
  cache = families;
  return families;
}

export function getSkillFamily(id: string): SkillFamily | undefined {
  return listSkillFamilies().find((family) => family.id === id);
}

/** 匹配用的归一化：小写、去空白与常见分隔符。 */
function normalize(input: string): string {
  return input.toLowerCase().replace(/[\s/|,，、·・_-]+/g, "");
}

const GENERAL_ID = "general";

/**
 * 按目标岗位 / JD 文本匹配岗位族（按相关度降序）。
 * - targetRole 命中别名权重最高（比如顶栏选择的岗位名）；
 * - JD 文本里出现的别名 / 关键词累计得分；
 * - 没有命中时回退到「通用」岗位族，保证提示词始终有参考。
 */
export function matchSkillFamilies(input: {
  jd?: string;
  targetRole?: string;
  limit?: number;
}): SkillFamily[] {
  const limit = Math.max(1, input.limit ?? 2);
  const role = normalize(input.targetRole ?? "");
  const jd = normalize(input.jd ?? "");
  const families = listSkillFamilies();

  const scored = families
    .filter((family) => family.id !== GENERAL_ID)
    .map((family) => {
      let score = 0;
      for (const alias of family.aliases) {
        const key = normalize(alias);
        if (!key) continue;
        if (role && (role.includes(key) || key.includes(role))) score += 8;
        if (jd && jd.includes(key)) score += 2;
      }
      for (const keyword of family.jdKeywords) {
        const key = normalize(keyword);
        if (key && jd.includes(key)) score += 1;
      }
      return { family, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.family);

  if (scored.length > 0) return scored;

  const generalFamily = families.find((family) => family.id === GENERAL_ID);
  return generalFamily ? [generalFamily] : families.slice(0, 1);
}

/**
 * 把技能口语化写法规范成行业通用写法（如 “会 SQL” → “SQL（窗口函数、复杂查询）”）。
 * 命中多个岗位族时按传入顺序取第一个；没命中返回 null（调用方保留原文）。
 */
export function canonicalizeSkill(
  skill: string,
  families: SkillFamily[] = listSkillFamilies(),
): string | null {
  const key = normalize(skill);
  if (!key) return null;
  for (const family of families) {
    for (const item of family.canonical) {
      const from = normalize(item.from);
      if (!from) continue;
      if (key === from || key.includes(from) || from.includes(key)) return item.to;
    }
  }
  return null;
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * 把匹配到的岗位族渲染成提示词里的「技能参考」文本。
 * 明确标注：只可参考写法，不可当作事实新增到用户简历里。
 */
export function buildSkillReference(families: SkillFamily[]): string {
  if (families.length === 0) return "";
  return families
    .map((family) => {
      const parts = [
        `### ${family.name}（岗位族：${family.id}）`,
        `- 核心技能：${family.coreSkills.slice(0, 10).join("、")}`,
        `- 常用工具：${family.tools.slice(0, 8).join("、")}`,
        `- 常见 JD 关键词：${family.jdKeywords.slice(0, 14).join("、")}`,
        `- 可复用动作动词：${family.actionVerbs.slice(0, 8).join("、")}`,
      ];
      if (family.quantTemplates.length > 0) {
        parts.push(
          `- 可用量化口径（仅当用户提供了真实数字时套用，禁止自行填数）：\n${bulletList(
            family.quantTemplates.slice(0, 4),
          )}`,
        );
      }
      if (family.canonical.length > 0) {
        parts.push(
          `- 技能规范化示例（仅当用户确实掌握该技能时采用规范写法）：\n${bulletList(
            family.canonical.slice(0, 8).map((item) => `「${item.from}」→「${item.to}」`),
          )}`,
        );
      }
      return parts.join("\n");
    })
    .join("\n\n");
}

/** 一行摘要，用于日志 / 调试（不含用户隐私）。 */
export function describeFamilies(families: SkillFamily[]): string {
  return families.map((family) => family.name).join(" / ");
}
