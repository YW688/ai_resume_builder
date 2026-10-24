import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth（Managed Better Auth）服务端唯一实例。
 *
 * - `auth.handler()`：挂到 app/api/auth/[...path]/route.ts，作为同源鉴权代理；
 * - `auth.middleware()`：挂到根目录 proxy.ts（Next 16 的 middleware 改名）；
 * - `auth.getSession()` / `auth.signIn.email()` / `auth.signUp.email()`：Server Component、
 *   Server Action、Route Handler 内使用。
 *
 * 环境变量（.env.local，勿提交）：
 * - NEON_AUTH_BASE_URL：分支的 Managed Auth URL（含路径）
 * - NEON_AUTH_COOKIE_SECRET：本应用会话 cookie 的加密密钥（32+ 字符）
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
  // Cache Components 的预渲染探测会在 Suspense 边界内触发一次 getSession，
  // React 会处理这次预渲染中断；SDK 默认会把该中断当 error 打印（噪音）。
  // 静音 SDK 日志，真正的服务端错误仍由调用方返回值 / 业务日志体现。
  logLevel: "silent",
});

export type AuthSessionUser = {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  emailVerified?: boolean;
};

/** 读取当前会话用户；未登录或会话失效返回 null。 */
export async function getSessionUser(): Promise<AuthSessionUser | null> {
  const { data: session, error } = await auth.getSession();
  if (error || !session?.user) return null;
  const user = session.user;
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? null,
    image: user.image ?? null,
    emailVerified: user.emailVerified ?? false,
  };
}
