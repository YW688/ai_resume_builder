"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signInWithEmail, type AuthFormState } from "@/app/sign-in/actions";
import { AuthError, SubmitButton, inputClass } from "./form-ui";
import { PasswordInput } from "./PasswordInput";

export function SignInForm({ redirectUrl }: { redirectUrl: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signInWithEmail,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectUrl" value={redirectUrl} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sign-in-email"
          className="text-[12.5px] font-semibold text-[#26364b]"
        >
          邮箱
        </label>
        <input
          id="sign-in-email"
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
        id="sign-in-password"
        name="password"
        label="密码"
        autoComplete="current-password"
        placeholder="请输入密码"
        disabled={pending}
      />

      <AuthError message={state?.error} />

      <SubmitButton
        pending={pending}
        idleLabel="登录"
        pendingLabel="正在登录…"
      />

      <p className="mt-1 text-center text-[13px] text-[#58657a]">
        还没有账号？
        <Link
          href={`/sign-up${redirectUrl !== "/dashboard" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="ml-1 font-medium text-[#1A6BD6] hover:underline"
        >
          免费注册
        </Link>
      </p>
    </form>
  );
}
