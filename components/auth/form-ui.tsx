"use client";

/**
 * 登录 / 注册表单控件样式。
 * 跟随主题：半透明 glass 表面 + 内高光 + accent 聚焦环（全部取 --ui-* token）。
 */
const FIELD_BASE =
  "w-full rounded-xl border border-[var(--ui-glass-border)] bg-[var(--ui-glass-card)] px-4 py-3 text-[15px] text-[var(--ui-text)] shadow-[var(--ui-glass-highlight)] outline-none backdrop-blur-md transition placeholder:text-[var(--ui-faint)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-glass-strong)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--ui-accent)_16%,transparent)] disabled:cursor-not-allowed disabled:bg-[var(--ui-raised)] disabled:opacity-70";

export const inputClass = FIELD_BASE;

export function AuthError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-[color-mix(in_srgb,var(--ui-negative)_28%,transparent)] bg-[var(--ui-negative-bg)] px-4 py-2.5 text-[13px] leading-relaxed text-[var(--ui-negative)] shadow-[var(--ui-glass-highlight)] backdrop-blur-sm"
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
      className="auth-submit mt-1 w-full rounded-xl bg-[var(--ui-primary)] px-4 py-3 text-[15px] font-semibold text-[var(--ui-primary-ink)] shadow-[var(--ui-shadow-float)] transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--ui-accent)_30%,transparent)] focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
