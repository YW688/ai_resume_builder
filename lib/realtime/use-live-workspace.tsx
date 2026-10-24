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
import type { ReactNode } from "react";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import type { SealedLiveQuery } from "@neon/realtime/client";

import { createWorkspaceRealtimeClient } from "@/lib/realtime/client";
import type {
  LiveApplication,
  LiveJob,
  LiveNotification,
  LiveWorkspaceData,
  SealedWorkspaceQueries,
} from "@/lib/realtime/types";

/** 订阅状态：供顶部栏/调试面板显示实时连接是否正常。 */
export type LiveWorkspaceStatus = "idle" | "connecting" | "connected" | "stale" | "error";

export type LiveWorkspaceState = {
  status: LiveWorkspaceStatus;
  error?: Error;
  /** 三组 live query 的当前快照（未收到首个结果前为 undefined）。 */
  data?: LiveWorkspaceData;
  /** 最近一次收到数据库变更批次的本地时间（Unix ms）。 */
  lastChangeAt?: number;
  /** 手动续签 sealed query（正常情况下 hook 会在过期前自动续签）。 */
  renew: () => void;
};

const LiveWorkspaceContext = createContext<LiveWorkspaceState | null>(null);

type ProviderProps = {
  /** 当前登录用户 id（Neon Auth session.user.id）。为空时不做任何订阅。 */
  userId?: string | null;
  /**
   * 收到数据库变更批次后的回调：通常是 `refreshFromServer()`，把服务端真实
   * 数据重新灌进 UI store。多次变更会合并成一次（短防抖）。
   */
  onServerRefresh?: () => void | Promise<void>;
  children?: ReactNode;
};

/**
 * 包裹需要实时刷新的子树。
 *
 * ```tsx
 * <RealtimeWorkspaceProvider userId={userId} onServerRefresh={refreshFromServer}>
 *   <Dashboard />
 * </RealtimeWorkspaceProvider>
 * ```
 *
 * 放在 `lib/mock/store.tsx` 的 Provider 内部（能拿到 userId / refreshFromServer），
 * 但要在使用 `useLiveWorkspace()` 的组件之上。
 */
export function RealtimeWorkspaceProvider({
  userId,
  onServerRefresh,
  children,
}: ProviderProps) {
  // 按 references/ssr.md：在 useState 初始化器里创建，避免模块级单例与 SSR 连接。
  const [client] = useState(createWorkspaceRealtimeClient);

  return (
    <RealtimeProvider client={client}>
      {/* key=userId：换用户/登出时整棵订阅子树重建，天然丢弃上一位用户的 rows。 */}
      <WorkspaceSession
        key={userId ?? "signed-out"}
        userId={userId}
        onServerRefresh={onServerRefresh}
      >
        {children}
      </WorkspaceSession>
    </RealtimeProvider>
  );
}

type SessionProps = {
  userId?: string | null;
  onServerRefresh?: () => void | Promise<void>;
  children?: ReactNode;
};

function WorkspaceSession({ userId, onServerRefresh, children }: SessionProps) {
  const [sealed, setSealed] = useState<SealedWorkspaceQueries | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [status, setStatus] = useState<LiveWorkspaceStatus>(userId ? "connecting" : "idle");
  const [data, setData] = useState<LiveWorkspaceData | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [lastChangeAt, setLastChangeAt] = useState<number | undefined>(undefined);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 从服务端换一份新的 sealed query（同一组查询、同一 userId）。 */
  const fetchSealed = useCallback(async (): Promise<SealedWorkspaceQueries> => {
    const response = await fetch("/api/realtime/workspace", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`获取 sealed query 失败（HTTP ${response.status}）`);
    }
    const payload = (await response.json()) as SealedWorkspaceQueries;
    if (!payload?.applications || !payload?.notifications || !payload?.jobs) {
      throw new Error("sealed query 响应格式不正确");
    }
    return payload;
  }, []);

  // 只订阅一次（userId 变化由外层 key 重建）；setState 都发生在异步回调里。
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    fetchSealed().then(
      (next) => {
        if (!cancelled) setSealed(next);
      },
      (cause: unknown) => {
        if (cancelled) return;
        const failure = cause instanceof Error ? cause : new Error(String(cause));
        setFetchError(failure);
        setStatus("error");
        setError(failure);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [userId, fetchSealed]);

  /** 手动续签：重新 seal 后替换 sealed 集合（同一查询，fingerprint 不变）。 */
  const renew = useCallback(() => {
    if (!userId) return;
    fetchSealed().then(
      (next) => {
        setSealed(next);
        setStatus((current) => (current === "error" ? "connecting" : current));
      },
      (cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus("error");
      },
    );
  }, [userId, fetchSealed]);

  /** 变更批次 → 防抖调用 onServerRefresh()。 */
  const scheduleServerRefresh = useCallback(() => {
    setLastChangeAt(Date.now());
    if (!onServerRefresh) return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void Promise.resolve(onServerRefresh()).catch((cause: unknown) => {
        console.error("[realtime] onServerRefresh failed", cause);
      });
    }, 200);
  }, [onServerRefresh]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  // 降级：平台侧 Realtime 公网入口不可用（例如 ALB 403）时，WebSocket 会一直
  // 停在 connecting/error。这里在 10s 后启动 20s 一次的服务端轮询刷新，
  // 保证其他端/后台写入仍能反映到 UI；连接恢复为 connected 时自动停止。
  useEffect(() => {
    if (!userId || !onServerRefresh || status === "connected") return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        void Promise.resolve(onServerRefresh()).catch(() => undefined);
      }, 20_000);
    }, 10_000);
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [userId, onServerRefresh, status]);

  const handleSnapshot = useCallback(
    (next: {
      status: LiveWorkspaceStatus;
      data?: LiveWorkspaceData;
      error?: Error;
    }) => {
      setStatus(next.status);
      setData(next.data);
      setError(next.error);
    },
    [],
  );

  const value = useMemo<LiveWorkspaceState>(
    () => ({
      status: fetchError ? "error" : status,
      error: fetchError ?? error,
      data,
      lastChangeAt,
      renew,
    }),
    [fetchError, status, error, data, lastChangeAt, renew],
  );

  return (
    <LiveWorkspaceContext.Provider value={value}>
      {sealed && userId ? (
        <WorkspaceSubscriptions
          sealed={sealed}
          onSnapshot={handleSnapshot}
          onServerRefresh={scheduleServerRefresh}
        />
      ) : null}
      {children}
    </LiveWorkspaceContext.Provider>
  );
}

