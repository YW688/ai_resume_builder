/** 只允许站内相对路径，避免登录后被重定向到外部站点（open redirect）。 */
export function safeInternalPath(
  value: string | string[] | null | undefined,
  fallback = "/dashboard",
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  // 排除 //evil.com 与 /\evil.com 这类协议相对写法
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** 从登录/注册页 searchParams 里取回跳地址（兼容 Neon Auth middleware 可能使用的参数名）。 */
export function readRedirect(
  params: Record<string, string | string[] | undefined>,
): string {
  const path = safeInternalPath(
    params.redirect_url ?? params.redirectTo ?? params.next,
    "/dashboard",
  );
  // 已经登录还回跳到鉴权页会形成循环，回退到工作台
  if (/^\/(sign-in|sign-up)(\/|$)/.test(path)) return "/dashboard";
  return path;
}
