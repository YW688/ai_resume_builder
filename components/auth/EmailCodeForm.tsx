"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  signInWithEmailCode,
  type EmailCodeFormState,
} from "@/app/sign-in/actions";
import { authClient } from "@/lib/auth/client";
import { AuthError, SubmitButton, inputClass } from "./form-ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_SECONDS = 60;

type SendStatus = "idle" | "sending" | "sent" | "error";
type SendState = { status: SendStatus; message?: string; sentTo?: string };

/**
 * 邮箱验证码登录表单。
 *
 * 发送验证码走同源 `/api/auth` 代理 → Neon Auth，真正的邮件由 Neon Auth 的
 * 邮件服务（共享 SMTP 或管理员配置的自定义 SMTP）发出。浏览器端不接触任何
 * SMTP 凭据，也不把验证码写入 localStorage / 日志。
 */
export function EmailCodeForm({ redirectUrl }: { redirectUrl: string }) {
  const [state, formAction, pending] = useActionState<
    EmailCodeFormState,
    FormData
  >(signInWithEmailCode, null);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const cooling = cooldown > 0;

  useEffect(() => {
    if (!cooling) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooling]);

  const emailValid = EMAIL_RE.test(email.trim());
  const sending = sendState.status === "sending";
  const sendDisabled = pending || sending || cooling || !emailValid;
  const sentTo = sendState.status === "sent" ? sendState.sentTo : undefined;

  async function handleSend() {
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      setSendState({ status: "error", message: "请输入有效的邮箱地址" });
      return;
    }

    setSendState({ status: "sending" });
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: target,
        type: "sign-in",
      });
      if (error) {
        setSendState({ status: "error", message: sendErrorMessage(error) });
        return;
      }
      setSendState({ status: "sent", sentTo: target });
      setCooldown(COOLDOWN_SECONDS);
      codeRef.current?.focus();
    } catch {
      setSendState({
        status: "error",
        message: "网络异常，验证码发送失败，请稍后重试",
      });
    }
  }

  let sendLabel = "获取验证码";
  if (sending) sendLabel = "发送中…";
  else if (cooling) sendLabel = `${cooldown}s 后可重发`;
  else if (sendState.status === "sent") sendLabel = "重新发送";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="redirectUrl" value={redirectUrl} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sign-in-email"
          className="text-[12.5px] font-semibold text-[var(--ui-text)]"
        >
          邮箱
        </label>
        <div className="relative">
          <input
            id="sign-in-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (sendState.status !== "idle") {
                setSendState({ status: "idle" });
              }
            }}
            className={`${inputClass} pr-[8.5rem]`}
            disabled={pending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabled}
            aria-live="off"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] px-3 py-2 text-[12.5px] font-semibold whitespace-nowrap text-[var(--ui-accent)] transition hover:bg-[color-mix(in_srgb,var(--ui-accent)_18%,transparent)] focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--ui-faint)]"
          >
            {sendLabel}
          </button>
        </div>
        <p className="text-[11.5px] leading-relaxed text-[var(--ui-faint)]">
          验证码 10 分钟内有效；未注册的邮箱会自动创建账号，无需设置密码。
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sign-in-code"
          className="text-[12.5px] font-semibold text-[var(--ui-text)]"
        >
          验证码
        </label>
        <input
          ref={codeRef}
          id="sign-in-code"
          name="code"
          type="text"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="6 位数字"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
          }
          className={`${inputClass} text-center text-[18px] font-semibold`}
          disabled={pending}
          aria-describedby={sentTo ? "sign-in-code-hint" : undefined}
        />
        {sentTo ? (
          <p
            id="sign-in-code-hint"
            role="status"
            aria-live="polite"
            className="text-[11.5px] leading-relaxed text-[var(--ui-accent)]"
          >
            验证码已发送至 {sentTo}，请查收（也请检查垃圾邮件）。
          </p>
        ) : null}
      </div>

      {sendState.status === "error" ? (
        <AuthError message={sendState.message} />
      ) : null}
      <AuthError message={state?.error} />

      <SubmitButton
        pending={pending}
        idleLabel="登录 / 注册"
        pendingLabel="正在验证…"
      />
    </form>
  );
}

function sendErrorMessage(error: { code?: string; message?: string } | null): string {
  const code = (error?.code ?? "").toLowerCase();
  if (code === "over_request_rate_limit" || code === "too_many_requests") {
    return "发送过于频繁，请稍后再试";
  }
  if (code === "invalid_email" || code === "email_address_invalid") {
    return "请输入有效的邮箱地址";
  }
  if (code.startsWith("network_") || code === "internal_error") {
    return "网络异常，验证码发送失败，请稍后重试";
  }
  return "验证码发送失败，请稍后重试";
}
