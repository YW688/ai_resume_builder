import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

/**
 * 当前登录用户 id（Neon Auth session 的 user.id，与 neon_auth.users.id 一致）。
 * 未登录返回 null；仅在服务端调用。
 */
export async function getUserId(): Promise<string | null> {
  const { data: session, error } = await auth.getSession();
  if (error) return null;
  return session?.user?.id ?? null;
}

/** 受保护页面/Server Action 用：未登录跳转 /sign-in，已登录返回 user id。 */
export async function requireUser(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
