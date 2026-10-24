"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import { ConfirmDialog, IconBtn, Menu } from "@/components/app/ui";
import { NewResumeDialog } from "@/components/app/NewResumeDialog";
import { useWorkspace } from "@/lib/mock/store";
import { authClient } from "@/lib/auth/client";
import {
  daysLeft,
  formatRelative,
  unreadNotifications,
} from "@/lib/mock/compute";

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

type CommandItem = {
  id: string;
  label: string;
  meta?: string;
  group: string;
  icon: IconName;
  run: () => void;
};

function ProductMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.5 4.5h10.2l4.8 4.8v18.2H8.5z"
        fill="#fff"
        stroke="#1a6bd6"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.7 4.5v4.8h4.8"
        stroke="#1a6bd6"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 14h7.6M12.2 18h5.6M12.2 22h4"
        stroke="#c5d0dd"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="25" cy="25" r="3" fill="#e5355b" />
    </svg>
  );
}

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

function SidebarFoot({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const router = useRouter();
  const { state, resetDemo, exportData, toast } = useWorkspace();
  const [resetOpen, setResetOpen] = useState(false);
  const left = daysLeft(state.plan.expiresAt);
  const remainingRatio = Math.max(0, Math.min(100, Math.round((left / 30) * 100)));

  return (
    <div className="app-sidebar-foot">
      <div className="plan-card">
        <div className="plan-card-top">
          <span className="plan-name">{state.plan.name}</span>
          <span className="plan-days">剩 {left} 天</span>
        </div>
        <div className="progress plan-meter">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${remainingRatio}%` }}
            />
          </div>
        </div>
        <div className="t-11 t-muted" style={{ marginBottom: 8 }}>
          本月 AI 改写 {state.plan.usage.aiRewrites} 次 · 导出 {state.plan.usage.exports} 次
        </div>
        <button type="button" className="plan-link" onClick={onOpenSettings}>
          续购通行证 <Icon name="chevronRight" size={12} />
        </button>
      </div>

      <Menu
        align="left"
        trigger={
          <button type="button" className="user-row" aria-label="账户菜单">
            <span className="avatar">{state.user.name.slice(0, 1)}</span>
            <span className="user-row-text">
              <span className="user-row-name">{state.user.name}</span>
              <span className="user-row-mail">{state.user.email}</span>
            </span>
            <Icon name="chevronDown" size={14} className="nav-icon" />
          </button>
        }
        items={[
          {
            label: "账号设置",
            icon: "settings",
            onSelect: onOpenSettings,
          },
          { label: "导出我的数据", icon: "download", onSelect: exportData },
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
          {
            label: "重置演示数据",
            icon: "refresh",
            danger: true,
            onSelect: () => setResetOpen(true),
          },
        ]}
      />

      <p className="demo-note">已连接 Neon · 数据实时同步</p>

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
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, markAllNotificationsRead, markNotificationRead } = useWorkspace();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkQuery, setCmdkQuery] = useState("");
  const [cmdkIndex, setCmdkIndex] = useState(0);
  const [newResumeOpen, setNewResumeOpen] = useState(false);

  const cmdkInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-brand" aria-label="简历编辑器工作台">
          <span className="app-brand-mark">
            <ProductMark />
          </span>
          <span className="app-brand-text">
            <span className="app-brand-name" style={{ display: "block" }}>
              简历编辑器
            </span>
            <span className="app-brand-sub">AI 求职工作台</span>
          </span>
        </Link>

        <div className="app-scope">
          <Icon name="briefcase" size={14} />
          <strong>{state.user.name}的求职工作台</strong>
        </div>

        <NavLinks pathname={pathname} />
        <SidebarFoot onOpenSettings={() => router.push("/dashboard/settings")} />
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

            <Menu
              align="right"
              trigger={
                <button type="button" className="btn-icon" aria-label="账户菜单">
                  <span className="avatar avatar-sm">
                    {state.user.name.slice(0, 1)}
                  </span>
                </button>
              }
              items={[
                {
                  label: "账号设置",
                  icon: "settings",
                  onSelect: () => router.push("/dashboard/settings"),
                },
                {
                  label: "套餐与用量",
                  icon: "chart",
                  onSelect: () => router.push("/dashboard/settings"),
                },
                {
                  label: "返回官网",
                  icon: "external",
                  onSelect: () => {
                    router.push("/");
                  },
                },
              ]}
            />
          </div>
        </header>

        <main className="app-sheet">
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
                  <ProductMark size={26} />
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
              <div className="plan-card" style={{ marginBottom: 12 }}>
                <div className="plan-card-top">
                  <span className="plan-name">{state.plan.name}</span>
                  <span className="plan-days">
                    剩 {daysLeft(state.plan.expiresAt)} 天
                  </span>
                </div>
                <div className="t-11 t-muted" style={{ marginTop: 6 }}>
                  本月 AI 改写 {state.plan.usage.aiRewrites} 次 · 导出{" "}
                  {state.plan.usage.exports} 次
                </div>
                <button
                  type="button"
                  className="plan-link"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/dashboard/settings");
                  }}
                >
                  续购通行证 <Icon name="chevronRight" size={12} />
                </button>
              </div>
              <div className="user-row" style={{ cursor: "default" }}>
                <span className="avatar">{state.user.name.slice(0, 1)}</span>
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
                  void (async () => {
                    await authClient.signOut();
                    router.replace("/sign-in");
                    router.refresh();
                  })();
                }}
              >
                退出登录 <Icon name="arrowRight" size={12} />
              </button>
              <p className="demo-note" style={{ marginTop: 8 }}>
                已连接 Neon · 数据实时同步
              </p>
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
