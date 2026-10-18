"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteResume } from "@/lib/actions";

type Row = { id: string; title: string; updatedAt: string };
type Usage = {
  plan: "free" | "paid";
  aiUsed: number;
  aiLimit: number | null;
  exportUsed: number;
  exportLimit: number | null;
  resumeCount: number;
  resumeLimit: number | null;
};

export function DashboardView({ resumes, usage }: { resumes: Row[]; usage: Usage }) {
  const [rows, setRows] = useState<Row[]>(resumes);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这份简历吗？此操作不可恢复。")) return;
    const res = await deleteResume(id);
    if (res.ok) {
      setRows((r) => r.filter((x) => x.id !== id));
    } else {
      setError(res.message ?? "删除失败");
    }
  }

  async function handleExport(id: string) {
    const resp = await fetch(`/api/resumes/${id}/pdf`);
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "简历.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      let msg = "导出失败";
      try {
        const j = await resp.json();
        msg = j.message ?? msg;
      } catch {}
      setError(msg);
    }
  }

  const canCreate = usage.resumeLimit === null || usage.resumeCount < usage.resumeLimit;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">我的简历</h1>
            <p className="text-xs text-zinc-500">
              {usage.plan === "paid" ? "付费版 · 不限数量" : `免费版 · ${usage.resumeCount}/${usage.resumeLimit} 份`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              设置
            </Link>
            <Link
              href="/editor"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              + 新建简历
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
            {error}
          </div>
        )}

        {!canCreate && (
          <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-100">
            免费版已达简历数量上限，{" "}
            <Link href="/settings" className="font-semibold underline">
              升级付费版
            </Link>{" "}
            即可无限创建。
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center ring-1 ring-zinc-200">
            <p className="text-zinc-500">还没有简历</p>
            <Link
              href="/editor"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              开始制作第一份简历
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-xs text-zinc-400">
                    更新于 {new Date(r.updatedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <Link
                    href={`/editor?resumeId=${r.id}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    编辑
                  </Link>
                  <button
                    onClick={() => handleExport(r.id)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    导出
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg px-3 py-1.5 font-medium text-red-500 transition hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
