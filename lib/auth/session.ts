import "server-only";

import { cache } from "react";

import { auth, type AuthSessionUser } from "./server";

/**
 * 当前请求内共享的会话读取。
 *
 * 产品端一次页面渲染里，layout（requireUser）、loadWorkspace、Server Action
 * 往往各自需要会话；Neon Auth 的 `auth.getSession()` 虽然会走 cookie 缓存，
 * 但重复调用仍可能触发一次网络校验。用 React `cache()` 把同一请求内的读取
 * 折叠成一次，既省延迟也保证同一请求里的身份一致。
 *
 * 注意：只给 RSC / Server Action 用；proxy（middleware）不要引入本文件。
 */
export const getSessionUser = cache(async (): Promise<AuthSessionUser | null> => {
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
});
