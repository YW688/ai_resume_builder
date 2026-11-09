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
import { blankResumeContent, KEYWORD_DICTIONARY } from "@/lib/mock/data";
import type {
  Application,
  CreditsState,
  Job,
  Order,
  Preferences,
  Resume,
  ToastInput,
  User,
  WorkspaceState,
} from "@/lib/mock/types";
import { Icon } from "@/components/app/icons";
import { IconBtn } from "@/components/app/ui";
import { RealtimeWorkspaceProvider } from "@/lib/realtime/use-live-workspace";
// Server Actions：所有写操作先乐观更新本地 state，再落库；失败时回滚为服务端数据。
// 模块契约见 lib/workspace/actions.ts（全部 "use server"，返回 { ok: true } | { ok: false, ... }）。
import {
  deleteApplicationAction,
  deleteJobAction,
  deleteResumeAction,
  loadWorkspaceAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  purchaseCreditsAction,
  recordUsageAction,
  resetDemoAction,
  saveApplicationAction,
  saveJobAction,
  saveResumeAction,
  updatePreferencesAction,
  updateUserAction,
} from "@/lib/workspace/actions";

type ToastItem = ToastInput & { id: number };

type ActionFailure = { ok: false; error?: string; message?: string };
type ActionResult = { ok: true } | ActionFailure;

type WorkspaceContextValue = {
  state: WorkspaceState;
  /** 当前登录用户 id（与 Neon Auth / 数据库 users.id 一致），供 realtime 等下游使用。 */
  userId?: string;
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
  /** 购买点数套餐；成功后把余额与订单同步到本地状态。 */
  purchaseCredits: (packageId: string) => Promise<{
    ok: boolean;
    message?: string;
    simulated?: boolean;
  }>;
  /** AI 调用返回最新点数状态后，用它同步本地（免整页刷新）。 */
  applyCredits: (credits: CreditsState) => void;
  recordAiRewrite: () => void;
  recordExport: () => void;
  resetDemo: () => void;
  exportData: () => void;
  extractKeywords: (text: string) => string[];
  /** 用服务端真实数据覆盖本地 state；供 action 失败回滚与 realtime 失效刷新使用。 */
  refreshFromServer: () => Promise<void>;
  toast: (input: ToastInput) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

/** 数据库主键为 uuid，客户端生成的 id 必须是合法 UUID（crypto.randomUUID）。 */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // 极老浏览器兜底（正常浏览器 / Node 不会走到这里）。
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    return (char === "x" ? rand : (rand & 0x3) | 0x8).toString(16);
  });
}

/** 从 JD 原文里按词典提取关键词；没有命中则取前 0 个，由页面提示补充。 */
function extractKeywordsFrom(text: string): string[] {
  const lower = text.toLowerCase();
  return KEYWORD_DICTIONARY.filter((keyword) =>
    lower.includes(keyword.toLowerCase()),
  ).slice(0, 12);
}

function failureMessage(failure: ActionFailure, fallback: string): string {
  return failure.message || failure.error || fallback;
}

