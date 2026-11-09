"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import { ConfirmDialog, IconBtn, Menu, type MenuItem } from "@/components/app/ui";
import { NewResumeDialog } from "@/components/app/NewResumeDialog";
import { CreditIsland } from "@/components/app/CreditIsland";
import { UserAvatar } from "@/components/app/UserAvatar";
import { BrandMark } from "@/components/brand/BrandMark";
import { useWorkspace } from "@/lib/mock/store";
import { authClient } from "@/lib/auth/client";
import {
  applicationCounts,
  formatRelative,
  unreadNotifications,
} from "@/lib/mock/compute";
import { readJsonPref, writeJsonPref } from "@/lib/ui/prefs";
import { THEMES, useTheme } from "@/components/theme/ThemeProvider";
import "@/components/credits/credits.css";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "工作台", icon: "home" },
  { href: "/dashboard/resumes", label: "简历库", icon: "file" },
  { href: "/dashboard/jobs", label: "目标岗位", icon: "target" },
  { href: "/dashboard/applications", label: "投递追踪", icon: "send" },
];

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "工作台",
  "/dashboard/resumes": "简历库",
  "/dashboard/jobs": "目标岗位",
  "/dashboard/applications": "投递追踪",
  "/dashboard/settings": "设置",
};

const PREF_EVENT = "app:prefchange";

