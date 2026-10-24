"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { safeInternalPath } from "@/lib/auth/redirect";

export type AuthFormState = { error: string } | null;

function errorMessage(error: { code?: string; message?: string } | null): string {
  const code = (error?.code ?? "").toLowerCase();
  // SDK 会把上游 Better Auth 错误归一化为小写错误码（invalid_credentials 等），
  // 同时保留对上游原始大写错误码的兼容。
  if (
    code === "invalid_credentials" ||
    code === "invalid_email_or_password" ||
    code === "invalid_password" ||
    code === "invalid_email" ||
    code === "identity_not_found"
  ) {
    return "邮箱或密码不正确";
  }
  if (code === "user_not_found") return "该邮箱尚未注册";
  if (code === "email_not_confirmed" || code === "email_not_verified") {
    return "邮箱尚未验证，请先完成邮箱验证";
  }
  if (code === "over_request_rate_limit" || code === "too_many_requests") {
    return "尝试次数过多，请稍后再试";
  }
  if (code === "invalid_origin") {
    return "当前访问域名未在 Neon Auth 信任域名中，请改用已配置的域名访问";
  }
  return "登录失败，请稍后重试";
}

export async function signInWithEmail(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeInternalPath(
    String(formData.get("redirectUrl") ?? ""),
  );

  if (!email || !password) return { error: "请输入邮箱和密码" };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: errorMessage(error) };

  redirect(redirectTo);
}
