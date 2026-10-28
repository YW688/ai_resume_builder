"use client";

import { useState } from "react";

import { EmailCodeForm } from "./EmailCodeForm";
import { SignInForm } from "./SignInForm";

type Mode = "code" | "password";

const TABS: { id: Mode; label: string }[] = [
  { id: "code", label: "验证码登录" },
  { id: "password", label: "密码登录" },
];

/**
 * 登录方式切换：默认验证码登录（QQ 邮箱 / 任意邮箱都能收码），
 * 密码登录作为老账号的备选入口保留。
 */
export function SignInPanel({ redirectUrl }: { redirectUrl: string }) {
  const [mode, setMode] = useState<Mode>("code");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="登录方式"
        className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--ui-glass-border)] bg-[var(--ui-glass)] p-1 backdrop-blur"
      >
        {TABS.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`sign-in-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`sign-in-panel-${tab.id}`}
              onClick={() => setMode(tab.id)}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)] focus-visible:outline-none ${
                active
                  ? "bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-[var(--ui-glass-highlight),var(--ui-shadow-float)]"
                  : "text-[var(--ui-muted)] hover:bg-[var(--ui-glass-card)] hover:text-[var(--ui-text)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`sign-in-panel-${mode}`}
        aria-labelledby={`sign-in-tab-${mode}`}
      >
        {mode === "code" ? (
          <EmailCodeForm redirectUrl={redirectUrl} />
        ) : (
          <SignInForm redirectUrl={redirectUrl} />
        )}
      </div>
    </div>
  );
}
