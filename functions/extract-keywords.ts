/**
 * Neon Function: 从职位描述（JD）文本中确定性地提取关键词/技能。
 *
 * - 无外部 API、无 AI 调用、无随机性：同一输入永远返回同一输出。
 * - 需要 Neon Auth JWT（Authorization: Bearer <token>）才能调用提取接口；
 *   GET /health 为公开健康检查，不返回任何用户数据。
 * - 运行时注入 NEON_AUTH_BASE_URL / NEON_AUTH_JWKS_URL（Neon Auth 已开启）。
 *
 * 协议：
 *   GET  /health            -> 200 { ok, service, version, time }
 *   POST / 或 POST /extract -> 200 { ok, keywords, matches, stats }
 *   OPTIONS 任意            -> 204（CORS 预检）
 *   其他/未认证             -> 401 / 405
 */

import { createPublicKey, verify as cryptoVerify } from "node:crypto";

type Jwk = {
  kty?: string;
  kid?: string;
  alg?: string;
  crv?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
};

type Jwks = { keys?: Jwk[] };

type JwtHeader = { alg?: string; kid?: string; typ?: string };

type JwtPayload = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
};

type Match = { keyword: string; count: number; aliases: string[] };

// ---------------------------------------------------------------------------
// 技能词典：canonical 名称 -> 别名（中英文均可）。别名匹配不区分英文大小写。
// 词典只用于“识别已知技能”，词典外的技术词由下方 token 规则补充。
// ---------------------------------------------------------------------------
const SKILLS: ReadonlyArray<{ keyword: string; aliases: ReadonlyArray<string> }> = [
  // 通用编程语言
  { keyword: "JavaScript", aliases: ["javascript", "js", "es6", "ecmascript"] },
  { keyword: "TypeScript", aliases: ["typescript", "ts"] },
  { keyword: "Python", aliases: ["python"] },
  { keyword: "Java", aliases: ["java"] },
  { keyword: "Go", aliases: ["golang", "go语言", "go"] },
  { keyword: "Rust", aliases: ["rust"] },
  { keyword: "C++", aliases: ["c++", "cpp"] },
  { keyword: "C#", aliases: ["c#", "csharp", ".net"] },
  { keyword: "C", aliases: ["c语言"] },
  { keyword: "Kotlin", aliases: ["kotlin"] },
  { keyword: "Swift", aliases: ["swift"] },
  { keyword: "PHP", aliases: ["php"] },
  { keyword: "Ruby", aliases: ["ruby"] },
  { keyword: "SQL", aliases: ["sql"] },
  { keyword: "Shell", aliases: ["shell", "bash", "linux命令行"] },
  // 前端
  { keyword: "React", aliases: ["react", "react.js", "reactjs"] },
  { keyword: "Vue", aliases: ["vue", "vue.js", "vuejs"] },
  { keyword: "Angular", aliases: ["angular"] },
  { keyword: "Next.js", aliases: ["next.js", "nextjs"] },
  { keyword: "Nuxt", aliases: ["nuxt"] },
  { keyword: "HTML", aliases: ["html", "html5"] },
  { keyword: "CSS", aliases: ["css", "css3", "tailwind", "sass", "less"] },
  { keyword: "Webpack", aliases: ["webpack", "vite", "rollup"] },
  { keyword: "小程序", aliases: ["小程序", "微信小程序", "uni-app", "uniapp"] },
  { keyword: "响应式布局", aliases: ["响应式", "移动端适配", "rem", "flex布局"] },
  { keyword: "前端工程化", aliases: ["前端工程化", "组件化", "前端架构"] },
  // 后端 / 架构
  { keyword: "Node.js", aliases: ["node.js", "nodejs", "node"] },
  { keyword: "Spring", aliases: ["spring", "spring boot", "springboot", "spring cloud"] },
  { keyword: "Django", aliases: ["django"] },
  { keyword: "Flask", aliases: ["flask"] },
  { keyword: "FastAPI", aliases: ["fastapi"] },
  { keyword: "Express", aliases: ["express", "koa", "nestjs", "nest.js"] },
  { keyword: "gRPC", aliases: ["grpc", "protobuf"] },
  { keyword: "GraphQL", aliases: ["graphql"] },
  { keyword: "RESTful API", aliases: ["restful", "rest api", "rest接口"] },
  { keyword: "微服务", aliases: ["微服务", "microservice", "microservices"] },
  { keyword: "分布式系统", aliases: ["分布式", "distributed system"] },
  { keyword: "高并发", aliases: ["高并发", "高可用", "高性能"] },
  { keyword: "消息队列", aliases: ["消息队列", "kafka", "rabbitmq", "rocketmq", "pulsar"] },
  { keyword: "缓存", aliases: ["缓存", "redis", "memcached"] },
  { keyword: "Elasticsearch", aliases: ["elasticsearch", "elastic search", "es搜索"] },
  // 数据库
  { keyword: "PostgreSQL", aliases: ["postgresql", "postgres", "pg数据库"] },
  { keyword: "MySQL", aliases: ["mysql"] },
  { keyword: "MongoDB", aliases: ["mongodb", "mongo"] },
  { keyword: "NoSQL", aliases: ["nosql", "非关系型数据库"] },
  { keyword: "数据库设计", aliases: ["数据库设计", "表结构设计", "索引优化", "sql优化"] },
  // 云 / 运维
  { keyword: "Docker", aliases: ["docker", "容器化"] },
  { keyword: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { keyword: "云原生", aliases: ["云原生", "cloud native", "serverless"] },
  { keyword: "CI/CD", aliases: ["ci/cd", "cicd", "持续集成", "持续交付", "jenkins", "gitlab ci"] },
  { keyword: "AWS", aliases: ["aws", "amazon web services"] },
  { keyword: "阿里云", aliases: ["阿里云", "aliyun", "腾讯云", "华为云"] },
  { keyword: "Linux", aliases: ["linux", "unix"] },
  { keyword: "Nginx", aliases: ["nginx"] },
  { keyword: "监控告警", aliases: ["监控", "prometheus", "grafana", "告警"] },
  // 数据 / AI
  { keyword: "数据分析", aliases: ["数据分析", "data analysis", "数据建模"] },
  { keyword: "数据可视化", aliases: ["数据可视化", "echarts", "tableau", "bi报表"] },
  { keyword: "机器学习", aliases: ["机器学习", "machine learning", "ml"] },
  { keyword: "深度学习", aliases: ["深度学习", "deep learning", "神经网络"] },
  { keyword: "PyTorch", aliases: ["pytorch"] },
  { keyword: "TensorFlow", aliases: ["tensorflow"] },
  { keyword: "大模型", aliases: ["大模型", "llm", "大语言模型", "gpt", "transformer"] },
  { keyword: "RAG", aliases: ["rag", "检索增强"] },
  { keyword: "Prompt Engineering", aliases: ["prompt", "提示词", "prompt engineering"] },
  { keyword: "算法", aliases: ["算法", "algorithm", "数据结构"] },
  { keyword: "爬虫", aliases: ["爬虫", "scrapy", "web scraping"] },
  // 测试 / 质量
  { keyword: "自动化测试", aliases: ["自动化测试", "selenium", "playwright", "cypress"] },
  { keyword: "单元测试", aliases: ["单元测试", "unit test", "jest", "vitest"] },
  { keyword: "性能优化", aliases: ["性能优化", "性能调优", "performance tuning"] },
  // 产品 / 协作
  { keyword: "产品设计", aliases: ["产品设计", "产品经理", "prd", "需求文档"] },
  { keyword: "需求分析", aliases: ["需求分析", "需求调研"] },
  { keyword: "项目管理", aliases: ["项目管理", "project management", "pmp"] },
  { keyword: "敏捷开发", aliases: ["敏捷", "agile", "scrum", "迭代开发"] },
  { keyword: "团队协作", aliases: ["团队协作", "跨部门", "沟通能力", "团队管理"] },
  { keyword: "用户增长", aliases: ["用户增长", "增长黑客", "用户运营"] },
  { keyword: "A/B 测试", aliases: ["a/b测试", "ab测试", "a/b test"] },
  { keyword: "英语", aliases: ["英语", "english", "英语流利"] },
];

const STOPWORDS = new Set(
  [
    "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
    "has", "that", "this", "from", "not", "but", "all", "can", "who", "job",
    "team", "work", "year", "years", "plus", "etc", "http", "https", "www",
    "com", "cn", "html", "css", // css 已由词典命中，避免重复计入 token 噪声
  ].map((w) => w.toLowerCase())
);

const MAX_TEXT_LENGTH = 20_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ---------------------------------------------------------------------------
// Neon Auth JWT 校验（JWKS + issuer）。Neon Auth 的 JWT 是 EdDSA(Ed25519)，
// 同时兼容 RS256，方便其他 issuer 接入；其余算法一律拒绝。
// ---------------------------------------------------------------------------
const UNVERIFIED = Symbol("unverified");

type JwksCache = { keys: Jwk[]; fetchedAt: number; url: string };
let jwksCache: JwksCache | undefined;
const JWKS_TTL_MS = 10 * 60 * 1000;

function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function base64UrlToBuffer(value: string): Buffer {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

async function getJwks(url: string, forceRefresh = false): Promise<Jwk[]> {
  if (!forceRefresh && jwksCache && jwksCache.url === url && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as Jwks;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache = { keys, fetchedAt: Date.now(), url };
  return keys;
}

function verifySignature(header: JwtHeader, jwk: Jwk, signingInput: string, signature: Buffer): boolean {
  const alg = header.alg ?? "";
  const key = createPublicKey({ key: jwk as never, format: "jwk" });
  if (alg === "EdDSA") {
    return cryptoVerify(null, Buffer.from(signingInput), key, signature);
  }
  if (alg === "RS256") {
    return cryptoVerify("RSA-SHA256", Buffer.from(signingInput), key, signature);
  }
  return false;
}

async function verifyAndGetUserId(token: string): Promise<string | typeof UNVERIFIED> {
  const parts = token.split(".");
  if (parts.length !== 3) return UNVERIFIED;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(base64UrlToBuffer(encodedHeader).toString("utf8")) as JwtHeader;
    payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString("utf8")) as JwtPayload;
  } catch {
    return UNVERIFIED;
  }

  const jwksUrl = env("NEON_AUTH_JWKS_URL");
  const authBaseUrl = env("NEON_AUTH_BASE_URL");
  if (!jwksUrl || !authBaseUrl) {
    // 部署环境应注入这两个变量；缺失即视为无法校验。
    console.error("[extract-keywords] missing NEON_AUTH_JWKS_URL / NEON_AUTH_BASE_URL");
    return UNVERIFIED;
  }

  const expectedIssuer = new URL(authBaseUrl).origin;
  // iss 必须存在且与 Neon Auth 的 issuer 完全一致；缺失 iss 也拒绝。
  if (!payload.iss || payload.iss !== expectedIssuer) return UNVERIFIED;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return UNVERIFIED;
  if (typeof payload.nbf === "number" && payload.nbf * 1000 > Date.now()) return UNVERIFIED;
  if (!payload.sub) return UNVERIFIED;

  let keys = await getJwks(jwksUrl);
  let jwk = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
  if (!jwk && header.kid) {
    keys = await getJwks(jwksUrl, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return UNVERIFIED;

  try {
    const valid = verifySignature(header, jwk, `${encodedHeader}.${encodedPayload}`, base64UrlToBuffer(encodedSignature));
    if (!valid) return UNVERIFIED;
  } catch {
    return UNVERIFIED;
  }

  return payload.sub;
}

// ---------------------------------------------------------------------------
// 关键词提取（确定性）
// ---------------------------------------------------------------------------
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u3000\u00a0]/g, " ")
    .replace(/\r\n?/g, "\n")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiLetterOrDigit(ch: string): boolean {
  return /^[a-z0-9]$/i.test(ch);
}

/** 统计别名出现次数；纯字母/数字别名加边界，避免 "go" 命中 "google"。 */
function countAlias(haystack: string, alias: string): number {
  const needle = alias.toLowerCase();
  if (!needle) return 0;
  const left = isAsciiLetterOrDigit(needle[0]) ? "(?<![a-z0-9])" : "";
  const right = isAsciiLetterOrDigit(needle[needle.length - 1]) ? "(?![a-z0-9])" : "";
  const pattern = new RegExp(`${left}${escapeRegExp(needle)}${right}`, "g");
  let count = 0;
  for (const _ of haystack.matchAll(pattern)) count += 1;
  return count;
}

/**
 * 词典之外的补充识别（用原始大小写文本，只收“看起来像技术名词”的 token）：
 * - 大写缩写：AWS、SQL、K8S、CI/CD、C++、S3
 * - 带扩展名的技术名：next.js、node.js、main.py
 * 普通英文单词与小写长词一律不收，避免把职位描述里的自然语言当技能。
 */
function collectTechnicalTokens(sourceText: string, known: Set<string>): string[] {
  const found = new Map<string, string>();
  const patterns: RegExp[] = [
    /\b[A-Z][A-Z0-9+#./-]{1,19}\b/g, // 缩写 / 带符号技术词
    /\b[a-zA-Z][a-zA-Z0-9-]*\.(?:js|ts|tsx|jsx|py|go|rs|java|sql)\b/gi, // 带扩展名
    /\b(?:k8s|s3|ec2|rds|cdn|devops|sre|etl|olap|oltp)\b/gi, // 常见小写技术词
  ];
  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      const raw = match[0];
      if (!raw || raw.length < 2) continue;
      const lower = raw.toLowerCase();
      if (STOPWORDS.has(lower) || known.has(lower)) continue;
      if (/^(19|20)\d{2}$/.test(raw)) continue; // 年份
      // C++ / C# 在词典中已命中，这里只补充其余
      if (!found.has(lower)) found.set(lower, raw);
    }
  }
  // 稳定输出顺序：按首次出现位置
  return [...found.values()];
}

