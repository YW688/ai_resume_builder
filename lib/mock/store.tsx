"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { blankResumeContent, initialWorkspace, KEYWORD_DICTIONARY } from "@/lib/mock/data";
import type {
  Application,
  Job,
  Preferences,
  Resume,
  ToastInput,
  User,
  WorkspaceState,
} from "@/lib/mock/types";
import { Icon } from "@/components/app/icons";
import { IconBtn } from "@/components/app/ui";

const STORAGE_KEY = "jianli-demo-v1";
const STORAGE_VERSION = 1;

type ToastItem = ToastInput & { id: number };

type WorkspaceContextValue = {
  state: WorkspaceState;
  resume: (id: string) => Resume | undefined;
  job: (id: string | null | undefined) => Job | undefined;
  updateResume: (id: string, patch: Partial<Resume>) => void;
  createResume: (input?: {
    title?: string;
    targetJobId?: string | null;
    templateId?: Resume["templateId"];
  }) => string;
  duplicateResume: (id: string) => string | null;
  deleteResume: (id: string) => void;
  addJob: (input: {
    company: string;
    title: string;
    location?: string;
    salary?: string;
    source?: string;
    jdText: string;
    keywords?: string[];
  }) => string;
  updateJob: (id: string, patch: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  addApplication: (input: Omit<Application, "id">) => string;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  updateUser: (patch: Partial<User>) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  renewPlan: () => void;
  recordAiRewrite: () => void;
  recordExport: () => void;
  resetDemo: () => void;
  exportData: () => void;
  extractKeywords: (text: string) => string[];
  toast: (input: ToastInput) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function cloneSeed(): WorkspaceState {
  return JSON.parse(JSON.stringify(initialWorkspace)) as WorkspaceState;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** 从 JD 原文里按词典提取关键词；没有命中则取前 0 个，由页面提示补充。 */
function extractKeywordsFrom(text: string): string[] {
  const lower = text.toLowerCase();
  return KEYWORD_DICTIONARY.filter((keyword) =>
    lower.includes(keyword.toLowerCase()),
  ).slice(0, 12);
}

function readStorage(): WorkspaceState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      version?: number;
      state?: WorkspaceState;
    };
    if (parsed.version !== STORAGE_VERSION || !parsed.state) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => cloneSeed());
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const stored = readStorage();
    // 演示数据在挂载后从 localStorage 恢复，属于外部存储同步，非渲染派生状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, state }),
      );
    } catch {
      // localStorage 不可用时静默降级为内存状态
    }
  }, [state, hydrated]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((items) => [...items.slice(-2), { ...input, id }]);
      const timer = setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
        timers.current.delete(id);
      }, 3800);
      timers.current.set(id, timer);
    },
    [],
  );

  const resume = useCallback(
    (id: string) => state.resumes.find((item) => item.id === id),
    [state.resumes],
  );

  const job = useCallback(
    (id: string | null | undefined) =>
      id ? state.jobs.find((item) => item.id === id) : undefined,
    [state.jobs],
  );

  const updateResume = useCallback((id: string, patch: Partial<Resume>) => {
    setState((prev) => ({
      ...prev,
      resumes: prev.resumes.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item,
      ),
    }));
  }, []);

  const createResume = useCallback<WorkspaceContextValue["createResume"]>(
    (input) => {
      const id = makeId("r");
      const at = nowIso();
      setState((prev) => {
        const draft: Resume = {
          id,
          title: input?.title?.trim() || "未命名简历",
          targetJobId: input?.targetJobId ?? null,
          ...blankResumeContent(),
          fullName: prev.user.name,
          phone: prev.user.phone,
          email: prev.user.email,
          city: prev.user.city,
          templateId: input?.templateId ?? "classic",
          accent: "blue",
          status: "draft",
          updatedAt: at,
          createdAt: at,
        };
        return { ...prev, resumes: [draft, ...prev.resumes] };
      });
      return id;
    },
    [],
  );

  const duplicateResume = useCallback<WorkspaceContextValue["duplicateResume"]>(
    (id) => {
      const source = state.resumes.find((item) => item.id === id);
      if (!source) return null;
      const newId = makeId("r");
      const at = nowIso();
      const copy: Resume = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        title: `${source.title} 副本`,
        status: "draft",
        createdAt: at,
        updatedAt: at,
        experiences: source.experiences.map((exp) => ({
          ...exp,
          id: makeId("e"),
        })),
        educations: source.educations.map((edu) => ({
          ...edu,
          id: makeId("ed"),
        })),
      };
      setState((prev) => ({ ...prev, resumes: [copy, ...prev.resumes] }));
      return newId;
    },
    [state.resumes],
  );

  const deleteResume = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      resumes: prev.resumes.filter((item) => item.id !== id),
      applications: prev.applications.filter((item) => item.resumeId !== id),
    }));
  }, []);

  const addJob = useCallback<WorkspaceContextValue["addJob"]>((input) => {
    const id = makeId("j");
    const keywords =
      input.keywords && input.keywords.length
        ? input.keywords
        : extractKeywordsFrom(input.jdText);
    setState((prev) => ({
      ...prev,
      jobs: [
        {
          id,
          company: input.company.trim(),
          title: input.title.trim(),
          location: input.location?.trim() || "上海",
          salary: input.salary?.trim() || "面议",
          source: input.source?.trim() || "手动粘贴",
          savedAt: nowIso(),
          keywords,
          jdText: input.jdText,
        },
        ...prev.jobs,
      ],
    }));
    return id;
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }, []);

  const deleteJob = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.filter((item) => item.id !== id),
      resumes: prev.resumes.map((item) =>
        item.targetJobId === id ? { ...item, targetJobId: null } : item,
      ),
    }));
  }, []);

  const addApplication = useCallback<WorkspaceContextValue["addApplication"]>(
    (input) => {
      const id = makeId("a");
      setState((prev) => ({
        ...prev,
        applications: [{ ...input, id }, ...prev.applications],
      }));
      return id;
    },
    [],
  );

  const updateApplication = useCallback(
    (id: string, patch: Partial<Application>) => {
      setState((prev) => ({
        ...prev,
        applications: prev.applications.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  const deleteApplication = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      applications: prev.applications.filter((item) => item.id !== id),
    }));
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setState((prev) => ({ ...prev, user: { ...prev.user, ...patch } }));
  }, []);

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...patch },
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((item) => ({
        ...item,
        read: true,
      })),
    }));
  }, []);

  const renewPlan = useCallback(() => {
    setState((prev) => {
      const base = Math.max(
        new Date(prev.plan.expiresAt).getTime(),
        Date.now(),
      );
      const expiresAt = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        ...prev,
        plan: {
          ...prev.plan,
          expiresAt,
          orders: [
            {
              id: makeId("o"),
              at: nowIso(),
              amountFen: prev.plan.priceFen,
              label: "30 天通行证",
              status: "paid" as const,
            },
            ...prev.plan.orders,
          ],
        },
      };
    });
  }, []);

  const recordAiRewrite = useCallback(() => {
    setState((prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        usage: {
          ...prev.plan.usage,
          aiRewrites: prev.plan.usage.aiRewrites + 1,
        },
      },
    }));
  }, []);

  const recordExport = useCallback(() => {
    setState((prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        usage: {
          ...prev.plan.usage,
          exports: prev.plan.usage.exports + 1,
        },
      },
    }));
  }, []);

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState(cloneSeed());
  }, []);

  const exportData = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "jianli-demo-data.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: "已导出演示数据", description: "JSON 文件已下载到本地。" });
    } catch {
      toast({
        title: "导出失败",
        description: "当前浏览器不允许下载文件。",
        tone: "negative",
      });
    }
  }, [state, toast]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      resume,
      job,
      updateResume,
      createResume,
      duplicateResume,
      deleteResume,
      addJob,
      updateJob,
      deleteJob,
      addApplication,
      updateApplication,
      deleteApplication,
      updateUser,
      updatePreferences,
      markNotificationRead,
      markAllNotificationsRead,
      renewPlan,
      recordAiRewrite,
      recordExport,
      resetDemo,
      exportData,
      extractKeywords: extractKeywordsFrom,
      toast,
    }),
    [
      state,
      resume,
      job,
      updateResume,
      createResume,
      duplicateResume,
      deleteResume,
      addJob,
      updateJob,
      deleteJob,
      addApplication,
      updateApplication,
      deleteApplication,
      updateUser,
      updatePreferences,
      markNotificationRead,
      markAllNotificationsRead,
      renewPlan,
      recordAiRewrite,
      recordExport,
      resetDemo,
      exportData,
      toast,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className="toast" role="status">
            <span
              className={`toast-icon${
                item.tone === "positive"
                  ? " is-positive"
                  : item.tone === "negative"
                    ? " is-negative"
                    : ""
              }`}
            >
              <Icon
                name={
                  item.tone === "negative"
                    ? "warning"
                    : item.tone === "positive"
                      ? "checkCircle"
                      : "info"
                }
                size={16}
              />
            </span>
            <div className="toast-main">
              <div className="toast-title">{item.title}</div>
              {item.description ? (
                <div className="toast-desc">{item.description}</div>
              ) : null}
            </div>
            <span className="toast-close">
              <IconBtn
                label="关闭提示"
                icon="close"
                size={14}
                onClick={() => dismissToast(item.id)}
              />
            </span>
          </div>
        ))}
      </div>
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace 必须在 WorkspaceProvider 内使用");
  }
  return context;
}
