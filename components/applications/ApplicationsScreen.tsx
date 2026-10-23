"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import {
  applicationCounts,
  applicationFunnel,
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekday,
  stageLabel,
  stageTone,
  upcomingInterviews,
} from "@/lib/mock/compute";
import type { Application, ApplicationStage } from "@/lib/mock/types";
import { Btn, ConfirmDialog, EmptyState, IconBtn, Menu, Pill } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import { ApplicationDialog } from "./ApplicationDialog";
import "./applications.css";

const STAGES: ApplicationStage[] = [
  "applied",
  "read",
  "interview",
  "offer",
  "rejected",
];

type StageFilter = "all" | ApplicationStage;

export function ApplicationsScreen() {
  const {
    state,
    resume,
    updateApplication,
    deleteApplication,
    toast,
  } = useWorkspace();

  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Application | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const counts = applicationCounts(state.applications);
  const funnel = applicationFunnel(state.applications);
  const interviews = upcomingInterviews(state.applications);

  const stageCounts = useMemo(() => {
    const map: Record<ApplicationStage, number> = {
      applied: 0,
      read: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    };
    for (const application of state.applications) {
      map[application.stage] += 1;
    }
    return map;
  }, [state.applications]);

  const sorted = useMemo(
    () =>
      [...state.applications].sort(
        (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
      ),
    [state.applications],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return sorted.filter((application) => {
      if (stageFilter !== "all" && application.stage !== stageFilter) {
        return false;
      }
      if (!keyword) return true;
      return `${application.company} ${application.role}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [sorted, stageFilter, query]);

  const screened = funnel[1].value;
  const interviewed = funnel[2].value;
  const offers = funnel[3].value;
  const percent = (value: number) =>
    counts.total ? Math.round((value / counts.total) * 100) : 0;
  const screenedRate = percent(screened);
  const interviewRate = percent(interviewed);
  const offerRate = percent(offers);

  const hasFilter = stageFilter !== "all" || query.trim().length > 0;

  function clearFilters() {
    setStageFilter("all");
    setQuery("");
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(application: Application) {
    setEditTarget(application);
    setFormOpen(true);
  }

  function changeStage(application: Application, stage: ApplicationStage) {
    if (stage === application.stage) return;
    updateApplication(application.id, { stage });
    toast({
      title: `已更新为 ${stageLabel(stage)}`,
      description: `${application.company} · ${application.role}`,
      tone: "positive",
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteApplication(deleteTarget.id);
    toast({
      title: "已删除投递记录",
      description: `${deleteTarget.company} · ${deleteTarget.role}`,
    });
    setDeleteTarget(null);
  }

  function stageMenu(application: Application) {
    return (
      <Menu
        align="right"
        trigger={
          <button
            type="button"
            className="stage-trigger"
            aria-label={`切换「${application.company} · ${application.role}」的阶段`}
          >
            <Pill tone={stageTone(application.stage)}>
              {stageLabel(application.stage)}
            </Pill>
            <Icon name="chevronDown" size={12} className="stage-caret" />
          </button>
        }
        items={STAGES.map((stage) => ({
          label: stageLabel(stage),
          icon: stage === application.stage ? "check" : undefined,
          hint: stage === application.stage ? "当前" : undefined,
          onSelect: () => changeStage(application, stage),
        }))}
      />
    );
  }

  function actionsMenu(application: Application) {
    return (
      <Menu
        align="right"
        trigger={
          <IconBtn
            label={`「${application.company} · ${application.role}」更多操作`}
            icon="more"
            size={16}
          />
        }
        items={[
          {
            label: "编辑",
            icon: "edit",
            onSelect: () => openEdit(application),
          },
          {
            label: "删除",
            icon: "trash",
            danger: true,
            onSelect: () => setDeleteTarget(application),
          },
        ]}
      />
    );
  }

  function resumeLabel(application: Application) {
    const used = resume(application.resumeId);
    if (!used) return <span className="t-faint">未关联简历</span>;
    return (
      <Link className="t-accent" href={`/editor?id=${used.id}`}>
        {used.title}
      </Link>
    );
  }

  const emptyState = (
    <div className="table-empty">
      <div className="empty-title">
        {state.applications.length ? "没有符合条件的投递记录" : "还没有投递记录"}
      </div>
      <div className="empty-desc">
        {state.applications.length
          ? "换一个阶段或关键词试试，或者清除当前筛选。"
          : "记录每一次投递，漏斗和面试提醒会自动更新。"}
      </div>
      <div className="mt-8">
        {state.applications.length ? (
          <Btn size="sm" onClick={clearFilters}>
            清除筛选
          </Btn>
        ) : (
          <Btn size="sm" variant="primary" icon="plus" onClick={openCreate}>
            记录投递
          </Btn>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">投递追踪</h1>
          <p className="page-sub">
            {counts.total} 条记录 · {counts.active} 条进行中 · {counts.interview}{" "}
            场面试待进行
          </p>
        </div>
        <div className="page-actions">
          <Btn variant="primary" icon="plus" onClick={openCreate}>
            记录投递
          </Btn>
        </div>
      </div>

      <div className="grid-12">
        <section className="kpi-strip span-12" aria-label="投递概览">
          <div className="kpi">
            <div className="kpi-label">累计投递</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{counts.total}</span>
              <span className="kpi-unit">条</span>
            </div>
            <div className="kpi-note">本周新增 {counts.thisWeek} 条</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">进入筛选</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{screened}</span>
              <span className="kpi-unit">条</span>
            </div>
            <div className="kpi-note">筛选转化率 {screenedRate}%</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">面试中</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{counts.interview}</span>
              <span className="kpi-unit">场</span>
            </div>
            <div className="kpi-note">已安排 {interviews.length} 场待进行</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Offer</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{counts.offer}</span>
              <span className="kpi-unit">个</span>
            </div>
            <div className="kpi-note">Offer 率 {offerRate}%</div>
          </div>
        </section>

        <section className="panel span-8" aria-labelledby="funnel-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="funnel-title">
                投递漏斗
              </h2>
              <p className="panel-sub">
                从投递到 Offer · 共 {counts.total} 条记录
              </p>
            </div>
          </div>
          <div className="panel-body">
            <div className="funnel apps-funnel">
              {funnel.map((step, index) => (
                <div className="funnel-row" key={step.label}>
                  <span className="funnel-label">{step.label}</span>
                  <span className="funnel-track">
                    <span
                      className={`funnel-fill${
                        index === funnel.length - 1 ? " is-muted" : ""
                      }`}
                      style={{
                        width: `${
                          funnel[0].value
                            ? Math.max(2, (step.value / funnel[0].value) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </span>
                  <span className="funnel-value">{step.value}</span>
                </div>
              ))}
            </div>
            <p className="t-11 t-muted" style={{ marginTop: 14 }}>
              进入筛选 {screenedRate}% · 进入面试 {interviewRate}% · Offer{" "}
              {offerRate}%
            </p>
          </div>
          <div className="panel-foot">
            <span>
              本周新增 {counts.thisWeek} 次投递 · 未通过 {counts.rejected} 条
            </span>
            <Link className="panel-link" href="/dashboard">
              查看工作台 <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </section>

        <section
          className="panel span-4 apps-interviews"
          aria-labelledby="interviews-title"
        >
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="interviews-title">
                近期面试
              </h2>
              <p className="panel-sub">{interviews.length} 场待进行</p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 8, flex: 1 }}>
            {interviews.length ? (
              <div className="list">
                {interviews.map((application) => (
                  <div className="list-row" key={application.id}>
                    <div style={{ flex: "none", width: 58, paddingTop: 1 }}>
                      <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatDate(application.nextAt!, "short")}
                      </div>
                      <div className="t-11 t-muted num">
                        {formatWeekday(application.nextAt!)}{" "}
                        {formatTime(application.nextAt!)}
                      </div>
                    </div>
                    <div className="list-row-main">
                      <div className="list-title">
                        {application.company} · {application.role}
                      </div>
                      <div className="list-sub">
                        {application.nextStep ?? "等待确认轮次"}
                      </div>
                    </div>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(application)}
                    >
                      详情
                    </Btn>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="calendar"
                title="近期没有面试安排"
                description="投递进入面试阶段并填写下一步时间后，会出现在这里。"
              />
            )}
          </div>
          <div className="panel-foot">
            <span>面试时间来自「下一步时间」</span>
            <Link className="panel-link" href="/dashboard">
              回工作台 <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </section>

        <section className="panel span-12" aria-labelledby="records-title">
          <div className="panel-head has-rule apps-panel-head">
            <div>
              <h2 className="panel-title" id="records-title">
                投递记录
              </h2>
              <p className="panel-sub">
                按投递日期倒序 · 共 {state.applications.length} 条
                {hasFilter ? ` · 当前筛选 ${filtered.length} 条` : ""}
              </p>
            </div>
            <div className="panel-head-actions">
              <div className="searchbox">
                <span className="search-icon">
                  <Icon name="search" size={15} />
                </span>
                <input
                  className="input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索公司或岗位"
                  aria-label="搜索公司或岗位"
                />
              </div>
            </div>
          </div>

          <div className="apps-filters">
            <div className="chip-row" aria-label="按阶段筛选">
              <button
                type="button"
                className={`chip${stageFilter === "all" ? " is-active" : ""}`}
                aria-pressed={stageFilter === "all"}
                onClick={() => setStageFilter("all")}
              >
                全部
                <span className="chip-count">{counts.total}</span>
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className={`chip${stageFilter === stage ? " is-active" : ""}`}
                  aria-pressed={stageFilter === stage}
                  onClick={() => setStageFilter(stage)}
                >
                  {stageLabel(stage)}
                  <span className="chip-count">{stageCounts[stage]}</span>
                </button>
              ))}
            </div>
            {hasFilter ? (
              <Btn variant="ghost" size="sm" onClick={clearFilters}>
                清除筛选
              </Btn>
            ) : null}
          </div>

          <div className="apps-table-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">公司 · 岗位</th>
                  <th scope="col">使用简历</th>
                  <th scope="col" className="num">
                    投递日期
                  </th>
                  <th scope="col">阶段</th>
                  <th scope="col">下一步</th>
                  <th scope="col" className="cell-actions">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ height: "auto" }}>
                      {emptyState}
                    </td>
                  </tr>
                ) : (
                  filtered.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <div className="cell-main">{application.role}</div>
                        <div className="cell-sub">{application.company}</div>
                      </td>
                      <td>{resumeLabel(application)}</td>
                      <td className="num" title={formatDate(application.appliedAt, "long")}>
                        {formatDate(application.appliedAt, "short")}
                      </td>
                      <td>{stageMenu(application)}</td>
                      <td>
                        <div>{application.nextStep ?? "—"}</div>
                        {application.nextAt ? (
                          <div
                            className="cell-sub"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {formatDateTime(application.nextAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="cell-actions">{actionsMenu(application)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="apps-mobile-list">
            {filtered.length === 0
              ? emptyState
              : filtered.map((application) => (
                  <div className="apps-mobile-row" key={application.id}>
                    <div className="apps-mobile-main">
                      <div className="apps-mobile-top">
                        <span className="apps-mobile-role">
                          {application.company} · {application.role}
                        </span>
                        {stageMenu(application)}
                      </div>
                      <div className="apps-mobile-meta">
                        <span>{resumeLabel(application)}</span>
                        <span className="num">
                          投递 {formatDate(application.appliedAt, "short")}
                        </span>
                        <span>
                          {application.nextStep ?? "暂无下一步"}
                          {application.nextAt
                            ? ` · ${formatDateTime(application.nextAt)}`
                            : ""}
                        </span>
                      </div>
                    </div>
                    {actionsMenu(application)}
                  </div>
                ))}
          </div>
        </section>
      </div>

      {formOpen ? (
        <ApplicationDialog
          application={editTarget}
          onClose={() => setFormOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="删除这条投递记录？"
        description={
          deleteTarget
            ? `${deleteTarget.company} · ${deleteTarget.role}（投递于 ${formatDate(
                deleteTarget.appliedAt,
                "long",
              )}）。删除后不能恢复，漏斗与 KPI 会同步更新。`
            : undefined
        }
        confirmLabel="删除"
        tone="danger"
      />
    </>
  );
}
