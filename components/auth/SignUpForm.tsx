"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signUpWithEmail, type AuthFormState } from "@/app/sign-up/actions";
import { AuthError, SubmitButton, inputClass } from "./form-ui";
import { PasswordInput } from "./PasswordInput";

export function SignUpForm({ redirectUrl }: { redirectUrl: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signUpWithEmail,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectUrl" value={redirectUrl} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sign-up-name"
          className="text-[12.5px] font-semibold text-[#26364b]"
        >
          昵称 <span className="text-[#8e9aa4]">（可选）</span>
        </label>
        <input
          id="sign-up-name"
          name="name"
          type="text"
          autoComplete="nickname"
          placeholder="怎么称呼你"
          maxLength={40}
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sign-up-email"
          className="text-[12.5px] font-semibold text-[#26364b]"
        >
          邮箱
        </label>
        <input
          id="sign-up-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <PasswordInput
        id="sign-up-password"
        name="password"
        label="密码"
        autoComplete="new-password"
        placeholder="至少 8 位字符"
        minLength={8}
        hint="建议使用字母、数字与符号的组合，注册后即可直接登录。"
        disabled={pending}
      />

      <AuthError message={state?.error} />

      <SubmitButton
        pending={pending}
        idleLabel="注册并进入工作台"
        pendingLabel="正在创建账号…"
      />

      <p className="mt-1 text-center text-[13px] text-[#58657a]">
        已有账号？
        <Link
          href={`/sign-in${redirectUrl !== "/dashboard" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="ml-1 font-medium text-[#1A6BD6] hover:underline"
        >
          直接登录
        </Link>
      </p>

      <p className="text-center text-[12.5px] leading-relaxed text-[#7d8ba0]">
        不想设置密码？
        <Link
          href={`/sign-in${redirectUrl !== "/dashboard" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="ml-1 font-medium text-[#1A6BD6] hover:underline"
        >
          用邮箱验证码登录 / 注册
        </Link>
      </p>
    </form>
  );
}
