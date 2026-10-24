"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import { applicationCounts, daysLeft, formatDate, formatMoney } from "@/lib/mock/compute";
import { DEMO_NOW } from "@/lib/mock/data";
import type { Preferences, User } from "@/lib/mock/types";
import {
  Btn,
  ConfirmDialog,
  Field,
  Modal,
  Pill,
  Progress,
  Segmented,
  Toggle,
} from "@/components/app/ui";
import { Icon, type IconName } from "@/components/app/icons";
import { deleteAccount } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import "./settings.css";

type ViewId = "profile" | "preferences" | "plan" | "data";

const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "profile", label: "个人资料", icon: "user" },
  { id: "preferences", label: "求职偏好", icon: "sliders" },
  { id: "plan", label: "套餐与用量", icon: "chart" },
  { id: "data", label: "数据与隐私", icon: "lock" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS = ["产品经理", "用户增长", "数据分析", "商业化"];
const CITY_OPTIONS = ["上海", "杭州", "北京", "深圳", "广州", "成都"];
const SALARY_OPTIONS = ["20-30K", "25-40K", "30-50K", "40-60K", "面议"];
const JOB_TYPE_OPTIONS = [
  { value: "全职", label: "全职" },
  { value: "实习", label: "实习" },
];

/* --------------------------------- 个人资料 -------------------------------- */

function ProfilePanel() {
  const { state, updateUser, toast } = useWorkspace();
  const fieldId = useId();
  const [form, setForm] = useState<User>({ ...state.user });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function patch<K extends keyof User>(key: K, value: User[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === "name" || key === "email") {
      setErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  }

  function save() {
    const nextErrors: { name?: string; email?: string } = {};
    if (!form.name.trim()) nextErrors.name = "请填写姓名";
    if (!form.email.trim()) nextErrors.email = "请填写邮箱";
    else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = "邮箱格式不正确，例如 linxiao@example.com";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    updateUser({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      targetRole: form.targetRole.trim(),
    });
    setErrors({});
    toast({ title: "已保存", description: "个人资料已更新。", tone: "positive" });
  }

  const filled = [form.name, form.email, form.phone, form.city, form.targetRole].filter(
    (value) => value.trim().length > 0,
  ).length;

  return (
    <div className="profile-grid">
      <section className="panel" aria-labelledby="profile-title">
      <div className="panel-head has-rule">
        <div>
          <h2 className="panel-title" id="profile-title">
            个人资料
          </h2>
          <p className="panel-sub">姓名与联系方式会出现在简历页眉与导出文件里。</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="form-grid">
          <Field
            label="姓名"
            required
            htmlFor={`${fieldId}-name`}
            error={errors.name}
          >
            <input
              id={`${fieldId}-name`}
              className="input"
              value={form.name}
              onChange={(event) => patch("name", event.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field
            label="邮箱"
            required
            htmlFor={`${fieldId}-email`}
            error={errors.email}
            hint="用于投递记录与面试提醒"
          >
            <input
              id={`${fieldId}-email`}
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => patch("email", event.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="手机" htmlFor={`${fieldId}-phone`}>
            <input
              id={`${fieldId}-phone`}
              className="input"
              value={form.phone}
              onChange={(event) => patch("phone", event.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field label="城市" htmlFor={`${fieldId}-city`}>
            <input
              id={`${fieldId}-city`}
              className="input"
              value={form.city}
              onChange={(event) => patch("city", event.target.value)}
              autoComplete="address-level2"
            />
          </Field>
          <Field
            label="目标职位"
            htmlFor={`${fieldId}-role`}
            className="full"
            hint="一句话描述你想找的职位，会用于工作台与偏好匹配"
          >
            <input
              id={`${fieldId}-role`}
              className="input"
              value={form.targetRole}
              onChange={(event) => patch("targetRole", event.target.value)}
            />
          </Field>
        </div>
      </div>
        <div className="panel-foot">
          <span>数据保存在 Neon Postgres</span>
          <Btn variant="primary" onClick={save}>
            保存更改
          </Btn>
        </div>
      </section>

      <aside className="panel profile-preview" aria-label="简历页眉预览">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">简历页眉预览</h2>
            <p className="panel-sub">保存后会同步到你的所有简历</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="profile-preview-head">
            <span className="avatar avatar-lg" aria-hidden="true">
              {form.name.trim().slice(0, 1) || "林"}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="profile-preview-name">
                {form.name.trim() || "未命名"}
              </div>
              <div className="t-12 t-muted">
                {form.targetRole.trim() || "未设置目标职位"}
              </div>
            </div>
          </div>

          <div className="profile-preview-contact">
            <span>
              <Icon name="mail" size={13} /> {form.email.trim() || "未填写邮箱"}
            </span>
            <span>
              <Icon name="phone" size={13} /> {form.phone.trim() || "未填写手机"}
            </span>
            <span>
              <Icon name="pin" size={13} /> {form.city.trim() || "未填写城市"}
            </span>
          </div>

          <div className="profile-preview-rule" aria-hidden="true" />

          <div className="progress">
            <div className="progress-meta">
              <span>资料完整度</span>
              <span className="progress-value">{Math.round((filled / 5) * 100)}%</span>
            </div>
            <Progress value={(filled / 5) * 100} />
          </div>

          <div className="profile-preview-facts">
            <div>
              <span className="t-11 t-muted">简历</span>
              <strong>{state.resumes.length} 份</strong>
            </div>
            <div>
              <span className="t-11 t-muted">目标岗位</span>
              <strong>{state.jobs.length} 个</strong>
            </div>
            <div>
              <span className="t-11 t-muted">投递记录</span>
              <strong>{state.applications.length} 条</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------- 账号概览 -------------------------------- */

function AccountSummary() {
  const { state } = useWorkspace();
  const joinedDays = Math.max(
    1,
    Math.round(
      (DEMO_NOW.getTime() - new Date(state.user.joinedAt).getTime()) / 86400000,
    ),
  );
  const thisWeek = applicationCounts(state.applications).thisWeek;
  const left = daysLeft(state.plan.expiresAt);

  return (
    <section className="panel account-summary" aria-labelledby="account-summary-title">
      <div className="panel-head has-rule">
        <div>
          <h2 className="panel-title" id="account-summary-title">
            账号概览
          </h2>
          <p className="panel-sub">这几个数字会随简历和投递记录实时变化</p>
        </div>
        <span className="t-11 t-faint">{formatDate(state.user.joinedAt)} 加入</span>
      </div>
      <div className="account-summary-grid">
        <div>
          <div className="kpi-label">加入天数</div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 24 }}>
              {joinedDays}
            </span>
            <span className="kpi-unit">天</span>
          </div>
        </div>
        <div>
          <div className="kpi-label">当前套餐</div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 18 }}>
              {state.plan.name}
            </span>
          </div>
          <div className="kpi-note">剩 {left} 天到期</div>
        </div>
        <div>
          <div className="kpi-label">简历</div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 24 }}>
              {state.resumes.length}
            </span>
            <span className="kpi-unit">份</span>
          </div>
        </div>
        <div>
          <div className="kpi-label">本周投递</div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 24 }}>
              {thisWeek}
            </span>
            <span className="kpi-unit">次</span>
          </div>
        </div>
      </div>
      <div className="panel-foot">
        <span>数据保存在 Neon Postgres，按登录账号隔离</span>
        <Link className="panel-link" href="/privacy">
          隐私政策 <Icon name="arrowRight" size={12} />
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------- 求职偏好 -------------------------------- */

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function PreferencesPanel() {
  const { state, updatePreferences, toast } = useWorkspace();
  const [draft, setDraft] = useState<Preferences>({
    ...state.preferences,
    targetRoles: [...state.preferences.targetRoles],
    cities: [...state.preferences.cities],
  });

  function save() {
    updatePreferences({
      targetRoles: draft.targetRoles,
      cities: draft.cities,
      salary: draft.salary,
      jobType: draft.jobType,
      weeklyDigest: draft.weeklyDigest,
      autoKeywordCheck: draft.autoKeywordCheck,
    });
    toast({ title: "已保存", description: "求职偏好已更新。", tone: "positive" });
  }

  return (
    <section className="panel" aria-labelledby="preferences-title">
      <div className="panel-head has-rule">
        <div>
          <h2 className="panel-title" id="preferences-title">
            求职偏好
          </h2>
          <p className="panel-sub">
            用于工作台的岗位推荐与投递提醒，可以随时修改。
          </p>
        </div>
      </div>
      <div className="panel-body">
        <div className="stack-20">
          <Field label="目标岗位" hint="可多选，至少选择一个">
            <div className="chip-row" role="group" aria-label="目标岗位">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`chip${draft.targetRoles.includes(role) ? " is-active" : ""}`}
                  aria-pressed={draft.targetRoles.includes(role)}
                  onClick={() =>
                    setDraft((previous) => ({
                      ...previous,
                      targetRoles: toggleIn(previous.targetRoles, role),
                    }))
                  }
                >
                  {draft.targetRoles.includes(role) ? (
                    <Icon name="check" size={12} />
                  ) : null}
                  {role}
                </button>
              ))}
            </div>
          </Field>

          <Field label="期望城市" hint="可多选，留空表示接受任何城市">
            <div className="chip-row" role="group" aria-label="期望城市">
              {CITY_OPTIONS.map((city) => (
                <button
                  key={city}
                  type="button"
                  className={`chip${draft.cities.includes(city) ? " is-active" : ""}`}
                  aria-pressed={draft.cities.includes(city)}
                  onClick={() =>
                    setDraft((previous) => ({
                      ...previous,
                      cities: toggleIn(previous.cities, city),
                    }))
                  }
                >
                  {draft.cities.includes(city) ? (
                    <Icon name="check" size={12} />
                  ) : null}
                  {city}
                </button>
              ))}
            </div>
          </Field>

          <div className="form-grid">
            <Field label="期望薪资" htmlFor="pref-salary">
              <select
                id="pref-salary"
                className="select"
                value={draft.salary}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    salary: event.target.value,
                  }))
                }
              >
                {SALARY_OPTIONS.map((salary) => (
                  <option key={salary} value={salary}>
                    {salary}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="工作类型">
              <div>
                <Segmented
                  options={JOB_TYPE_OPTIONS}
                  value={draft.jobType}
                  onChange={(value) =>
                    setDraft((previous) => ({ ...previous, jobType: value }))
                  }
                  ariaLabel="工作类型"
                />
              </div>
            </Field>
          </div>

          <div>
            <Toggle
              checked={draft.weeklyDigest}
              onChange={(checked) =>
                setDraft((previous) => ({ ...previous, weeklyDigest: checked }))
              }
              label="每周求职提醒"
              description="每周一汇总新岗位与投递进展，发送到你的邮箱"
            />
            <Toggle
              checked={draft.autoKeywordCheck}
              onChange={(checked) =>
                setDraft((previous) => ({
                  ...previous,
                  autoKeywordCheck: checked,
                }))
              }
              label="自动检查 JD 关键词"
              description="保存目标岗位时自动比对简历关键词，并提示缺失项"
            />
          </div>

          <p className="t-11 t-muted">修改后点击面板底部的「保存更改」生效。</p>
        </div>
      </div>
      <div className="panel-foot">
        <span>偏好只影响提示与推荐，不会自动修改简历</span>
        <Btn variant="primary" onClick={save}>
          保存更改
        </Btn>
      </div>
    </section>
  );
}

/* -------------------------------- 套餐与用量 ------------------------------- */

function PlanPanel() {
  const { state, renewPlan, toast } = useWorkspace();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState<"alipay" | "wechat">("alipay");
  const plan = state.plan;
  const left = daysLeft(plan.expiresAt);
  const price = formatMoney(plan.priceFen);

  function confirmCheckout() {
    renewPlan();
    setCheckoutOpen(false);
    toast({
      title: "已续购（演示）",
      description: "有效期已顺延 30 天，未产生真实扣款。",
      tone: "positive",
    });
  }

  return (
    <>
      <div className="grid-12">
        <section className="panel span-6" aria-labelledby="plan-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="plan-title">
                当前套餐
              </h2>
              <p className="panel-sub">一份通行证，简历与 AI 改写不限量</p>
            </div>
            <Pill tone={left > 0 ? "accent" : "warning"}>
              {left > 0 ? "生效中" : "已到期"}
            </Pill>
          </div>
          <div className="panel-body">
            <div className="row-between">
              <div style={{ fontSize: 18, fontWeight: 650 }}>{plan.name}</div>
              <div className="t-11 t-muted">30 天为一期</div>
            </div>
            <div className="plan-facts">
              <div>
                <div className="plan-fact-label">剩余天数</div>
                <div className="plan-fact-value">{left} 天</div>
              </div>
              <div>
                <div className="plan-fact-label">到期日</div>
                <div className="plan-fact-value">
                  {formatDate(plan.expiresAt, "long")}
                </div>
              </div>
              <div>
                <div className="plan-fact-label">自动续费</div>
                <div className="plan-fact-value">
                  {plan.autoRenew ? "已开启" : "不自动续费"}
                </div>
              </div>
              <div>
                <div className="plan-fact-label">价格</div>
                <div className="plan-fact-value">{price} / 30 天</div>
              </div>
            </div>
          </div>
          <div className="panel-foot">
            <span>到期后降为免费额度，已写内容保留</span>
            <Btn
              variant="primary"
              icon="refresh"
              onClick={() => setCheckoutOpen(true)}
            >
              续购 30 天 · {price}
            </Btn>
          </div>
        </section>

        <section className="panel span-6" aria-labelledby="usage-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="usage-title">
                本月用量
              </h2>
              <p className="panel-sub">通行证内不限量，这里只记录实际次数</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="usage-row">
              <div className="row-between">
                <span className="fw-500">AI 改写</span>
                <span className="t-11 t-muted num">{plan.usage.aiRewrites} 次</span>
              </div>
              <div className="usage-meter">
                <Progress value={100} />
                <span className="t-11 t-muted nowrap">不限</span>
              </div>
            </div>
            <div className="usage-row">
              <div className="row-between">
                <span className="fw-500">PDF 导出</span>
                <span className="t-11 t-muted num">{plan.usage.exports} 次</span>
              </div>
              <div className="usage-meter">
                <Progress value={100} />
                <span className="t-11 t-muted nowrap">不限</span>
              </div>
            </div>
            <div className="usage-row">
              <div className="row-between">
                <span className="fw-500">简历数量</span>
                <span className="t-11 t-muted num">{state.resumes.length} 份</span>
              </div>
              <div className="usage-meter">
                <Progress value={100} />
                <span className="t-11 t-muted nowrap">不限</span>
              </div>
            </div>
          </div>
          <div className="panel-foot">
            <span>用量统计来自 Neon 数据库</span>
          </div>
        </section>

        <section className="panel span-12" aria-labelledby="orders-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="orders-title">
                订单记录
              </h2>
              <p className="panel-sub">演示环境订单，不会真实扣款</p>
            </div>
          </div>
          <div className="panel-body flush">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">日期</th>
                  <th scope="col">项目</th>
                  <th scope="col" className="num">
                    金额
                  </th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {plan.orders.map((order) => (
                  <tr key={order.id}>
                    <td title={formatDate(order.at, "long")}>
                      {formatDate(order.at, "short")}
                    </td>
                    <td>{order.label}</td>
                    <td className="num">{formatMoney(order.amountFen)}</td>
                    <td>
                      <Pill tone="positive">
                        {order.status === "paid" ? "已支付" : order.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="续购 30 天通行证"
        description="演示结算，仅用于展示购买流程。"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCheckoutOpen(false)}>
              取消
            </Btn>
            <Btn variant="primary" onClick={confirmCheckout}>
              确认支付 {price}
            </Btn>
          </>
        }
      >
        <div className="stack-20">
          <div className="summary">
            <div className="summary-row">
              <span>30 天通行证 × 1</span>
              <span className="num">{price}</span>
            </div>
            <div className="summary-row">
              <span>优惠</span>
              <span className="num">¥0.00</span>
            </div>
            <div className="summary-row summary-total">
              <span>合计</span>
              <span className="num">{price}</span>
            </div>
          </div>

          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>
              支付方式
            </div>
            <div className="pay-options" role="radiogroup" aria-label="支付方式">
              {(
                [
                  { value: "alipay", label: "支付宝" },
                  { value: "wechat", label: "微信支付" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`pay-option${method === option.value ? " is-active" : ""}`}
                >
                  <input
                    type="radio"
                    name="pay-method"
                    value={option.value}
                    checked={method === option.value}
                    onChange={() => setMethod(option.value)}
                  />
                  <span>{option.label}</span>
                  {method === option.value ? (
                    <Icon
                      name="check"
                      size={14}
                      className="pay-check"
                    />
                  ) : null}
                </label>
              ))}
            </div>
          </div>

          <p className="t-11 t-muted">
            演示环境不会真实扣款。确认后有效期在现有到期日基础上顺延 30 天。
          </p>
        </div>
      </Modal>
    </>
  );
}

/* -------------------------------- 数据与隐私 ------------------------------- */

function DataPanel() {
  const { exportData, resetDemo, toast } = useWorkspace();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleReset() {
    resetDemo();
    setResetOpen(false);
    toast({
      title: "演示数据已重置",
      description: "已恢复最初的示例简历、目标岗位与投递记录。",
      tone: "positive",
    });
  }

  const router = useRouter();

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        toast({
          title: "注销失败",
          description: result.message ?? "请稍后重试",
          tone: "negative",
        });
        return;
      }
      setDeleteOpen(false);
      await authClient.signOut().catch(() => undefined);
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast({
        title: "注销失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        tone: "negative",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="settings-view-stack">
        <section className="panel" aria-labelledby="data-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="data-title">
                数据与隐私
              </h2>
              <p className="panel-sub">
                所有数据保存在 Neon Postgres，按登录账号隔离。
              </p>
            </div>
          </div>
          <div className="panel-body">
            <div className="settings-row">
              <div>
                <div className="settings-row-title">导出我的数据</div>
                <div className="settings-row-desc">
                  下载包含简历、目标岗位、投递记录、通知与偏好的 JSON 文件。
                </div>
              </div>
              <div className="settings-row-action">
                <Btn variant="secondary" icon="download" onClick={exportData}>
                  导出 JSON
                </Btn>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-title">重置演示数据</div>
                <div className="settings-row-desc">
                  清除本机的所有修改，恢复最初的示例数据（会先二次确认）。
                </div>
              </div>
              <div className="settings-row-action">
                <Btn
                  variant="secondary"
                  icon="refresh"
                  onClick={() => setResetOpen(true)}
                >
                  重置数据
                </Btn>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-title">隐私政策</div>
                <div className="settings-row-desc">
                  了解数据收集范围、存储位置与保存期限。
                </div>
              </div>
              <div className="settings-row-action">
                <Link className="panel-link" href="/privacy">
                  查看隐私政策 <Icon name="arrowRight" size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          className="panel danger-panel"
          aria-labelledby="danger-title"
        >
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="danger-title">
                危险区
              </h2>
              <p className="panel-sub">以下操作不可撤销，请谨慎处理。</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="settings-row">
              <div>
                <div className="settings-row-title t-negative">注销账号</div>
                <div className="settings-row-desc">
                  注销会删除 Neon Auth 账号、简历、投递记录与偏好，操作不可恢复；
                  该邮箱之后可以重新注册。
                </div>
              </div>
              <div className="settings-row-action">
                <Btn variant="danger" onClick={() => setDeleteOpen(true)}>
                  注销账号
                </Btn>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title="重置演示数据？"
        description="当前工作台的所有修改会被清除，恢复为最初的示例简历、目标岗位和投递记录。"
        confirmLabel="重置数据"
        tone="danger"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        title="注销账号并删除全部数据？"
        description="将删除 Neon Auth 账号与所有应用数据（简历、岗位、投递、通知、偏好），并返回官网首页。此操作不可恢复。"
        confirmLabel="确认注销"
        tone="danger"
      />
    </>
  );
}

/* ---------------------------------- 页面 --------------------------------- */

export function SettingsScreen() {
  const [view, setView] = useState<ViewId>("profile");

  return (
    <>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">设置</h1>
          <p className="page-sub">账号、求职偏好与套餐</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分区">
          {VIEWS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item${active ? " is-active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon name={item.icon} size={16} className="nav-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ minWidth: 0 }}>
          {view === "profile" ? (
            <div className="settings-view-stack">
              <ProfilePanel />
              <AccountSummary />
            </div>
          ) : null}
          {view === "preferences" ? <PreferencesPanel /> : null}
          {view === "plan" ? <PlanPanel /> : null}
          {view === "data" ? <DataPanel /> : null}
        </div>
      </div>
    </>
  );
}