/** localStorage 偏好的外部订阅（同标签页用自定义事件，跨标签页用 storage 事件）。 */
function subscribePrefChange(onChange: () => void) {
  window.addEventListener(PREF_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREF_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type CommandItem = {
  id: string;
  label: string;
  meta?: string;
  group: string;
  icon: IconName;
  run: () => void;
};

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="app-nav" aria-label="主导航">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item${isActive(item.href) ? " is-active" : ""}`}
          aria-current={isActive(item.href) ? "page" : undefined}
          aria-label={item.label}
          title={item.label}
          onClick={onNavigate}
        >
          <Icon name={item.icon} size={16} className="nav-icon" />
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="nav-label" style={{ marginTop: 18 }}>
        账户
      </div>
      <Link
        href="/dashboard/settings"
        className={`nav-item${pathname === "/dashboard/settings" ? " is-active" : ""}`}
        aria-current={pathname === "/dashboard/settings" ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon name="settings" size={16} className="nav-icon" />
        <span>设置</span>
      </Link>
    </nav>
  );
}

/** 侧栏中部：最近编辑 + 本周进度，填满侧栏空白，避免出现大片空区。 */
function SidebarRecents() {
  const { state } = useWorkspace();
  const counts = applicationCounts(state.applications);
  const recent = [...state.resumes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="sidebar-mid">
      <div className="sidebar-section-head">
        <span>最近编辑</span>
        <Link href="/dashboard/resumes" className="sidebar-section-link">
          全部
        </Link>
      </div>
      <ul className="sidebar-recent-list">
        {recent.map((resume) => {
          const job = state.jobs.find((item) => item.id === resume.targetJobId);
          return (
            <li key={resume.id}>
              <Link href={`/editor?id=${resume.id}`} className="sidebar-recent">
                <span className="sidebar-recent-title">{resume.title}</span>
                <span className="sidebar-recent-sub">
                  {job ? `${job.company} · ${job.title}` : "未设目标岗位"}
                </span>
              </Link>
            </li>
          );
        })}
        {recent.length === 0 ? (
          <li className="sidebar-recent-empty">还没有简历</li>
        ) : null}
      </ul>

      <div className="sidebar-week" aria-label="本周求职进度">
        本周 <strong className="num">{counts.thisWeek}</strong> 次投递 ·{" "}
        <strong className="num">{counts.interview}</strong> 场面试 ·{" "}
        <strong className="num">{counts.offer}</strong> 个 Offer
      </div>
    </div>
  );
}

/** 顶栏右上角账户菜单：账号、条款、导出、主题、退出、重置演示数据。
 *  侧栏不再重复放账户行，账户入口统一收在页面最上方的头像。 */
function AccountMenu() {
  const router = useRouter();
  const { state, resetDemo, exportData, toast } = useWorkspace();
  const { theme, cycleTheme } = useTheme();
  const [resetOpen, setResetOpen] = useState(false);
  // 演示数据重置只在非生产环境提供，生产环境隐藏入口（服务端也会拒绝）。
  const demoEnabled = process.env.NODE_ENV !== "production";
  const nextTheme =
    THEMES[(THEMES.findIndex((item) => item.id === theme) + 1) % THEMES.length];

  return (
    <>
      <Menu
        align="right"
        className="account-menu"
        header={
          <div className="account-menu-head">
            <UserAvatar size="md" />
            <div className="account-menu-identity">
              <strong title={state.user.name}>{state.user.name}</strong>
              <span title={state.user.email}>{state.user.email}</span>
            </div>
          </div>
        }
        trigger={
          <button type="button" className="btn-icon" aria-label="账户菜单">
            <UserAvatar size="sm" />
          </button>
        }
        items={[
          {
            label: "账号设置",
            icon: "settings",
            onSelect: () => router.push("/dashboard/settings"),
          },
          {
            label: "点数与订单",
            icon: "chart",
            onSelect: () => router.push("/dashboard/settings"),
          },
          {
            label: "用户服务条款",
            icon: "help",
            divider: true,
            onSelect: () => router.push("/terms"),
          },
          {
            label: "隐私政策",
            icon: "lock",
            onSelect: () => router.push("/privacy"),
          },
          { label: "导出我的数据", icon: "download", onSelect: exportData },
          {
            label: "切换主题",
            icon: "sparkles",
            hint: `下一套：${nextTheme.name}`,
            divider: true,
            onSelect: cycleTheme,
          },
          {
            label: "退出登录",
            icon: "arrowRight",
            onSelect: () => {
              void (async () => {
                await authClient.signOut();
                router.replace("/sign-in");
                router.refresh();
              })();
            },
          },
          {
            label: "返回官网",
            icon: "external",
            onSelect: () => {
              router.push("/");
            },
          },
          ...(demoEnabled
            ? ([
                {
                  label: "重置演示数据",
                  icon: "refresh",
                  danger: true,
                  divider: true,
                  onSelect: () => setResetOpen(true),
                },
              ] satisfies MenuItem[])
            : []),
        ]}
      />

      {demoEnabled ? (
        <ConfirmDialog
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          title="重置演示数据？"
          description="当前工作台的所有修改会被清除，恢复为最初的示例简历、目标岗位和投递记录。"
          confirmLabel="重置数据"
          onConfirm={() => {
            resetDemo();
            setResetOpen(false);
            toast({ title: "演示数据已重置", tone: "positive" });
          }}
        />
      ) : null}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, markAllNotificationsRead, markNotificationRead } = useWorkspace();

  const [mobileOpen, setMobileOpen] = useState(false);

  // 侧栏收展偏好存 localStorage：用外部 store 订阅，避免 effect 里 setState
  // （服务端/水合快照固定 false，客户端挂载后读真实值）。
  const sidebarCollapsed = useSyncExternalStore(
    subscribePrefChange,
    () => Boolean(readJsonPref<boolean>("shell.sidebar.collapsed.v1", false)),
    () => false,
  );

  function toggleSidebar() {
    writeJsonPref("shell.sidebar.collapsed.v1", !sidebarCollapsed);
    window.dispatchEvent(new Event(PREF_EVENT));
  }
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [cmdkIndex, setCmdkIndex] = useState(0);
  const [newResumeOpen, setNewResumeOpen] = useState(false);

  const cmdkInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const unread = unreadNotifications(state.notifications);
  const pageLabel = PAGE_LABELS[pathname] ?? "工作台";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCmdk();
      }
      if (event.key === "Escape") {
        setCmdkOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // 主面板是独立滚动容器，Next 只管理 window 滚动：路由切换时手动回到顶部。
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  function openCmdk() {
    setCmdkOpen(true);
    setCmdkQuery("");
    setCmdkIndex(0);
    window.setTimeout(() => cmdkInputRef.current?.focus(), 20);
  }

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];
    for (const item of NAV) {
      list.push({
        id: `page-${item.href}`,
        label: item.label,
        group: "页面",
        icon: item.icon,
        run: () => router.push(item.href),
      });
    }
    list.push({
      id: "page-settings",
      label: "设置",
      group: "页面",
      icon: "settings",
      run: () => router.push("/dashboard/settings"),
    });
    for (const resume of state.resumes.slice(0, 4)) {
      const target = state.jobs.find((job) => job.id === resume.targetJobId);
      list.push({
        id: `resume-${resume.id}`,
        label: resume.title,
        meta: target ? `${target.company} · ${target.title}` : "未设目标岗位",
        group: "简历",
        icon: "file",
        run: () => router.push(`/editor?id=${resume.id}`),
      });
    }
    for (const job of state.jobs.slice(0, 3)) {
      list.push({
        id: `job-${job.id}`,
        label: `${job.company} · ${job.title}`,
        meta: `${job.keywords.length} 个关键词`,
        group: "目标岗位",
        icon: "target",
        run: () => router.push("/dashboard/jobs"),
      });
    }
    list.push(
      {
        id: "action-new",
        label: "新建简历",
        meta: "创建并进入编辑器",
        group: "操作",
        icon: "plus",
        run: () => setNewResumeOpen(true),
      },
      {
        id: "action-editor",
        label: "打开编辑器",
        meta: "最近编辑的简历",
        group: "操作",
        icon: "edit",
        run: () => {
          const latest = [...state.resumes].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )[0];
          if (latest) router.push(`/editor?id=${latest.id}`);
        },
      },
    );
    return list;
  }, [router, state.resumes, state.jobs]);

  const filtered = useMemo(() => {
    const query = cmdkQuery.trim().toLowerCase();
    if (!query) return commands.slice(0, 10);
    return commands
      .filter((item) =>
        `${item.label} ${item.meta ?? ""} ${item.group}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 12);
  }, [cmdkQuery, commands]);

  function runCommand(item: CommandItem) {
    setCmdkOpen(false);
    item.run();
  }

  function handleCmdkKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCmdkIndex((index) =>
        filtered.length ? (index + 1) % filtered.length : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCmdkIndex((index) =>
        filtered.length ? (index - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[cmdkIndex];
      if (item) runCommand(item);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      const items = map.get(item.group) ?? [];
      items.push(item);
      map.set(item.group, items);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-brand-row">
        <Link href="/dashboard" className="app-brand" aria-label="简历编辑器工作台">
          <span className="app-brand-mark">
            <BrandMark size={30} variant="duo" />
          </span>
          <span className="app-brand-text">
            <span className="app-brand-name" style={{ display: "block" }}>
              简历编辑器
            </span>
            <span className="app-brand-sub">AI 求职工作台</span>
          </span>
        </Link>
        <IconBtn
          className="app-sidebar-toggle"
          label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          icon="panelLeft"
          size={15}
          onClick={toggleSidebar}
        />
        </div>

        <div className="app-scope">
          <Icon name="briefcase" size={14} />
          <strong>{state.user.name}的求职工作台</strong>
        </div>

        <NavLinks pathname={pathname} />
        <SidebarRecents />
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="btn-icon mobile-menu-btn"
            aria-label="打开导航"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>

          <div className="topbar-left">
            <div className="topbar-crumb">
              {pageLabel === "工作台" ? (
                <strong>工作台</strong>
              ) : (
                <>
                  <Link href="/dashboard" className="crumb-home">
                    工作台
                  </Link>
                  <span className="crumb-sep">/</span>
                  <strong>{pageLabel}</strong>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="topbar-search"
            onClick={openCmdk}
            aria-label="搜索简历、岗位或操作"
          >
            <Icon name="search" size={15} />
            <span className="search-text">搜索简历、岗位或操作</span>
            <span className="kbd">⌘K</span>
          </button>

          <div className="topbar-actions">
            <CreditIsland />
            <div ref={notifRef} className="menu-wrap">
              <span style={{ position: "relative", display: "inline-flex" }}>
                <IconBtn
                  label={`通知${unread ? `（${unread} 条未读）` : ""}`}
                  icon="bell"
                  onClick={() => setNotifOpen((open) => !open)}
                />
                {unread ? <span className="notif-dot" aria-hidden /> : null}
              </span>
              {notifOpen ? (
                <div className="popover topbar-pop">
                  <div className="popover-head">
                    <span>通知</span>
                    <button
                      type="button"
                      className="panel-link"
                      onClick={markAllNotificationsRead}
                    >
                      全部标为已读
                    </button>
                  </div>
                  <div className="popover-list">
                    {state.notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`popover-item${item.read ? "" : " is-unread"}`}
                        style={{
                          width: "100%",
                          border: 0,
                          borderTop: "1px solid var(--ui-rule)",
                          background: item.read
                            ? "transparent"
                            : "var(--ui-accent-soft)",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          markNotificationRead(item.id);
                          setNotifOpen(false);
                          router.push(
                            item.kind === "plan"
                              ? "/dashboard/settings"
                              : item.kind === "application"
                                ? "/dashboard/applications"
                                : "/dashboard/resumes",
                          );
                        }}
                      >
                        <span className="toast-icon">
                          <Icon
                            name={
                              item.kind === "plan"
                                ? "clock"
                                : item.kind === "application"
                                  ? "send"
                                  : "file"
                            }
                            size={15}
                          />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="popover-title" style={{ display: "block" }}>
                            {item.title}
                          </span>
                          <span className="popover-body" style={{ display: "block" }}>
                            {item.body}
                          </span>
                          <span className="popover-time" style={{ display: "block" }}>
                            {formatRelative(item.at)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="popover-foot">
                    通知实时同步自 Neon Postgres
                  </div>
                </div>
              ) : null}
            </div>

            <AccountMenu />
          </div>
        </header>

        <main className="app-sheet" ref={sheetRef}>
          <div className="app-content">{children}</div>
        </main>
      </div>

      {mobileOpen ? (
        <>
          <div
            className="mobile-sheet-backdrop"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="mobile-nav" aria-label="移动导航">
            <div className="mobile-nav-head">
              <Link
                href="/dashboard"
                className="app-brand"
                style={{ marginBottom: 0 }}
                onClick={() => setMobileOpen(false)}
              >
                <span className="app-brand-mark">
                  <BrandMark size={26} variant="duo" />
                </span>
                <span className="app-brand-text">
                  <span className="app-brand-name" style={{ display: "block" }}>
                    简历编辑器
                  </span>
                  <span className="app-brand-sub">AI 求职工作台</span>
                </span>
              </Link>
              <IconBtn
                label="关闭导航"
                icon="close"
                onClick={() => setMobileOpen(false)}
              />
            </div>
            <div className="app-scope">
              <Icon name="briefcase" size={14} />
              <strong>{state.user.name}的求职工作台</strong>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div className="user-row" style={{ cursor: "default" }}>
                <UserAvatar />
                <span className="user-row-text">
                  <span className="user-row-name">{state.user.name}</span>
                  <span className="user-row-mail">{state.user.email}</span>
                </span>
              </div>
              <button
                type="button"
                className="plan-link"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/terms");
                }}
              >
                用户服务条款 <Icon name="arrowRight" size={12} />
              </button>
              <button
                type="button"
                className="plan-link"
                style={{ marginTop: 4 }}
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/privacy");
                }}
              >
                隐私政策 <Icon name="arrowRight" size={12} />
              </button>
              <button
                type="button"
                className="plan-link"
                style={{ marginTop: 8 }}
                onClick={() => {
                  void (async () => {
                    await authClient.signOut();
                    router.replace("/sign-in");
                    router.refresh();
                  })();
                }}
              >
                退出登录 <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {cmdkOpen ? (
        <div
          className="dialog-backdrop cmdk"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCmdkOpen(false);
          }}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="命令面板"
          >
            <div className="cmdk-input">
              <Icon name="search" size={16} />
              <input
                ref={cmdkInputRef}
                value={cmdkQuery}
                onChange={(event) => {
                  setCmdkQuery(event.target.value);
                  setCmdkIndex(0);
                }}
                onKeyDown={handleCmdkKey}
                placeholder="搜索简历、目标岗位或操作…"
                aria-label="搜索"
              />
              <span className="kbd">Esc</span>
            </div>
            <div className="cmdk-body">
              {grouped.length === 0 ? (
                <div className="cmdk-empty">没有找到匹配的内容</div>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group}>
                    <div className="cmdk-group-label">{group}</div>
                    {items.map((item) => {
                      const active = filtered[cmdkIndex]?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`cmdk-item${active ? " is-active" : ""}`}
                          onMouseEnter={() =>
                            setCmdkIndex(filtered.findIndex((x) => x.id === item.id))
                          }
                          onClick={() => runCommand(item)}
                        >
                          <Icon
                            name={item.icon}
                            size={16}
                            className="cmdk-icon"
                          />
                          <span className="truncate">{item.label}</span>
                          {item.meta ? (
                            <span className="cmdk-meta">{item.meta}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="cmdk-foot">
              <span>
                <kbd className="kbd">↑</kbd>
                <kbd className="kbd">↓</kbd> 选择
              </span>
              <span>
                <kbd className="kbd">↵</kbd> 打开
              </span>
              <span style={{ marginLeft: "auto" }}>
                {state.resumes.length} 份简历 · {state.jobs.length} 个目标岗位
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <NewResumeDialog
        open={newResumeOpen}
        onClose={() => setNewResumeOpen(false)}
      />
    </div>
  );
}
