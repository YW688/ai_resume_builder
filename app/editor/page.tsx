"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  saveResume,
  getLatestResume,
  getResume,
  uploadPhotoAction,
  rewriteExperienceAction,
  getUsageAction,
  type ExperienceInput,
  type EducationInput,
} from "@/lib/actions";

const STORAGE_KEY = "resume-draft-v1";

type Draft = {
  title: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  skills: string;
  experiences: ExperienceInput[];
  educations: EducationInput[];
};

const emptyDraft: Draft = {
  title: "我的简历",
  fullName: "",
  phone: "",
  email: "",
  city: "",
  summary: "",
  skills: "",
  experiences: [],
  educations: [],
};

const newExperience = (): ExperienceInput => ({
  company: "",
  title: "",
  startDate: "",
  endDate: "",
  description: "",
});

const newEducation = (): EducationInput => ({
  school: "",
  degree: "",
  major: "",
  startDate: "",
  endDate: "",
});

function readLocal(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function writeLocal(draft: Draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage 满或不可用，忽略
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

type Usage = {
  plan: "free" | "paid";
  aiUsed: number;
  aiLimit: number | null;
  exportUsed: number;
  exportLimit: number | null;
};

export default function EditorPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { redirectToSignIn } = useClerk();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [jd, setJd] = useState("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const authKeyRef = useRef<string>("");

  // 初次加载（按登录态）
  useEffect(() => {
    if (!isLoaded) return;
    const key = isSignedIn ? "signedin" : "anon";
    if (authKeyRef.current === key) return;
    authKeyRef.current = key;

    async function load() {
      if (isSignedIn) {
        const requestedId = new URLSearchParams(window.location.search).get("resumeId");
        const res = requestedId ? await getResume(requestedId) : await getLatestResume();
        if (res.ok && res.data) {
          setResumeId(res.data.resumeId);
          setPhotoKey(res.data.photoKey);
          setPhotoUrl(res.data.photoUrl);
          setDraft({
            title: res.data.title,
            fullName: res.data.fullName,
            phone: res.data.phone,
            email: res.data.email,
            city: res.data.city,
            summary: res.data.summary,
            skills: res.data.skills,
            experiences: res.data.experiences,
            educations: res.data.educations,
          });
        } else {
          const local = readLocal();
          if (local) {
            // 合并匿名草稿为新简历
            const saved = await saveResume({ resumeId: null, ...local, photoKey: null });
            if (saved.ok) {
              setResumeId(saved.data.resumeId);
              setDraft(local);
              clearLocal();
            } else if (saved.error === "limit_reached") {
              setSaveError(saved.message ?? "无法创建简历");
              setDraft(local);
            }
          } else {
            setDraft(emptyDraft);
          }
        }
        const u = await getUsageAction();
        if (u) setUsage(u);
      } else {
        const local = readLocal();
        setDraft(local ?? emptyDraft);
        setResumeId(null);
        setPhotoKey(null);
        setPhotoUrl(null);
        setUsage(null);
      }
      setHydrated(true);
    }
    load();
  }, [isLoaded, isSignedIn]);

  // 匿名自动保存到本地
  useEffect(() => {
    if (!isLoaded || isSignedIn || !hydrated) return;
    writeLocal(draft);
  }, [draft, isLoaded, isSignedIn, hydrated]);

  // 登录态自动保存到服务端（防抖）
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !hydrated) return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveResume({ resumeId, ...draft, photoKey });
      if (res.ok) {
        setResumeId(res.data.resumeId);
        setSaveState("saved");
      } else if (res.error === "limit_reached") {
        setSaveError(res.message ?? "已达上限");
        setSaveState("error");
      } else if (res.error === "unauthorized") {
        setSaveState("error");
      } else {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draft, resumeId, photoKey, isLoaded, isSignedIn, hydrated]);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function patchExperience(idx: number, p: Partial<ExperienceInput>) {
    setDraft((d) => {
      const exps = d.experiences.slice();
      exps[idx] = { ...exps[idx], ...p };
      return { ...d, experiences: exps };
    });
  }

  function patchEducation(idx: number, p: Partial<EducationInput>) {
    setDraft((d) => {
      const edus = d.educations.slice();
      edus[idx] = { ...edus[idx], ...p };
      return { ...d, educations: edus };
    });
  }

  async function handlePhoto(file: File) {
    setPhotoError(null);
    if (!isSignedIn) return redirectToSignIn();
    const fd = new FormData();
    fd.append("file", file);
    if (photoKey) fd.append("oldKey", photoKey);
    const res = await uploadPhotoAction(fd);
    if (res.ok) {
      setPhotoKey(res.data.key);
      setPhotoUrl(res.data.url);
    } else {
      setPhotoError(res.message ?? "上传失败");
    }
  }

  async function handleRewrite(idx: number) {
    setAiError(null);
    if (!isSignedIn) return redirectToSignIn();
    if (!jd.trim()) {
      setAiError("请先在下方「职位描述（JD）」粘贴目标职位");
      return;
    }
    setAiLoadingIdx(idx);
    const res = await rewriteExperienceAction({
      resumeId,
      experience: draft.experiences[idx],
      jd,
    });
    if (res.ok) {
      patchExperience(idx, { description: res.data.text });
      const u = await getUsageAction();
      if (u) setUsage(u);
    } else if (res.error === "unauthorized") {
      redirectToSignIn();
    } else {
      setAiError(res.message ?? "AI 改写失败");
    }
    setAiLoadingIdx(null);
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    if (!isSignedIn) {
      setExporting(false);
      return redirectToSignIn();
    }
    let id = resumeId;
    if (!id) {
      const saved = await saveResume({ resumeId: null, ...draft, photoKey });
      if (!saved.ok) {
        setExportError(saved.message ?? "保存失败，请重试");
        setExporting(false);
        return;
      }
      id = saved.data.resumeId;
      setResumeId(id);
    }
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
      const u = await getUsageAction();
      if (u) setUsage(u);
    } else {
      if (resp.status === 401) {
        setExporting(false);
        return redirectToSignIn();
      }
      let msg = "导出失败，请稍后重试";
      try {
        const j = await resp.json();
        msg = j.message ?? msg;
      } catch {}
      setExportError(msg);
    }
    setExporting(false);
  }

  const remainingAi = usage
    ? usage.aiLimit === null
      ? "无限"
      : String(Math.max(0, usage.aiLimit - usage.aiUsed))
    : null;
  const remainingExport = usage
    ? usage.exportLimit === null
      ? "无限"
      : String(Math.max(0, usage.exportLimit - usage.exportUsed))
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
              ← 首页
            </Link>
            <SaveIndicator state={saveState} />
          </div>
          <div className="flex items-center gap-2">
            {usage && (
              <span className="hidden text-xs text-zinc-500 sm:inline">
                AI {remainingAi} · PDF {remainingExport}
              </span>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? "导出中…" : "导出 PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {saveError && (
          <Banner onClose={() => setSaveError(null)}>
            {saveError}
          </Banner>
        )}
        {exportError && (
          <Banner onClose={() => setExportError(null)}>
            {exportError}
          </Banner>
        )}

        {/* 照片 */}
        <section className="mb-8">
          <PhotoUploader
            photoUrl={photoUrl}
            signedIn={isSignedIn}
            onSelect={handlePhoto}
            onSignIn={redirectToSignIn}
            error={photoError}
          />
        </section>

        {/* 标题与联系方式 */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">简历标题与联系方式</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="简历标题">
              <input
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="姓名">
              <input
                value={draft.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                placeholder="张三"
                className={inputCls}
              />
            </Field>
            <Field label="电话">
              <input
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="邮箱">
              <input
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="所在城市">
              <input
                value={draft.city}
                onChange={(e) => patch({ city: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* 总结 */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">个人总结</h2>
          <textarea
            value={draft.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            rows={4}
            placeholder="一句话概括你的核心优势与经验…"
            className={inputCls}
          />
        </section>

        {/* 经历 */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">工作经历</h2>
          {draft.experiences.length === 0 && (
            <p className="mb-4 text-sm text-zinc-400">还没有经历，点击下方按钮添加。</p>
          )}
          <div className="space-y-6">
            {draft.experiences.map((exp, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="公司">
                    <input
                      value={exp.company}
                      onChange={(e) => patchExperience(idx, { company: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="职位">
                    <input
                      value={exp.title}
                      onChange={(e) => patchExperience(idx, { title: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="开始时间（如 2021.03）">
                    <input
                      value={exp.startDate}
                      onChange={(e) => patchExperience(idx, { startDate: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="结束时间（如 2023.06 / 至今）">
                    <input
                      value={exp.endDate}
                      onChange={(e) => patchExperience(idx, { endDate: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="工作描述（可用 AI 改写）">
                  <textarea
                    value={exp.description}
                    onChange={(e) => patchExperience(idx, { description: e.target.value })}
                    rows={4}
                    className={inputCls}
                  />
                </Field>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleRewrite(idx)}
                    disabled={aiLoadingIdx === idx}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {aiLoadingIdx === idx ? "改写中…" : exp.description ? "重新生成" : "AI 改写"}
                  </button>
                  <button
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        experiences: d.experiences.filter((_, i) => i !== idx),
                      }))
                    }
                    className="text-xs text-zinc-400 hover:text-red-500"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {aiError && <p className="mt-3 text-sm text-red-600">{aiError}</p>}
          <button
            onClick={() => setDraft((d) => ({ ...d, experiences: [...d.experiences, newExperience()] }))}
            className="mt-4 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            + 添加经历
          </button>
        </section>

        {/* 教育 */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">教育背景</h2>
          <div className="space-y-4">
            {draft.educations.map((edu, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="学校">
                    <input
                      value={edu.school}
                      onChange={(e) => patchEducation(idx, { school: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="专业">
                    <input
                      value={edu.major}
                      onChange={(e) => patchEducation(idx, { major: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="学历（如 本科）">
                    <input
                      value={edu.degree}
                      onChange={(e) => patchEducation(idx, { degree: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="时间（如 2017 - 2021）">
                    <input
                      value={`${edu.startDate}${edu.endDate ? " - " + edu.endDate : ""}`}
                      onChange={(e) => {
                        const [s, en] = e.target.value.split(" - ");
                        patchEducation(idx, { startDate: s ?? "", endDate: en ?? "" });
                      }}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <button
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      educations: d.educations.filter((_, i) => i !== idx),
                    }))
                  }
                  className="mt-2 text-xs text-zinc-400 hover:text-red-500"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setDraft((d) => ({ ...d, educations: [...d.educations, newEducation()] }))}
            className="mt-4 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            + 添加教育
          </button>
        </section>

        {/* 技能 */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">技能（每行一个）</h2>
          <textarea
            value={draft.skills}
            onChange={(e) => patch({ skills: e.target.value })}
            rows={4}
            placeholder="Python&#10;数据分析&#10;SQL"
            className={inputCls}
          />
        </section>

        {/* JD */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-4 text-sm font-semibold text-zinc-500">职位描述（JD）</h2>
          <p className="mb-3 text-xs text-zinc-400">
            粘贴目标职位描述，然后点击各段经历上的「AI 改写」，AI 会针对该 JD 生成带关键词与量化成果的版本。
          </p>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={6}
            placeholder="粘贴职位描述（JD）…"
            className={inputCls}
          />
        </section>

        {usage && usage.plan === "free" && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
            免费版：AI 改写 {remainingAi} 次 · PDF 下载 {remainingExport} 次。{" "}
            <Link href="/settings" className="font-semibold underline">
              升级付费版
            </Link>{" "}
            解锁无限。
          </div>
        )}
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const map = {
    idle: { text: "", cls: "text-zinc-400" },
    saving: { text: "保存中…", cls: "text-zinc-400" },
    saved: { text: "已保存", cls: "text-emerald-600" },
    error: { text: "保存失败", cls: "text-red-600" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-xs ${cls}`}>{text}</span>;
}

function Banner({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-start justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
      <span>{children}</span>
      <button onClick={onClose} className="ml-4 text-red-400 hover:text-red-600">
        ✕
      </button>
    </div>
  );
}

function PhotoUploader({
  photoUrl,
  signedIn,
  onSelect,
  onSignIn,
  error,
}: {
  photoUrl: string | null;
  signedIn: boolean | undefined;
  onSelect: (file: File) => void;
  onSignIn: () => void;
  error: string | null;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="照片" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-zinc-400">照片</span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">证件照</p>
        <p className="mt-1 text-xs text-zinc-400">支持 jpg / png / webp，≤ 5MB</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {signedIn ? (
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
          {photoUrl ? "更换" : "上传"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelect(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <button
          onClick={onSignIn}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          登录后上传
        </button>
      )}
    </div>
  );
}
