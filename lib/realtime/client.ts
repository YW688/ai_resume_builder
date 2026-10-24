"use client";

import { createRealtimeClient } from "@neon/realtime/client";
import { drizzleParsers } from "@neon/realtime-drizzle/client";

/**
 * 浏览器端 Realtime 客户端（每个页面一个，所有订阅共享同一条 WebSocket）。
 *
 * 按 references/ssr.md：在 useState 初始化器里懒创建，而不是模块顶层创建，
 * 这样 SSR 阶段不会打开连接，浏览器 hydration 后才真正订阅。
 *
 * 地址来自公开变量 NEXT_PUBLIC_NEON_REALTIME_URL（等于服务端
 * NEON_REALTIME_URL，仅 URL，不含 secret）。
 */
export function createWorkspaceRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_NEON_REALTIME_URL;
  if (!url) {
    throw new Error(
      "缺少 NEXT_PUBLIC_NEON_REALTIME_URL：请在 .env.local 里把它设为与 NEON_REALTIME_URL 相同的 wss:// 地址",
    );
  }
  return createRealtimeClient({
    url,
    parsers: { ...drizzleParsers },
  });
}
