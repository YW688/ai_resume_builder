"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * 浏览器端 Neon Auth 客户端。
 *
 * `createAuthClient()` 不接收参数：它固定请求同源的 `/api/auth` 代理
 * （即 app/api/auth/[...path]/route.ts），由服务端实例转发到 Managed Auth。
 */
export const authClient = createAuthClient();
