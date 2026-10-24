"use client";

const FIELD_BASE =
  "w-full rounded-lg border border-[#dbe3ee] bg-white px-3.5 py-2.5 text-[15px] text-[#0E1B2A] outline-none transition placeholder:text-[#8e9aa4] focus:border-[#1A6BD6] focus:ring-4 focus:ring-[#1A6BD6]/10 disabled:cursor-not-allowed disabled:bg-[#f7f9fc] disabled:opacity-70";

export const inputClass = FIELD_BASE;

export function AuthError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className="rounded-lg bg-[#fdeceb] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#c4242a] ring-1 ring-[#f7d4d2]"
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
      className="mt-1 w-full rounded-lg bg-[#1A6BD6] px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#1457ad] focus-visible:ring-4 focus-visible:ring-[#1A6BD6]/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
