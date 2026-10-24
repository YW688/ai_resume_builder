"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { safeInternalPath } from "@/lib/auth/redirect";

export type AuthFormState = { error: string } | null;

function errorMessage(error: { code?: string; message?: string } | null): string {
  const code = (error?.code ?? "").toLowerCase();
  // SDK 归一化后的小写错误码；同时兼容上游原始大写错误码。
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "user_exists"
  ) {
    return "该邮箱已注册，请直接登录";
  }
  if (
    code === "weak_password" ||
    code === "password_too_short" ||
    code === "password_too_long" ||
    code === "invalid_password"
  ) {
    return "密码不符合要求，请使用 8 位以上字符";
  }
  if (code === "email_address_invalid" || code === "invalid_email") {
    return "请输入有效的邮箱地址";
  }
  if (code === "over_request_rate_limit" || code === "too_many_requests") {
    return "操作过于频繁，请稍后再试";
  }
  if (code === "invalid_origin") {
    return "当前访问域名未在 Neon Auth 信任域名中，请改用已配置的域名访问";
  }
  return "注册失败，请稍后重试";
}

export async function signUpWithEmail(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawName = String(formData.get("name") ?? "").trim();
  const redirectTo = safeInternalPath(
    String(formData.get("redirectUrl") ?? ""),
  );

  if (!email || !password) return { error: "请输入邮箱和密码" };
  if (password.length < 8) return { error: "密码至少 8 位" };

  const { error } = await auth.signUp.email({
    email,
    password,
    name: rawName || email.split("@")[0] || email,
  });
  if (error) return { error: errorMessage(error) };

  redirect(redirectTo);
}
