import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

/**
 * 当前登录用户 id（Neon Auth session 的 user.id，与 neon_auth.users.id 一致）。
 * 未登录返回 null；仅在服务端调用。
 *
 * 走 `lib/auth/session` 的请求级缓存：layout 的 requireUser 与随后的
 * loadWorkspace 共享同一次会话读取，不再重复请求 Neon Auth。
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSessionUser();
  return session?.id ?? null;
}

/** 受保护页面/Server Action 用：未登录跳转 /sign-in，已登录返回 user id。 */
export async function requireUser(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
