"use client";

import { useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { createCheckoutAction, deleteAccount } from "@/lib/actions";

type Usage = {
  plan: "free" | "paid";
  aiUsed: number;
  aiLimit: number | null;
  exportUsed: number;
  exportLimit: number | null;
  resumeCount: number;
  resumeLimit: number | null;
};

export function SettingsView({ usage }: { usage: Usage }) {
  const { signOut } = useClerk();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUpgrade() {
    setBusy(true);
    setMsg(null);
    const res = await createCheckoutAction();
    if (res.ok) {
      window.location.assign(res.data.url);
    } else {
      setMsg(res.message ?? "无法发起支付");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("确定永久注销账号并删除所有数据吗？此操作不可恢复。")) return;
    setBusy(true);
    const res = await deleteAccount();
    if (res.ok) {
      await signOut(() => {
        window.location.replace("/");
      });
    } else {
      setMsg(res.message ?? "注销失败");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">设置</h1>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 返回
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {msg && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
            {msg}
          </div>
        )}

        {/* 计划 */}
        <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {usage.plan === "paid" ? "付费版" : "免费版"}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {usage.plan === "paid" ? "¥19/月 · 不限次数" : "升级后简历、AI 改写、PDF 下载均不限"}
              </p>
            </div>
            {usage.plan === "free" && (
              <button
                onClick={handleUpgrade}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "跳转中…" : "升级 ¥19/月"}
              </button>
            )}
          </div>
        </section>

        {/* 用量 */}
        <section className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">本月用量</h2>
          <ul className="space-y-3 text-sm">
            <UsageRow label="简历数量" used={usage.resumeCount} limit={usage.resumeLimit} />
            <UsageRow label="AI 改写" used={usage.aiUsed} limit={usage.aiLimit} />
            <UsageRow label="PDF 下载" used={usage.exportUsed} limit={usage.exportLimit} />
          </ul>
        </section>

        {/* 危险区 */}
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-red-100">
          <h2 className="mb-2 text-sm font-semibold text-red-600">注销账号</h2>
          <p className="mb-4 text-sm text-zinc-500">
            注销后将永久删除你的所有简历、照片与账号数据，无法恢复。
          </p>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            永久注销并删除数据
          </button>
        </section>
      </main>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium">
        {limit === null ? `${used} / 不限` : `${used} / ${limit}`}
      </span>
    </li>
  );
}
