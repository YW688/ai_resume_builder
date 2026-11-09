"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { safeInternalPath } from "@/lib/auth/redirect";

export type AuthFormState = { error: string } | null;

/** 验证码登录的表单状态；成功时直接 redirect，不会返回。 */
export type EmailCodeFormState = { error: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

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
  // 不区分「邮箱未注册 / 密码错误」，避免账号枚举。
  if (code === "user_not_found") return "邮箱或密码不正确";
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

/**
 * 邮箱验证码登录（Neon Auth Email OTP）。
 *
 * 未注册的邮箱会在校验通过后自动创建账号（Better Auth 默认 disableSignUp=false），
 * 因此同一个入口同时承担「注册」和「登录」。验证码由 Neon Auth 生成并发送：
 * - 发送动作在浏览器端调用 `authClient.emailOtp.sendVerificationOtp`；
 * - 校验 + 建会话放在 Server Action 内，cookie 由 Neon Auth SDK 直接写入。
 *
 * 隐私边界：验证码、邮箱密码、SMTP 授权码都不会进入本应用的数据库或日志；
 * 应用侧只保留 Neon Auth 会话与 `users` 表里的邮箱/昵称。
 */
export async function signInWithEmailCode(
  _prevState: EmailCodeFormState,
  formData: FormData,
): Promise<EmailCodeFormState> {
  const email = normalizeEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D+/g, "");
  const redirectTo = safeInternalPath(
    String(formData.get("redirectUrl") ?? ""),
  );

  if (!EMAIL_RE.test(email)) return { error: "请输入有效的邮箱地址" };
  if (!/^\d{6}$/.test(code)) {
    return { error: "请输入邮件中的 6 位数字验证码" };
  }

  const { error } = await auth.signIn.emailOtp({
    email,
    otp: code,
    // 仅首次注册时使用；已有账号会忽略。不要在日志里输出邮箱验证码。
    name: email.split("@")[0],
  });
  if (error) return { error: otpErrorMessage(error) };

  redirect(redirectTo);
}

function otpErrorMessage(error: { code?: string; message?: string } | null): string {
  const code = (error?.code ?? "").toLowerCase();

  if (
    code === "invalid_otp" ||
    code === "invalid_code" ||
    code === "otp_expired" ||
    code === "invalid_otp_or_expired"
  ) {
    return "验证码不正确或已过期，请重新获取";
  }
  if (code === "too_many_attempts" || code === "too_many_attempts_exceeded") {
    return "验证码尝试次数过多，请重新获取后再试";
  }
  if (code === "over_request_rate_limit" || code === "too_many_requests") {
    return "操作过于频繁，请稍后再试";
  }
  if (code === "invalid_email" || code === "email_address_invalid") {
    return "请输入有效的邮箱地址";
  }
  if (code === "invalid_origin") {
    return "当前访问域名未在 Neon Auth 信任域名中，请改用已配置的域名访问";
  }
  if (code.startsWith("network_") || code === "internal_error") {
    return "网络异常，请稍后重试";
  }
  return "登录失败，请重新获取验证码后再试";
}
