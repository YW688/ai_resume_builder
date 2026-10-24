import "server-only";

import OpenAI from "openai";

/**
 * DeepSeek（OpenAI 兼容）客户端 —— 全站唯一出口。
 *
 * 设计要点：
 * 1. 未配置 Key 时**绝不发起请求**，也绝不让调用方扣点：抛 `AiNotConfiguredError`，
 *    由 action 层在扣点前先用 `isAiConfigured()` 拦下。
 * 2. 占位 Key（`sk-placeholder...` / 空串）视为未配置，避免把 401 当成用户错误。
 * 3. 45s 超时（AbortController）+ 网络 / 5xx 自动重试 1 次；401/403/429 不重试。
 * 4. 永远不打印、不返回 API Key；错误消息面向用户，细节只进服务端日志。
 * 5. `AI_MOCK=1` 时走本地演示模式：不联网、返回确定性中文示例（仍由 action 正常扣点），
 *    仅用于联调与截图，**默认关闭**，生产环境不要开启。
 */

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";
/** 占位 Key 前缀：仓库里 .env.example 的示例值，视为未配置。 */
const PLACEHOLDER_KEY_PREFIX = "sk-placeholder";
/** 单次请求超时（毫秒）。 */
export const AI_TIMEOUT_MS = 45_000;
/** 总尝试次数：首次 + 失败重试 1 次（仅网络 / 5xx）。 */
const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 600;

/** DeepSeek 未配置（无 Key / 占位 Key）。 */
export class AiNotConfiguredError extends Error {
  readonly code = "ai_not_configured" as const;

  constructor(message = "DeepSeek API 尚未配置，请联系管理员填写 DEEPSEEK_API_KEY") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export type AiRequestErrorKind = "timeout" | "network" | "http" | "empty" | "unknown";

/** AI 请求失败（超时 / 网络 / HTTP 错误 / 空响应）。 */
export class AiRequestError extends Error {
  readonly code = "ai_request" as const;
  readonly kind: AiRequestErrorKind;
  /** 是否值得自动重试（仅网络与 5xx）。 */
  readonly retryable: boolean;
  /** HTTP 状态码（网络错误时为 undefined）。 */
  readonly status?: number;