/** 读取实时订阅状态；必须放在 `<RealtimeWorkspaceProvider>` 内。 */
export function useLiveWorkspace(): LiveWorkspaceState {
  const value = useContext(LiveWorkspaceContext);
  if (!value) {
    throw new Error("useLiveWorkspace() 必须在 <RealtimeWorkspaceProvider> 内使用");
  }
  return value;
}

// ---------------------------------------------------------------------------
// 内部订阅组件：三条查询各一个 useLiveQuery，统一上报合并状态与变更事件。
// ---------------------------------------------------------------------------

type SubscriptionsProps = {
  sealed: SealedWorkspaceQueries;
  onSnapshot: (next: {
    status: LiveWorkspaceStatus;
    data?: LiveWorkspaceData;
    error?: Error;
  }) => void;
  onServerRefresh: () => void;
};

function WorkspaceSubscriptions({ sealed, onSnapshot, onServerRefresh }: SubscriptionsProps) {
  // 续签必须是“同一条查询”：这里只重新 seal，不换查询/参数。
  const refreshApplications = useCallback(
    () => fetchRenewed<LiveApplication>("applications"),
    [],
  );
  const refreshNotifications = useCallback(
    () => fetchRenewed<LiveNotification>("notifications"),
    [],
  );
  const refreshJobs = useCallback(() => fetchRenewed<LiveJob>("jobs"), []);

  const apps = useLiveQuery(sealed.applications, { refreshQuery: refreshApplications });
  const notice = useLiveQuery(sealed.notifications, { refreshQuery: refreshNotifications });
  const jobs = useLiveQuery(sealed.jobs, { refreshQuery: refreshJobs });

  // 只对“增量变更批次”触发服务端刷新；首屏 rows 不算变更。
  useEffect(
    () =>
      apps.utils.onUpdate((update) => {
        if (update.type === "changes") onServerRefresh();
      }),
    [apps.utils, onServerRefresh],
  );
  useEffect(
    () =>
      notice.utils.onUpdate((update) => {
        if (update.type === "changes") onServerRefresh();
      }),
    [notice.utils, onServerRefresh],
  );
  useEffect(
    () =>
      jobs.utils.onUpdate((update) => {
        if (update.type === "changes") onServerRefresh();
      }),
    [jobs.utils, onServerRefresh],
  );

  const combinedStatus: LiveWorkspaceStatus = useMemo(() => {
    const statuses = [apps.status, notice.status, jobs.status];
    if (statuses.includes("error")) return "error";
    if (statuses.includes("stale")) return "stale";
    if (statuses.every((s) => s === "live")) return "connected";
    return "connecting";
  }, [apps.status, notice.status, jobs.status]);

  const combinedData = useMemo<LiveWorkspaceData | undefined>(() => {
    if (!apps.data || !notice.data || !jobs.data) return undefined;
    return {
      applications: apps.data,
      notifications: notice.data,
      jobs: jobs.data,
    };
  }, [apps.data, notice.data, jobs.data]);

  const combinedError =
    (apps.error as Error | undefined) ??
    (notice.error as Error | undefined) ??
    (jobs.error as Error | undefined);

  useEffect(() => {
    onSnapshot({ status: combinedStatus, data: combinedData, error: combinedError });
  }, [onSnapshot, combinedStatus, combinedData, combinedError]);

  return null;
}

/** 重新 seal 一组查询并返回其中一条（供 useLiveQuery 的 refreshQuery 使用）。 */
async function fetchRenewed<Row>(key: "applications" | "notifications" | "jobs"): Promise<SealedLiveQuery<Row>> {
  const response = await fetch("/api/realtime/workspace", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`续签 sealed query 失败（HTTP ${response.status}）`);
  }
  const payload = (await response.json()) as SealedWorkspaceQueries;
  return payload[key] as SealedLiveQuery<Row>;
}