export function WorkspaceProvider({
  initial,
  userId,
  children,
}: {
  initial: WorkspaceState;
  userId?: string;
  children: React.ReactNode;
}) {
  // 初始状态由服务端 layout 通过 loadWorkspace(userId) 传入，客户端不再读取 localStorage。
  const [state, setState] = useState<WorkspaceState>(initial);
  // 写操作需要基于最新 state 计算乐观结果并拿到要持久化的完整对象，用 ref 避免回调随 state 重建。
  const stateRef = useRef<WorkspaceState>(initial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const commitState = useCallback((next: WorkspaceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

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

  /** 重新拉取服务端完整 workspace。action 失败时用它把乐观更新回滚成数据库真实数据。 */
  const refreshFromServer = useCallback(async () => {
    try {
      const next = await loadWorkspaceAction();
      commitState(next);
    } catch (error) {
      toast({
        title: "同步失败",
        description:
          error instanceof Error && error.message
            ? error.message
            : "无法从服务器刷新数据，请刷新页面重试。",
        tone: "negative",
      });
    }
  }, [commitState, toast]);

  // 数据一致性兜底：Neon Realtime 的公网入口不可用（平台 403）或浏览器无法建立
  // WebSocket 时，定时从服务端重新拉取 workspace，保证其他端/后台写入能反映到 UI。
  // Realtime 正常时它只是多余的一次刷新，不影响实时推送。
  useEffect(() => {
    const timer = setInterval(() => {
      void refreshFromServer();
    }, 25_000);
    return () => clearInterval(timer);
  }, [refreshFromServer]);

  const reportActionError = useCallback(
    (error: unknown, fallback: string) => {
      toast({
        title: "保存失败",
        description:
          error instanceof Error && error.message ? error.message : fallback,
        tone: "negative",
      });
      void refreshFromServer();
    },
    [refreshFromServer, toast],
  );

  /** 非阻塞地等待一个 server action；失败时 toast 并回滚。 */
  const persist = useCallback(
    (promise: Promise<ActionResult>, fallback: string) => {
      void promise
        .then((result) => {
          if (!result.ok) {
            throw new Error(failureMessage(result, fallback));
          }
        })
        .catch((error: unknown) => reportActionError(error, fallback));
    },
    [reportActionError],
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

  const updateResume = useCallback(
    (id: string, patch: Partial<Resume>) => {
      const prev = stateRef.current;
      const target = prev.resumes.find((item) => item.id === id);
      if (!target) return;
      const nextResume: Resume = { ...target, ...patch, updatedAt: nowIso() };
      commitState({
        ...prev,
        resumes: prev.resumes.map((item) =>
          item.id === id ? nextResume : item,
        ),
      });
      persist(saveResumeAction(nextResume), "简历未能保存，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const createResume = useCallback<WorkspaceContextValue["createResume"]>(
    (input) => {
      const prev = stateRef.current;
      const id = newId();
      const at = nowIso();
      const draft: Resume = {
        id,
        title: input?.title?.trim() || "未命名简历",
        targetJobId: input?.targetJobId ?? null,
        ...blankResumeContent(),
        fullName: prev.user?.name ?? "",
        phone: prev.user?.phone ?? "",
        email: prev.user?.email ?? "",
        city: prev.user?.city ?? "",
        templateId: input?.templateId ?? "classic",
        accent: "blue",
        status: "draft",
        updatedAt: at,
        createdAt: at,
      };
      commitState({ ...prev, resumes: [draft, ...prev.resumes] });
      persist(saveResumeAction(draft), "简历创建失败。");
      return id;
    },
    [commitState, persist],
  );

  const duplicateResume = useCallback<WorkspaceContextValue["duplicateResume"]>(
    (id) => {
      const prev = stateRef.current;
      const source = prev.resumes.find((item) => item.id === id);
      if (!source) return null;
      const newResumeId = newId();
      const at = nowIso();
      const copy: Resume = {
        ...(JSON.parse(JSON.stringify(source)) as Resume),
        id: newResumeId,
        title: `${source.title} 副本`,
        status: "draft",
        createdAt: at,
        updatedAt: at,
        experiences: source.experiences.map((exp) => ({
          ...exp,
          id: newId(),
        })),
        educations: source.educations.map((edu) => ({
          ...edu,
          id: newId(),
        })),
      };
      commitState({ ...prev, resumes: [copy, ...prev.resumes] });
      persist(saveResumeAction(copy), "复制简历失败。");
      return newResumeId;
    },
    [commitState, persist],
  );

  const deleteResume = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (!prev.resumes.some((item) => item.id === id)) return;
      commitState({
        ...prev,
        resumes: prev.resumes.filter((item) => item.id !== id),
        // 服务端 FK cascade 会删除关联投递，这里同步移除让 UI 立即反映。
        applications: prev.applications.filter((item) => item.resumeId !== id),
      });
      persist(deleteResumeAction(id), "简历删除失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const addJob = useCallback<WorkspaceContextValue["addJob"]>(
    (input) => {
      const prev = stateRef.current;
      const id = newId();
      const keywords =
        input.keywords && input.keywords.length
          ? input.keywords
          : extractKeywordsFrom(input.jdText);
      const nextJob: Job = {
        id,
        company: input.company.trim(),
        title: input.title.trim(),
        location: input.location?.trim() || "上海",
        salary: input.salary?.trim() || "面议",
        source: input.source?.trim() || "手动粘贴",
        savedAt: nowIso(),
        keywords,
        jdText: input.jdText,
      };
      commitState({ ...prev, jobs: [nextJob, ...prev.jobs] });
      persist(saveJobAction(nextJob), "岗位保存失败，已恢复服务器数据。");
      return id;
    },
    [commitState, persist],
  );

  const updateJob = useCallback(
    (id: string, patch: Partial<Job>) => {
      const prev = stateRef.current;
      const target = prev.jobs.find((item) => item.id === id);
      if (!target) return;
      const nextJob: Job = { ...target, ...patch };
      commitState({
        ...prev,
        jobs: prev.jobs.map((item) => (item.id === id ? nextJob : item)),
      });
      persist(saveJobAction(nextJob), "岗位更新失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const deleteJob = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (!prev.jobs.some((item) => item.id === id)) return;
      const at = nowIso();
      const detached = prev.resumes
        .filter((item) => item.targetJobId === id)
        .map((item) => ({ ...item, targetJobId: null, updatedAt: at }));
      commitState({
        ...prev,
        jobs: prev.jobs.filter((item) => item.id !== id),
        resumes: prev.resumes.map(
          (item) =>
            detached.find((resume) => resume.id === item.id) ?? item,
        ),
      });
      // 先解除简历与岗位的关联，再删除岗位（顺序即 server action 派发顺序）。
      detached.forEach((resume) =>
        persist(saveResumeAction(resume), "岗位关联的简历未能更新。"),
      );
      persist(deleteJobAction(id), "岗位删除失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const addApplication = useCallback<WorkspaceContextValue["addApplication"]>(
    (input) => {
      const prev = stateRef.current;
      const id = newId();
      const application: Application = { ...input, id };
      commitState({ ...prev, applications: [application, ...prev.applications] });
      persist(saveApplicationAction(application), "投递记录保存失败。");
      return id;
    },
    [commitState, persist],
  );

  const updateApplication = useCallback(
    (id: string, patch: Partial<Application>) => {
      const prev = stateRef.current;
      const target = prev.applications.find((item) => item.id === id);
      if (!target) return;
      const nextApplication: Application = { ...target, ...patch };
      commitState({
        ...prev,
        applications: prev.applications.map((item) =>
          item.id === id ? nextApplication : item,
        ),
      });
      persist(
        saveApplicationAction(nextApplication),
        "投递记录更新失败，已恢复服务器数据。",
      );
    },
    [commitState, persist],
  );

  const deleteApplication = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (!prev.applications.some((item) => item.id === id)) return;
      commitState({
        ...prev,
        applications: prev.applications.filter((item) => item.id !== id),
      });
      persist(deleteApplicationAction(id), "投递记录删除失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      const prev = stateRef.current;
      commitState({ ...prev, user: { ...prev.user, ...patch } });
      persist(updateUserAction(patch), "个人信息保存失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      const prev = stateRef.current;
      commitState({
        ...prev,
        preferences: { ...prev.preferences, ...patch },
      });
      persist(updatePreferencesAction(patch), "偏好保存失败，已恢复服务器数据。");
    },
    [commitState, persist],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      const target = prev.notifications.find((item) => item.id === id);
      if (!target || target.read) return;
      commitState({
        ...prev,
        notifications: prev.notifications.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      });
      persist(markNotificationReadAction(id), "通知状态更新失败。");
    },
    [commitState, persist],
  );

  const markAllNotificationsRead = useCallback(() => {
    const prev = stateRef.current;
    if (prev.notifications.every((item) => item.read)) return;
    commitState({
      ...prev,
      notifications: prev.notifications.map((item) => ({
        ...item,
        read: true,
      })),
    });
    persist(markAllNotificationsReadAction(), "通知状态更新失败。");
  }, [commitState, persist]);

  const recordAiRewrite = useCallback(() => {
    const prev = stateRef.current;
    commitState({
      ...prev,
      plan: {
        ...prev.plan,
        usage: {
          ...prev.plan.usage,
          aiRewrites: prev.plan.usage.aiRewrites + 1,
        },
      },
    });
    persist(recordUsageAction("ai"), "AI 用量记录失败。");
  }, [commitState, persist]);

  const recordExport = useCallback(() => {
    const prev = stateRef.current;
    commitState({
      ...prev,
      plan: {
        ...prev.plan,
        usage: {
          ...prev.plan.usage,
          exports: prev.plan.usage.exports + 1,
        },
      },
    });
    persist(recordUsageAction("export"), "导出用量记录失败。");
  }, [commitState, persist]);

  const applyCredits = useCallback(
    (credits: CreditsState) => {
      commitState({ ...stateRef.current, credits });
    },
    [commitState],
  );

  const purchaseCredits = useCallback<WorkspaceContextValue["purchaseCredits"]>(
    async (packageId) => {
      try {
        const result = await purchaseCreditsAction(packageId);
        if (!result.ok) {
          const failure = result as { error?: string; message?: string };
          const message =
            failure.message || failure.error || "购买失败，请稍后重试";
          toast({ title: "购买未完成", description: message, tone: "negative" });
          return { ok: false, message };
        }
        const { credits, order, simulated } = result.data;
        const prev = stateRef.current;
        const delivered: Order = {
          id: order.id,
          at: order.at,
          amountFen: order.amountFen,
          label: order.label,
          status: "paid",
          credits: order.credits,
          packageId: order.packageId,
        };
        commitState({
          ...prev,
          credits,
          plan: {
            ...prev.plan,
            name: "点数会员",
            startedAt: order.at,
            expiresAt: credits.expiresAt ?? prev.plan.expiresAt,
            priceFen: order.amountFen,
            autoRenew: false,
            orders: [delivered, ...prev.plan.orders],
          },
        });
        toast({
          title: simulated === false ? "支付成功，点数已到账" : "点数已到账（本机沙箱）",
          description: `本次到账 ${order.credits} 点，当前余额 ${credits.balance} 点。`,
          tone: "positive",
        });
        return { ok: true, simulated };
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "购买失败，请稍后重试";
        toast({ title: "购买失败", description: message, tone: "negative" });
        return { ok: false, message };
      }
    },
    [commitState, toast],
  );

  const resetDemo = useCallback(() => {
    void (async () => {
      try {
        const result = await resetDemoAction();
        if (!result.ok) {
          const failure = result as { error?: string; message?: string };
          throw new Error(
            failure.message ||
              failure.error ||
              "重置失败，已恢复服务器数据。",
          );
        }
        commitState(result.data);
      } catch (error) {
        reportActionError(error, "重置失败，已恢复服务器数据。");
      }
    })();
  }, [commitState, reportActionError]);

  const exportData = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(stateRef.current, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "jianli-data.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({ title: "已导出我的数据", description: "JSON 文件已下载到本地。" });
    } catch {
      toast({
        title: "导出失败",
        description: "当前浏览器不允许下载文件。",
        tone: "negative",
      });
    }
  }, [toast]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      userId,
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
      purchaseCredits,
      applyCredits,
      recordAiRewrite,
      recordExport,
      resetDemo,
      exportData,
      extractKeywords: extractKeywordsFrom,
      refreshFromServer,
      toast,
    }),
    [
      state,
      userId,
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
      purchaseCredits,
      applyCredits,
      recordAiRewrite,
      recordExport,
      resetDemo,
      exportData,
      refreshFromServer,
      toast,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <RealtimeWorkspaceProvider userId={userId} onServerRefresh={refreshFromServer}>
        {children}
      </RealtimeWorkspaceProvider>
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
