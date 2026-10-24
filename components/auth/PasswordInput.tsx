"use client";

import { useState } from "react";

import { inputClass } from "./form-ui";

/** 玻璃风格的密码输入框：右侧眼睛按钮切换明文 / 密文。 */
export function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  label,
  hint,
  minLength,
  disabled,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder: string;
  label: string;
  hint?: string;
  minLength?: number;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12.5px] font-semibold text-[#26364b]"
      >
        {label}
      </label>
      <div className="auth-password-wrap">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={minLength}
          className={`${inputClass} pr-12`}
          disabled={disabled}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "隐藏密码" : "显示密码"}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((value) => !value)}
          tabIndex={disabled ? -1 : 0}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {hint ? (
        <p className="text-[11.5px] text-[#7d8ba0]">{hint}</p>
      ) : null}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
          <path d="M9.4 5.4A9.7 9.7 0 0 1 12 5c5 0 8.7 4.4 9.7 7-.4 1-1.2 2.3-2.4 3.5" />
          <path d="M6.2 6.7C4.3 8.1 3 9.9 2.3 12c1 2.6 4.7 7 9.7 7 1.3 0 2.5-.3 3.6-.8" />
        </>
      ) : (
        <>
          <path d="M2.3 12C3.3 9.4 7 5 12 5s8.7 4.4 9.7 7c-1 2.6-4.7 7-9.7 7S3.3 14.6 2.3 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
