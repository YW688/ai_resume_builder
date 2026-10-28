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
        className="grid grid-cols-2 gap-1 rounded-xl border border-white/70 bg-white/40 p-1 backdrop-blur"
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
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition focus-visible:ring-4 focus-visible:ring-[#1A6BD6]/25 focus-visible:outline-none ${
                active
                  ? "bg-white/85 text-[#0E1B2A] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_20px_-16px_rgba(14,27,42,0.5)]"
                  : "text-[#58657a] hover:bg-white/50 hover:text-[#26364b]"
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
