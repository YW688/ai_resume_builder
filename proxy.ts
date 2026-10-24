import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

/**
 * Next.js 16：middleware 文件约定已改名为 proxy，导出名也从 middleware 改为 proxy。
 * matcher 只覆盖产品区页面；/sign-in、/sign-up、/api/auth 与静态资源保持可访问。
 */
const protectedProxy = auth.middleware({ loginUrl: "/sign-in" });

/**
 * 在 SDK 中间件之上补「登录后回跳」：SDK 只会跳 loginUrl，不会携带原目标，
 * 这里把未登录用户的原路径放进 redirect_url，登录页读取后回跳。
 */
export default async function proxy(request: NextRequest) {
  const response = await protectedProxy(request);

  const location = response.headers.get("location");
  if (!location) return response;

  const target = new URL(location, request.url);
  if (target.pathname !== "/sign-in" || target.searchParams.has("redirect_url")) {
    return response;
  }

  target.searchParams.set(
    "redirect_url",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  const redirect = NextResponse.redirect(target);
  // 保留 SDK 中间件可能写入的会话刷新 / 清理 cookie
  for (const cookie of response.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}

export const config = {
  matcher: ["/dashboard/:path*", "/editor/:path*", "/settings/:path*"],
};
