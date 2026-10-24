"use client";

/**
 * 登录 / 注册表单控件样式。
 * 与 AuthShell 的玻璃外壳统一：半透明白、内高光、蓝聚焦环。
 */
const FIELD_BASE =
  "w-full rounded-xl border border-white/75 bg-white/62 px-4 py-3 text-[15px] text-[#0E1B2A] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none backdrop-blur-md transition placeholder:text-[#7d8ba0] focus:border-[#1A6BD6]/65 focus:bg-white/85 focus:ring-4 focus:ring-[#1A6BD6]/14 disabled:cursor-not-allowed disabled:bg-white/40 disabled:opacity-70";

export const inputClass = FIELD_BASE;

export function AuthError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-[#C4242A]/18 bg-[#FDECEB]/85 px-4 py-2.5 text-[13px] leading-relaxed text-[#A91D24] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-sm"
    >
      {message}
    </p>
  );
}

export function SubmitButton({
  pending,
  idleLabel,
  pendingLabel,
}: {
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="auth-submit mt-1 w-full rounded-xl bg-[#1A6BD6] px-4 py-3 text-[15px] font-semibold text-white shadow-[0_16px_32px_-18px_rgba(26,107,214,0.95),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:bg-[#155CC0] focus-visible:ring-4 focus-visible:ring-[#1A6BD6]/30 focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