type ExtractResult = {
  keywords: string[];
  matches: Match[];
  stats: { inputLength: number; keywordCount: number; technicalTokens: number };
};

export function extractKeywords(text: string, limit: number): ExtractResult {
  const normalized = normalize(text);
  const matches: Match[] = [];
  const known = new Set<string>();

  for (const skill of SKILLS) {
    const hitAliases: string[] = [];
    let count = 0;
    for (const alias of skill.aliases) {
      const hits = countAlias(normalized, alias);
      if (hits > 0) {
        count += hits;
        hitAliases.push(alias);
      }
    }
    if (count > 0) {
      known.add(skill.keyword.toLowerCase());
      for (const alias of skill.aliases) known.add(alias.toLowerCase());
      matches.push({ keyword: skill.keyword, count, aliases: hitAliases });
    }
  }

  // 词典命中优先按出现次数排序；次数相同按词典顺序（稳定）。
  matches.sort((a, b) => b.count - a.count);

  const extraTokens = collectTechnicalTokens(text, known);
  for (const token of extraTokens) {
    matches.push({ keyword: token, count: 1, aliases: [token.toLowerCase()] });
  }

  const keywords = matches.slice(0, limit).map((m) => m.keyword);
  return {
    keywords,
    matches: matches.slice(0, limit),
    stats: {
      inputLength: text.length,
      keywordCount: matches.length,
      technicalTokens: extraTokens.length,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP 处理
// ---------------------------------------------------------------------------
const SERVICE = "extract-keywords";
const VERSION = "1.0.0";

/** CORS 公共头（不含 allow-origin）：origin 必须命中 Neon Auth 的 origin 白名单。 */
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

/** 依据 NEON_AUTH_BASE_URL 计算允许的浏览器 Origin；未配置或不匹配返回 null。 */
function allowedCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const authBaseUrl = env("NEON_AUTH_BASE_URL");
  if (!authBaseUrl) return null;
  try {
    return origin === new URL(authBaseUrl).origin ? origin : null;
  } catch {
    return null;
  }
}

/** 仅当 Origin 命中白名单时返回 ACAO；无匹配则不返回该头（浏览器按跨域拒绝）。 */
function withCors(response: Response, request: Request): Response {
  const origin = allowedCorsOrigin(request);
  response.headers.set("vary", "Origin");
  if (origin) response.headers.set("access-control-allow-origin", origin);
  return response;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS_HEADERS },
  });
}

