import "server-only";

import { auth } from "@/lib/auth/server";

/**
 * 应用侧对 Neon Function `keywords`（functions/extract-keywords.ts）的封装。
 *
 * 调用链：Server Action / Route Handler → 取当前 Neon Auth 会话 JWT →
 * `Authorization: Bearer` → 调用部署在 Neon 分支上的 Function（同区域、紧邻数据库）。
 *
 * 接口契约（供数据层“粘贴 JD”流程使用）：
 * - `extractKeywordsViaFunction(text)` → `Promise<string[]>`（按重要性排序的关键词）
 * - `extractKeywordsDetailed(text)` → 带命中次数/别名的完整结果
 *
 * 需要当前请求带 Neon Auth 会话（cookie）。未登录会抛出 `FunctionAuthError`。
 */

export type KeywordMatch = {
  keyword: string;
  count: number;
  aliases: string[];
};

export type ExtractKeywordsResult = {
  keywords: string[];
  matches: KeywordMatch[];
  stats?: {
    inputLength?: number;
    keywordCount?: number;
    technicalTokens?: number;
  };
};

export class FunctionAuthError extends Error {
  constructor(message = "未登录或会话已失效，无法调用 extract-keywords 函数") {
    super(message);
    this.name = "FunctionAuthError";
  }
}

export class FunctionCallError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body = "") {
    super(message);
    this.name = "FunctionCallError";
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TEXT_LENGTH = 20_000;

function functionBaseUrl(): string {
  const base = process.env.NEON_FUNCTION_KEYWORDS_BASE_URL;
  if (!base) {
    throw new Error(
      "缺少 NEON_FUNCTION_KEYWORDS_BASE_URL：请先 `neon deploy`（或 `neon env pull`）写入 .env.local",
    );
  }
  return base.replace(/\/+$/, "");
}

/** 取当前会话的 Managed Auth JWT；JWT 15 分钟有效，只在本次调用内使用。 */
async function currentSessionToken(): Promise<string> {
  const { data, error } = await auth.token();
  const token = data?.token;
  if (error || !token) {
    throw new FunctionAuthError();
  }
  return token;
}

type CallOptions = {
  /** 最多返回多少个关键词（1–50，默认 20）。 */
  limit?: number;
  /** 显式传入 JWT（脚本/冒烟测试用）；默认取当前会话。 */
  token?: string;
  /** 覆盖函数 base URL（测试用）。 */
  baseUrl?: string;
  /** 超时毫秒数，默认 15000。 */
  timeoutMs?: number;
};

/** 调用 Neon Function 提取关键词，返回完整结构化结果。 */
export async function extractKeywordsDetailed(
  text: string,
  options: CallOptions = {},
): Promise<ExtractKeywordsResult> {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new FunctionCallError("JD 文本为空", 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new FunctionCallError(`JD 文本超过 ${MAX_TEXT_LENGTH} 字符`, 400);
  }

  const token = options.token ?? (await currentSessionToken());
  const baseUrl = (options.baseUrl ?? functionBaseUrl()).replace(/\/+$/, "");
  const limit = options.limit ?? 20;
  const url = `${baseUrl}/?limit=${encodeURIComponent(String(limit))}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new FunctionCallError(
      `调用 extract-keywords 函数失败：${cause instanceof Error ? cause.message : String(cause)}`,
      0,
    );
  }

  const body = await response.text();

  if (response.status === 401) {
    throw new FunctionAuthError("extract-keywords 函数拒绝了请求：JWT 无效或已过期");
  }
  if (!response.ok) {
    throw new FunctionCallError(
      `extract-keywords 函数返回 HTTP ${response.status}`,
      response.status,
      body.slice(0, 500),
    );
  }

  let payload: {
    ok?: boolean;
    keywords?: unknown;
    matches?: unknown;
    stats?: unknown;
    error?: unknown;
  };
  try {
    payload = JSON.parse(body);
  } catch {
    throw new FunctionCallError("extract-keywords 函数返回了非 JSON 响应", response.status, body.slice(0, 500));
  }

  if (!payload.ok || !Array.isArray(payload.keywords)) {
    throw new FunctionCallError(
      `extract-keywords 函数返回错误：${typeof payload.error === "string" ? payload.error : "响应格式不正确"}`,
      response.status,
      body.slice(0, 500),
    );
  }

  return {
    keywords: payload.keywords.filter((item): item is string => typeof item === "string"),
    matches: Array.isArray(payload.matches) ? (payload.matches as KeywordMatch[]) : [],
    stats: (payload.stats as ExtractKeywordsResult["stats"]) ?? undefined,
  };
}

/**
 * 数据层“粘贴 JD”流程的主入口：返回可直接用于匹配的关键词数组。
 *
 * ```ts
 * const keywords = await extractKeywordsViaFunction(jdText); // string[]
 * ```
 */
export async function extractKeywordsViaFunction(
  text: string,
  options: CallOptions = {},
): Promise<string[]> {
  const result = await extractKeywordsDetailed(text, options);
  return result.keywords;
}