  constructor(
    message: string,
    options: { kind: AiRequestErrorKind; retryable?: boolean; status?: number },
  ) {
    super(message);
    this.name = "AiRequestError";
    this.kind = options.kind;
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export type AiConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  /** 是否本地演示模式（AI_MOCK=1）。 */
  mock: boolean;
};

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** AI_MOCK=1 时进入本地演示模式（不联网，用于联调 / 截图）。默认关闭。 */
export function isMockMode(): boolean {
  return readEnv("AI_MOCK") === "1";
}

/** 实际调用的模型名；演示模式返回固定标识，便于流水与提示区分。 */
export function getAiModel(): string {
  return isMockMode() ? "deepseek-mock" : readEnv("DEEPSEEK_MODEL") || DEFAULT_MODEL;
}

/**
 * API Key 是否可用（不做网络探测）。
 * 空值、`sk-placeholder...` 占位值都视为未配置；AI_MOCK=1 视为可用。
 */
export function isAiConfigured(): boolean {
  if (isMockMode()) return true;
  const key = readEnv("DEEPSEEK_API_KEY");
  if (!key) return false;
  return !key.toLowerCase().startsWith(PLACEHOLDER_KEY_PREFIX);
}

/** 读取配置（只在真正调用时读取，避免模块加载期缓存环境变量）。 */
function readConfig(): AiConfig {
  return {
    apiKey: readEnv("DEEPSEEK_API_KEY"),
    baseURL: readEnv("DEEPSEEK_BASE_URL") || DEFAULT_BASE_URL,
    model: readEnv("DEEPSEEK_MODEL") || DEFAULT_MODEL,
    mock: isMockMode(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown, timedOut: boolean): AiRequestError {
  if (error instanceof AiRequestError) return error;
  if (error instanceof AiNotConfiguredError) {
    return new AiRequestError(error.message, { kind: "unknown", retryable: false });
  }
  if (timedOut) {
    return new AiRequestError(
      `AI 服务响应超时（${Math.round(AI_TIMEOUT_MS / 1000)} 秒），请稍后重试`,
      { kind: "timeout", retryable: false },
    );
  }
  if (error instanceof OpenAI.APIError) {
    const status = typeof error.status === "number" ? error.status : undefined;
    if (status === 401 || status === 403) {
      return new AiRequestError("DeepSeek API Key 无效或无权限，请检查 DEEPSEEK_API_KEY", {
        kind: "http",
        retryable: false,
        status,
      });
    }
    if (status === 429) {
      return new AiRequestError("AI 服务请求过于频繁，请稍后重试", {
        kind: "http",
        retryable: false,
        status,
      });
    }
    if (status && status >= 500) {
      return new AiRequestError("AI 服务暂时不可用，请稍后重试", {
        kind: "http",
        retryable: true,
        status,
      });
    }
    return new AiRequestError("AI 请求失败，请稍后重试", {
      kind: "http",
      retryable: false,
      status,
    });
  }
  // 其余按网络错误处理（DNS / 连接重置 / socket hang up 等）。
  return new AiRequestError("无法连接 AI 服务，请检查网络后重试", {
    kind: "network",
    retryable: true,
  });
}

export type AiCallOptions = {
  /** 系统提示词（中文简历专家约束）。 */
  system: string;
  /** 用户提示词（简历内容 + JD + 技能参考 + 输出格式）。 */
  user: string;
  /** json 时要求模型只输出 JSON 对象（DeepSeek 兼容 response_format）。 */
  format?: "text" | "json";
  temperature?: number;
  maxTokens?: number;
  /**
   * AI_MOCK=1 时的确定性示例输出（必须是最终格式，仍然会走同一套解析校验）。
   * 非演示模式下不会被调用。
   */
  mock?: () => string;
};

export type AiCallResult = {
  text: string;
  model: string;
  /** 是否演示模式返回（未联网）。 */
  mocked: boolean;
  usage?: { promptTokens: number; completionTokens: number };
};

/**
 * 调用 DeepSeek 生成文本。
 *
 * @throws AiNotConfiguredError 未配置 Key（调用方应在扣点前拦截）
 * @throws AiRequestError 超时 / 网络 / HTTP / 空响应
 */
export async function callAi(options: AiCallOptions): Promise<AiCallResult> {
  if (!isAiConfigured()) throw new AiNotConfiguredError();

  const config = readConfig();
  const model = getAiModel();

  if (config.mock) {
    // 本地演示模式：不联网、返回确定性示例；文本为空视为失败，避免静默产出空内容。
    const text = (options.mock?.() ?? "").trim();
    if (!text) {
      throw new AiRequestError("AI 演示模式没有生成内容，请重试", {
        kind: "empty",
        retryable: false,
      });
    }
    return { text, model, mocked: true };
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    // 超时与重试都由本函数控制，避免 SDK 内部再叠一层。
    timeout: AI_TIMEOUT_MS,
    maxRetries: 0,
  });

  let lastError: AiRequestError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: options.temperature ?? 0.4,
          max_tokens: options.maxTokens ?? 1600,
          ...(options.format === "json"
            ? { response_format: { type: "json_object" as const } }
            : {}),
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
        },
        { signal: controller.signal },
      );

      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!text) {
        throw new AiRequestError("AI 没有返回内容，请重试", {
          kind: "empty",
          retryable: true,
        });
      }

      return {
        text,
        model,
        mocked: false,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens ?? 0,
              completionTokens: completion.usage.completion_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      const normalized = normalizeError(error, controller.signal.aborted);
      lastError = normalized;
      // 只在网络错误 / 5xx 时重试一次；401/429/超时不重试。
      const shouldRetry = attempt < MAX_ATTEMPTS && normalized.retryable;
      if (!shouldRetry) throw normalized;
      console.warn(
        `[ai] 第 ${attempt} 次调用失败（${normalized.kind}${normalized.status ? ` ${normalized.status}` : ""}），准备重试`,
      );
      await sleep(RETRY_BACKOFF_MS * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw (
    lastError ??
    new AiRequestError("AI 请求失败，请稍后重试", { kind: "unknown", retryable: false })
  );
}