function unauthorized(message = "Unauthorized"): Response {
  return json({ ok: false, error: message }, 401);
}

function badRequest(message: string): Response {
  return json({ ok: false, error: message }, 400);
}

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function parseLimit(value: unknown): number | null {
  if (value === undefined || value === null) return DEFAULT_LIMIT;
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) return null;
  return n;
}

async function readText(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return null;
    }
    if (typeof body === "string") return body;
    const obj = body as { text?: unknown; jdText?: unknown; jd?: unknown } | null;
    const text = obj?.text ?? obj?.jdText ?? obj?.jd;
    return typeof text === "string" ? text : null;
  }
  const text = await request.text();
  return text.length > 0 ? text : null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return withCors(
        new Response(null, { status: 204, headers: CORS_HEADERS }),
        request,
      );
    }

    // 公开健康检查：不返回用户数据，无需鉴权。
    if (request.method === "GET" && (path === "/health" || path === "/")) {
      return withCors(
        json({ ok: true, service: SERVICE, version: VERSION, time: new Date().toISOString() }),
        request,
      );
    }

    if (request.method !== "POST" && request.method !== "GET") {
      return withCors(
        json({ ok: false, error: "Method Not Allowed" }, 405),
        request,
      );
    }
    if (request.method === "GET") {
      return withCors(
        json({ ok: false, error: "Use POST with a job description body" }, 405),
        request,
      );
    }

    // 业务接口必须带合法的 Neon Auth JWT。
    const token = bearerToken(request.headers.get("authorization"));
    if (!token) return withCors(unauthorized("Missing bearer token"), request);

    let userId: string | typeof UNVERIFIED;
    try {
      userId = await verifyAndGetUserId(token);
    } catch (error) {
      console.error("[extract-keywords] jwt verify error", error instanceof Error ? error.message : error);
      return withCors(unauthorized("Invalid token"), request);
    }
    if (userId === UNVERIFIED) {
      return withCors(unauthorized("Invalid token"), request);
    }

    const text = await readText(request);
    if (text === null) {
      return withCors(
        badRequest("Body must be JSON { text: string } or a plain-text job description"),
        request,
      );
    }
    if (text.trim().length === 0) {
      return withCors(badRequest("Job description text is empty"), request);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return withCors(
        badRequest(`Job description exceeds ${MAX_TEXT_LENGTH} characters`),
        request,
      );
    }

    const limit = parseLimit(url.searchParams.get("limit") ?? undefined);
    if (limit === null) {
      return withCors(
        badRequest(`limit must be an integer between 1 and ${MAX_LIMIT}`),
        request,
      );
    }

    const result = extractKeywords(text, limit);

    return withCors(
      json({
        ok: true,
        // 调用者契约：可直接用于简历关键词匹配
        keywords: result.keywords,
        matches: result.matches,
        stats: result.stats,
      }),
      request,
    );
  },
};

// 供本地冒烟测试 / 复用：确定性提取实现（不参与 HTTP 契约）
export { extractKeywords as extractKeywordsForTest };
