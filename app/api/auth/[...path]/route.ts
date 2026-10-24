import { auth } from "@/lib/auth/server";

/**
 * Neon Auth 同源代理：浏览器客户端与 Server Action 的所有鉴权请求
 * （sign-up / sign-in / sign-out / get-session / token ...）都经由这里转发。
 *
 * 具体导出哪些 HTTP 方法由已安装的 @neondatabase/auth 版本决定。
 */
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
