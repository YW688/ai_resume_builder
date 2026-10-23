"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/mock/store";
import { DEMO_NOW } from "@/lib/mock/data";
import {
  applicationCounts,
  applicationFunnel,
  computeCompletion,
  computeMatch,
  daysLeft,
  formatRelative,
  formatSchedule,
  mostRecentResume,
  stageLabel,
  stageTone,
  upcomingInterviews,
} from "@/lib/mock/compute";
import { A4Thumb } from "@/components/app/A4Page";
import { NewResumeButton } from "@/components/app/NewResumeDialog";
import { Btn, Pill, Progress } from "@/components/app/ui";
import { Icon, type IconName } from "@/components/app/icons";
import type { ResumeStatus } from "@/lib/mock/types";

const STATUS_META: Record<
  ResumeStatus,
  { label: string; tone: "neutral" | "accent" | "positive" | "outline" }
> = {
  draft: { label: "草稿", tone: "neutral" },
  ready: { label: "可投递", tone: "accent" },
  applied: { label: "已投递", tone: "positive" },
  archived: { label: "已归档", tone: "outline" },
};

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Btn variant="secondary" size="sm" icon={icon} onClick={onClick}>
      {label}
    </Btn>
  );
}

export function OverviewScreen() {
  const router = useRouter();
  const { state, job, updateResume, toast } = useWorkspace();

  const primary = mostRecentResume(state.resumes) ?? state.resumes[0];
  const targetJob = primary?.targetJobId ? job(primary.targetJobId) : undefined;
  const match = primary && targetJob ? computeMatch(primary, targetJob) : null;
  const completion = primary ? computeCompletion(primary) : 0;
  const counts = applicationCounts(state.applications);
  const funnel = applicationFunnel(state.applications);
  const interviews = upcomingInterviews(state.applications).slice(0, 3);
  const recentApps = [...state.applications]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 3);
  const statusMeta = primary ? STATUS_META[primary.status] : null;
  const latestUpdate = primary ? formatRelative(primary.updatedAt) : "—";
  const draftCount = state.resumes.filter((resume) => resume.status === "draft").length;
  const staleApplications = state.applications.filter(
    (application) =>
      (application.stage === "applied" || application.stage === "read") &&
      DEMO_NOW.getTime() - new Date(application.appliedAt).getTime() > 3 * 86400000,
  ).length;

  const weakestResume = [...state.resumes].sort(
    (a, b) => computeCompletion(a) - computeCompletion(b),
  )[0];

  const planDays = daysLeft(state.plan.expiresAt);

  const finding = match && targetJob ? (
    <>
      {targetJob.company} · {targetJob.title} 的 JD 里还有{" "}
      <strong>{match.missing.length} 个关键词</strong>没有写进简历
      {match.missing.length ? `：${match.missing.join("、")}` : ""}。
    </>
  ) : (
    <>还没有设置目标岗位。粘贴一份 JD，就能按关键词检查这份简历还差什么。</>
  );

  function addKeyword(keyword: string) {
    if (!primary) return;
    updateResume(primary.id, {
      skills: Array.from(new Set([...primary.skills, keyword])),
    });
    toast({
      title: `已把「${keyword}」加入技能`,
      description: "匹配度会随简历内容自动重新计算。",
      tone: "positive",
    });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">工作台</h1>
          <p className="page-sub">
            {state.resumes.length} 份简历 · {state.jobs.length} 个目标岗位 · 本周{" "}
            {counts.thisWeek} 次投递
          </p>
          <p className="page-finding">{finding}</p>
        </div>
        <div className="page-actions">
          <span className="freshness">
            <Icon name="clock" size={13} /> 更新于 {latestUpdate}
          </span>
          <NewResumeButton variant="secondary" label="新建简历" />
        </div>
      </div>

      <div className="grid-12">
        {/* 主块：简历体检 */}
        <section className="panel span-8" aria-labelledby="health-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="health-title">
                主推简历 · 简历体检
              </h2>
              <p className="panel-sub">
                {targetJob
                  ? `目标岗位：${targetJob.company} · ${targetJob.title}`
                  : "尚未设置目标岗位"}
              </p>
            </div>
            {statusMeta ? (
              <Pill tone={statusMeta.tone}>{statusMeta.label}</Pill>
            ) : null}
          </div>
          <div className="panel-body">
            <div className="health-grid">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                {primary ? (
                  <>
                    <h3
                      style={{
                        fontSize: 18,
                        lineHeight: 1.35,
                        fontWeight: 650,
                        letterSpacing: "-0.015em",
                      }}
                    >
                      {primary.title}
                    </h3>
                    <p className="t-muted t-12" style={{ marginTop: 3 }}>
                      {primary.fullName} · {primary.city} · 更新于 {formatRelative(primary.updatedAt)}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 28,
                        marginTop: 18,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div className="kpi-label">匹配度</div>
                        <div className="kpi-value-row">
                          <span
                            className="kpi-value t-accent"
                            style={{ fontSize: 34 }}
                          >
                            {match ? match.score : "—"}
                          </span>
                          <span className="kpi-unit">/ 100</span>
                        </div>
                        <div className="kpi-note">
                          {match
                            ? `关键词命中 ${match.hit.length} / ${targetJob?.keywords.length ?? 0}`
                            : "设置目标岗位后计算"}
                        </div>
                      </div>
                      <div style={{ minWidth: 150, flex: 1 }}>
                        <div className="progress-meta" style={{ marginBottom: 6 }}>
                          <span>内容完整度</span>
                          <span className="progress-value">{completion}%</span>
                        </div>
                        <Progress value={completion} />
                        <div className="t-11 t-muted" style={{ marginTop: 6 }}>
                          {completion >= 95 ? "内容基本完整" : "还有字段待补充"}
                        </div>
                      </div>
                    </div>

                    {match && targetJob ? (
                      <div style={{ marginTop: 16 }}>
                        <div className="progress-meta" style={{ marginBottom: 6 }}>
                          <span>JD 关键词覆盖</span>
                          <span className="progress-value">
                            {match.hit.length} / {targetJob.keywords.length}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 3,
                            maxWidth: 420,
                          }}
                          aria-hidden="true"
                        >
                          {targetJob.keywords.map((keyword) => {
                            const hit = match.hit.includes(keyword);
                            return (
                              <span
                                key={keyword}
                                title={keyword}
                                style={{
                                  flex: 1,
                                  height: 8,
                                  borderRadius: 2,
                                  background: hit
                                    ? "var(--ui-accent)"
                                    : "var(--ui-neutral-bg)",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {match && match.missing.length ? (
                      <div style={{ marginTop: 18 }}>
                        <div className="t-11 t-muted" style={{ marginBottom: 7 }}>
                          还没覆盖的关键词（点击加入技能）
                        </div>
                        <div className="chip-row">
                          {match.missing.map((keyword) => (
                            <button
                              key={keyword}
                              type="button"
                              className="kw kw-missing"
                              onClick={() => addKeyword(keyword)}
                              title={`把「${keyword}」加入技能`}
                            >
                              <Icon name="plus" size={12} />
                              {keyword}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="row" style={{ marginTop: "auto", paddingTop: 20 }}>
                      <Btn
                        variant="primary"
                        icon="edit"
                        onClick={() => primary && router.push(`/editor?id=${primary.id}`)}
                      >
                        继续编辑
                      </Btn>
                      <Btn
                        variant="secondary"
                        onClick={() => router.push("/dashboard/jobs")}
                      >
                        查看 JD 对比
                      </Btn>
                      <Btn
                        variant="ghost"
                        iconRight="arrowRight"
                        onClick={() => router.push("/dashboard/resumes")}
                      >
                        全部简历
                      </Btn>
                    </div>
                  </>
                ) : (
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="empty-title">还没有简历</div>
                    <div className="empty-desc">
                      新建一份简历后会在这里显示匹配度和待补关键词。
                    </div>
                    <NewResumeButton />
                  </div>
                )}
              </div>

              {primary ? (
                <div className="health-thumb">
                  <button
                    type="button"
                    onClick={() => router.push(`/editor?id=${primary.id}`)}
                    style={{
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                    }}
                    aria-label={`打开「${primary.title}」编辑器`}
                  >
                    <A4Thumb
                      resume={primary}
                      width={196}
                      highlight={match?.hit}
                    />
                  </button>
                  <span className="t-11 t-faint">A4 · 1 页 · 点击预览</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* 近期安排 */}
        <section className="panel span-4" aria-labelledby="schedule-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="schedule-title">
                近期安排
              </h2>
              <p className="panel-sub">{interviews.length} 场面试待进行</p>
            </div>
            <Link className="panel-link" href="/dashboard/applications">
              全部 <Icon name="chevronRight" size={12} />
            </Link>
          </div>
          <div className="panel-body" style={{ paddingTop: 8, flex: 1 }}>
            {interviews.length ? (
              <div className="list">
                {interviews.map((application) => (
                  <div key={application.id} className="list-row">
                    <div
                      style={{
                        flex: "none",
                        width: 56,
                        paddingTop: 1,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatSchedule(application.nextAt!).split(" ")[0]}
                      </div>
                      <div className="t-11 t-muted">
                        {formatSchedule(application.nextAt!).slice(6)}
                      </div>
                    </div>
                    <div className="list-row-main">
                      <div className="list-title">
                        {application.company} · {application.role}
                      </div>
                      <div className="list-sub">
                        {application.nextStep ?? "等待安排"}
                      </div>
                    </div>
                    <Link
                      className="panel-link"
                      href="/dashboard/applications"
                      style={{ flex: "none", alignSelf: "center" }}
                    >
                      详情
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: "20px 0" }}>
                <div className="empty-title">暂时没有面试安排</div>
                <div className="empty-desc">投递有新进展后，会出现在这里。</div>
              </div>
            )}
            <div className="well" style={{ marginTop: 12 }}>
              <div className="t-11 t-muted" style={{ marginBottom: 4 }}>
                面试准备
              </div>
              <ul
                className="t-12"
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  color: "var(--ui-text)",
                  lineHeight: 1.75,
                }}
              >
                <li>提前 15 分钟测试视频设备</li>
                <li>准备 2 段项目复盘</li>
                <li>准备 3 个反问问题</li>
              </ul>
            </div>
          </div>
          <div className="panel-foot">
            <span>最早一场：{interviews[0] ? formatSchedule(interviews[0].nextAt!) : "待定"}</span>
            <Link className="panel-link" href="/dashboard/applications">
              管理投递 <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </section>

        {/* KPI 条 */}
        <section className="kpi-strip span-12" aria-label="求职概览">
          <div className="kpi">
            <div className="kpi-label">简历</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{state.resumes.length}</span>
              <span className="kpi-unit">份</span>
            </div>
            <div className="kpi-note">
              {draftCount} 份草稿 · {state.resumes.length - draftCount} 份已投递
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">目标岗位</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{state.jobs.length}</span>
              <span className="kpi-unit">个</span>
            </div>
            <div className="kpi-note">已保存并完成关键词分析</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">本周投递</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{counts.thisWeek}</span>
              <span className="kpi-unit">次</span>
            </div>
            <div className="kpi-note">周一至今</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">进行中</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{counts.active}</span>
              <span className="kpi-unit">条</span>
            </div>
            <div className="kpi-note">
              其中面试 {counts.interview} 场 · Offer {counts.offer} 个
            </div>
          </div>
        </section>

        {/* 待办 */}
        <section className="panel span-4" aria-labelledby="todo-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="todo-title">
                待办
              </h2>
              <p className="panel-sub">按影响排序，先处理最影响投递的事</p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 8 }}>
            <div className="list">
              {match && match.missing.length ? (
                <div className="list-row">
                  <span className="toast-icon" style={{ marginTop: 2 }}>
                    <Icon name="target" size={15} />
                  </span>
                  <div className="list-row-main">
                    <div className="list-title">
                      补齐「{targetJob?.company}」缺失的 {match.missing.length} 个关键词
                    </div>
                    <div className="list-sub">{match.missing.join("、")}</div>
                  </div>
                  <div className="list-actions">
                    <QuickAction
                      icon="edit"
                      label="去编辑"
                      onClick={() =>
                        primary && router.push(`/editor?id=${primary.id}`)
                      }
                    />
                  </div>
                </div>
              ) : null}

              {weakestResume ? (
                <div className="list-row">
                  <span className="toast-icon" style={{ marginTop: 2 }}>
                    <Icon name="file" size={15} />
                  </span>
                  <div className="list-row-main">
                    <div className="list-title">
                      「{weakestResume.title}」完成度 {computeCompletion(weakestResume)}%
                    </div>
                    <div className="list-sub">补全经历与技能，能覆盖更多 JD 关键词</div>
                  </div>
                  <div className="list-actions">
                    <QuickAction
                      icon="edit"
                      label="完善"
                      onClick={() => router.push(`/editor?id=${weakestResume.id}`)}
                    />
                  </div>
                </div>
              ) : null}

              {staleApplications > 0 ? (
                <div className="list-row">
                  <span className="toast-icon" style={{ marginTop: 2 }}>
                    <Icon name="send" size={15} />
                  </span>
                  <div className="list-row-main">
                    <div className="list-title">
                      {staleApplications} 条投递超过 3 天没有更新状态
                    </div>
                    <div className="list-sub">确认进展，避免错过面试和补充材料</div>
                  </div>
                  <div className="list-actions">
                    <QuickAction
                      icon="arrowRight"
                      label="去更新"
                      onClick={() => router.push("/dashboard/applications")}
                    />
                  </div>
                </div>
              ) : null}

              <div className="list-row">
                <span className="toast-icon" style={{ marginTop: 2 }}>
                  <Icon name="clock" size={15} />
                </span>
                <div className="list-row-main">
                  <div className="list-title">通行证还有 {planDays} 天到期</div>
                  <div className="list-sub">到期后降为免费额度，已写内容保留</div>
                </div>
                <div className="list-actions">
                  <QuickAction
                    icon="arrowRight"
                    label="查看"
                    onClick={() => router.push("/dashboard/settings")}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 投递进展 */}
        <section className="panel span-8" aria-labelledby="progress-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="progress-title">
                投递进展
              </h2>
              <p className="panel-sub">
                本周新增 {counts.thisWeek} 次 · 共 {counts.total} 条记录
              </p>
            </div>
            <Link className="panel-link" href="/dashboard/applications">
              查看全部投递 <Icon name="arrowRight" size={12} />
            </Link>
          </div>
          <div className="panel-body">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
                gap: 24,
              }}
            >
              <div>
                <div className="t-11 t-muted" style={{ marginBottom: 10 }}>
                  累计转化
                </div>
                <div className="funnel">
                  {funnel.map((step, index) => (
                    <div className="funnel-row" key={step.label}>
                      <span className="funnel-label">{step.label}</span>
                      <span className="funnel-track">
                        <span
                          className={`funnel-fill${index === funnel.length - 1 ? " is-muted" : ""}`}
                          style={{
                            width: `${funnel[0].value ? Math.max(2, (step.value / funnel[0].value) * 100) : 0}%`,
                          }}
                        />
                      </span>
                      <span className="funnel-value">{step.value}</span>
                    </div>
                  ))}
                </div>
                <p className="t-11 t-muted" style={{ marginTop: 12 }}>
                  从投递到面试的转化率{" "}
                  {counts.total
                    ? `${Math.round((counts.interview / counts.total) * 100)}%`
                    : "—"}
                  ，Offer 转化率{" "}
                  {counts.total ? `${Math.round((counts.offer / counts.total) * 100)}%` : "—"}。
                </p>
              </div>

              <div>
                <div className="t-11 t-muted" style={{ marginBottom: 6 }}>
                  最近投递
                </div>
                <div className="list">
                  {recentApps.map((application) => (
                    <div
                      className="list-row"
                      key={application.id}
                      style={{ alignItems: "center", padding: "9px 0" }}
                    >
                      <div className="list-row-main">
                        <div className="list-title">
                          {application.company} · {application.role}
                        </div>
                        <div className="list-sub">
                          {formatRelative(application.appliedAt)}
                        </div>
                      </div>
                      <Pill tone={stageTone(application.stage)}>
                        {stageLabel(application.stage)}
                      </Pill>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="panel-foot">
            <span>
              Offer {counts.offer} 个 · 未通过 {counts.rejected} 条 · 进行中{" "}
              {counts.active} 条
            </span>
            <Link className="panel-link" href="/dashboard/applications">
              更新状态 <Icon name="arrowRight" size={12} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
