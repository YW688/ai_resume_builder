import { getSessionUser } from "@/lib/auth/server";
import { sealWorkspaceQueries } from "@/lib/realtime/server";

// 该 Route Handler 通过 getSessionUser() 读取会话 cookie，Next 16 会自动按请求
// 动态执行；`cacheComponents` 下不能再写 `export const dynamic`（构建会报错）。

const NO_STORE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  vary: "Cookie",
} as const;

async function handleRequest(): Promise<Response> {
  // 1) 先校验 Neon Auth session（cookie → Managed Auth），未登录直接 401。
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  // 2) 只 seal 该用户自己的查询：userId 来自已验证的 session，不接受请求体传入。
  const sealed = await sealWorkspaceQueries(user.id);

  // 3) sealed query 是 bearer token：只走 HTTPS、不缓存、不进 URL/日志。
  return Response.json(sealed, { headers: NO_STORE_HEADERS });
}

/** 首次获取（GET 与 POST 等价；客户端用 POST 避免任何中间层缓存）。 */
export async function GET(): Promise<Response> {
  return handleRequest();
}

export async function POST(): Promise<Response> {
  return handleRequest();
}
