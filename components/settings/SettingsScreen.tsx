"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useWorkspace } from "@/lib/mock/store";
import { applicationCounts, formatDate, formatDateTime } from "@/lib/mock/compute";
import { DEMO_NOW } from "@/lib/mock/data";
import type { Preferences, User } from "@/lib/mock/types";
import {
  CREDIT_COST_ROWS,
  CREDIT_FEATURES,
  CREDIT_PACKAGES,
  DAILY_FREE_RULE_TEXT,
  actionsPerPackage,
  formatPoints,
  formatYuan,
  packageDiscountPercent,
  pointsUnitPriceFen,
  type CreditLedgerEntry,
  type CreditPackage,
} from "@/lib/credits/catalog";
import { getCreditLedgerAction } from "@/lib/workspace/actions";
import { CreditIcon } from "@/components/credits/CreditIcon";
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
import "@/components/credits/credits.css";

type ViewId = "profile" | "preferences" | "plan" | "data";

const VIEWS: { id: ViewId; label: string; icon: IconName }[] = [
  { id: "profile", label: "个人资料", icon: "user" },
  { id: "preferences", label: "求职偏好", icon: "sliders" },
  { id: "plan", label: "点数与套餐", icon: "chart" },
  { id: "data", label: "数据与隐私", icon: "lock" },
];

/** 点数流水类型 → 中文文案。 */
const LEDGER_KIND_LABEL: Record<CreditLedgerEntry["kind"], string> = {
  purchase: "购买点数",
  grant: "赠送点数",
  spend: "消耗点数",
  refund: "点数退回",
  expire: "点数过期",
};

type PurchaseNotice = {
  tone: "success" | "error" | "info";
  text: string;
};

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
  const credits = state.credits;

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
          <div className="kpi-label">点数余额</div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ fontSize: 24 }}>
              {credits.balance}
            </span>
            <span className="kpi-unit">点</span>
          </div>
          <div className="kpi-note">
            今日免费还剩 {credits.dailyRemaining} / {credits.dailyFree} 点
          </div>
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

/* -------------------------------- 点数与套餐 ------------------------------- */

/** 单张套餐卡：设置页网格与购买弹窗共用。 */
function CreditPackageCard({
  pkg,
  purchasing,
  onBuy,
}: {
  pkg: CreditPackage;
  purchasing: boolean;
  onBuy: (packageId: string) => void;
}) {
  const discount = packageDiscountPercent(pkg);
  const perResume = actionsPerPackage(pkg, "resume_generate");

  return (
    <article
      className={`credit-package${pkg.recommended ? " is-recommended" : ""}`}
      aria-label={`${pkg.name}·${formatPoints(pkg.points)}`}
    >
      <div className="credit-package-head">
        <h3 className="credit-package-name">{pkg.name}</h3>
        <Pill tone={pkg.recommended ? "accent" : "outline"}>
          {pkg.badge ?? (discount > 0 ? `省 ${discount}%` : "入门")}
        </Pill>
      </div>

      <div className="credit-package-price-row">
        <span className="credit-package-price">{formatYuan(pkg.priceFen)}</span>
        <span className="credit-package-unit">
          {formatPoints(pkg.points)} · 折合 {formatYuan(pointsUnitPriceFen(pkg))}/点
        </span>
      </div>

      <p className="credit-package-tagline">
        一次性购买 · 不自动续费 · {pkg.validityDays} 天有效
      </p>

      <ul className="credit-package-facts">
        <li>约 {perResume} 份整份简历生成</li>
        <li>按单段润色约 {pkg.points} 次</li>
        {discount > 0 ? (
          <li className="credit-package-save">比体验包单点低 {discount}%</li>
        ) : (
          <li>单点价格基准</li>
        )}
      </ul>

      <div className="credit-package-foot">
        <Btn
          variant={pkg.recommended ? "primary" : "secondary"}
          loading={purchasing}
          disabled={purchasing}
          onClick={() => onBuy(pkg.id)}
        >
          购买 {pkg.name}
        </Btn>
      </div>
    </article>
  );
}

function PlanPanel() {
  const { state, purchaseCredits } = useWorkspace();
  const credits = state.credits;
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);

  // 点数流水是可选增强：失败只在本卡内提示，不影响余额与购买流程。
  useEffect(() => {
    let active = true;
    getCreditLedgerAction()
      .then((rows) => {
        if (active) setLedger(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLedger([]);
        setLedgerError(
          error instanceof Error && error.message
            ? error.message
            : "暂时无法加载点数明细。",
        );
      });
    return () => {
      active = false;
    };
  }, [ledgerVersion]);

  const dailyPct =
    credits.dailyFree > 0 ? (credits.dailyUsed / credits.dailyFree) * 100 : 0;
  const dailyLeft = Math.max(0, credits.dailyRemaining);
  const iconTone =
    credits.balance > 0
      ? ("default" as const)
      : credits.plan === "free"
        ? ("free" as const)
        : ("low" as const);
  const lowBalance = credits.plan === "member" && credits.balance === 0;
  const orders = state.plan.orders;

  async function buy(packageId: string) {
    if (purchasing) return;
    setPurchasing(packageId);
    setNotice(null);
    try {
      const result = await purchaseCredits(packageId);
      if (!result.ok) {
        setNotice({
          tone: "error",
          text: result.message ?? "购买未完成，请稍后重试。",
        });
        return;
      }
      setNotice({
        tone: "info",
        text: result.simulated
          ? "本机沙箱：点数已模拟到账，不产生真实扣款。"
          : "支付成功，点数已到账。",
      });
      setPurchaseOpen(false);
      setLedgerVersion((version) => version + 1);
    } finally {
      setPurchasing(null);
    }
  }

  const noticeBlock = notice ? (
    <div
      className={`credit-notice is-${notice.tone} mt-12`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="credit-notice-icon">
        <Icon
          name={
            notice.tone === "error"
              ? "warning"
              : notice.tone === "success"
                ? "checkCircle"
                : "info"
          }
          size={14}
        />
      </span>
      <span>{notice.text}</span>
    </div>
  ) : null;

  return (
    <>
      <div className="grid-12">
        {/* 余额 + 每日免费额度 */}
        <section className="panel span-12" aria-labelledby="credits-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="credits-title">
                点数余额
              </h2>
              <p className="panel-sub">
                AI 能力按点扣除；PDF 导出免费，不消耗点数。
              </p>
            </div>
            <div className="panel-head-actions">
              <Pill tone={lowBalance ? "warning" : "accent"} dot>
                {lowBalance
                  ? "余额不足"
                  : credits.plan === "member"
                    ? "点数会员"
                    : "每日免费额度"}
              </Pill>
            </div>
          </div>
          <div className="panel-body">
            <div className="credit-balance">
              <div className="credit-balance-main">
                <span className="credit-token-plate">
                  <CreditIcon size={44} tone={iconTone} decorative />
                </span>
                <div className="credit-balance-body">
                  <div className="credit-balance-label">可用点数</div>
                  <div className="credit-balance-value-row">
                    <span className="credit-balance-value num">
                      {credits.balance}
                    </span>
                    <span className="credit-balance-unit">点</span>
                  </div>
                  <div className="credit-balance-meta">
                    {credits.plan === "member" ? (
                      <span>
                        有效期至{" "}
                        {credits.expiresAt ? formatDate(credits.expiresAt) : "—"}
                      </span>
                    ) : (
                      <span>尚未购买点数，先用每日免费额度</span>
                    )}
                    {lowBalance ? (
                      <Pill tone="warning">AI 生成一份简历需要 2 点</Pill>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="credit-balance-actions">
                <Btn
                  variant="primary"
                  icon="plus"
                  onClick={() => setPurchaseOpen(true)}
                >
                  购买点数
                </Btn>
                <span className="t-11 t-muted">
                  一次性购买 · 不自动续费 · 沙箱演示不产生真实扣款
                </span>
              </div>
            </div>

            <div className="credit-daily">
              <div className="credit-daily-head">
                <span className="credit-daily-title">
                  <CreditIcon size={16} tone="free" decorative />
                  今日免费额度
                </span>
                <Pill tone={dailyLeft > 0 ? "positive" : "warning"}>
                  {dailyLeft > 0 ? `还剩 ${dailyLeft} 点` : "今日已用完"}
                </Pill>
                <span className="credit-daily-value num">
                  {credits.dailyUsed} / {credits.dailyFree} 点
                </span>
              </div>
              <Progress value={dailyPct} tone="warning" />
              <p className="credit-daily-foot">
                已用 {credits.dailyUsed} 点，剩余 {credits.dailyRemaining} 点；
                下次重置 {formatDateTime(credits.resetAt)}。
                {DAILY_FREE_RULE_TEXT}。
              </p>
            </div>

            {noticeBlock}
          </div>
          <div className="panel-foot credit-foot">
            <span>
              每次 AI 操作先扣每日免费额度，再扣购买点数；PDF 导出始终免费。
            </span>
            <span className="num">当前余额 {credits.balance} 点</span>
          </div>
        </section>

        {/* 套餐购买 */}
        <section className="panel span-12" aria-labelledby="packages-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="packages-title">
                购买点数
              </h2>
              <p className="panel-sub">
                三档套餐均为一次性购买，不自动续费；点数在套餐有效期内可用。
              </p>
            </div>
          </div>
          <div className="panel-body">
            <div className="credit-packages">
              {CREDIT_PACKAGES.map((pkg) => (
                <CreditPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  purchasing={purchasing !== null}
                  onBuy={buy}
                />
              ))}
            </div>
          </div>
          <div className="panel-foot credit-foot">
            <span>
              点数为一次性购买，不自动续费、不自动扣款；到期未用完的点数会失效。
            </span>
            <span>演示环境付款为沙箱模拟</span>
          </div>
        </section>

        {/* 消耗规则 */}
        <section className="panel span-7" aria-labelledby="cost-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="cost-title">
                点数消耗规则
              </h2>
              <p className="panel-sub">AI 能力按点计费，导出不收费</p>
            </div>
          </div>
          <div className="panel-body">
            <table className="credit-cost-table">
              <caption className="sr-only">
                各类 AI 操作的消耗点数与说明
              </caption>
              <thead>
                <tr>
                  <th scope="col">功能</th>
                  <th scope="col" className="is-right">
                    消耗
                  </th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_COST_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td>
                      <div className="credit-cost-name">{row.label}</div>
                      <div className="credit-cost-desc">{row.description}</div>
                    </td>
                    <td className="is-right">
                      {row.cost === 0 ? (
                        <span className="credit-cost-free">免费</span>
                      ) : (
                        <span className="credit-cost-value">
                          −{row.cost} 点
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <span>{DAILY_FREE_RULE_TEXT}。</span>
          </div>
        </section>

        {/* 点数明细 */}
        <section className="panel span-5" aria-labelledby="ledger-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="ledger-title">
                点数明细
              </h2>
              <p className="panel-sub">最近的获得与消耗记录</p>
            </div>
          </div>
          <div className="panel-body">
            {ledgerError ? (
              <div className="credit-notice is-error" role="alert">
                <span className="credit-notice-icon">
                  <Icon name="warning" size={14} />
                </span>
                <span style={{ flex: 1 }}>
                  {ledgerError}
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLedgerError(null);
                      setLedger(null);
                      setLedgerVersion((version) => version + 1);
                    }}
                  >
                    重试
                  </Btn>
                </span>
              </div>
            ) : ledger === null ? (
              <p className="t-12 t-muted">正在加载点数明细…</p>
            ) : ledger.length === 0 ? (
              <div className="empty" style={{ padding: "16px 0" }}>
                <div className="empty-title">还没有点数记录</div>
                <div className="empty-desc">
                  购买或消耗点数后，会在这里看到每一笔变动。
                </div>
              </div>
            ) : (
              <ul className="credit-ledger">
                {ledger.map((entry) => {
                  const featureLabel = entry.feature
                    ? CREDIT_FEATURES[entry.feature].shortLabel
                    : null;
                  return (
                    <li key={entry.id} className="credit-ledger-row">
                      <div className="credit-ledger-main">
                        <div className="credit-ledger-title">
                          {LEDGER_KIND_LABEL[entry.kind]}
                          {featureLabel ? ` · ${featureLabel}` : ""}
                        </div>
                        <div className="credit-ledger-meta">
                          {entry.note ? `${entry.note} · ` : ""}
                          {formatDateTime(entry.at)} · 余额{" "}
                          {entry.balanceAfter} 点
                        </div>
                      </div>
                      <span
                        className={`credit-ledger-delta${
                          entry.delta > 0 ? " is-plus" : ""
                        }`}
                      >
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="panel-foot credit-foot">
            <span>明细来自服务端点数流水</span>
            <span>最近 20 条</span>
          </div>
        </section>

        {/* 订单记录 */}
        <section className="panel span-12" aria-labelledby="orders-title">
          <div className="panel-head has-rule">
            <div>
              <h2 className="panel-title" id="orders-title">
                订单记录
              </h2>
              <p className="panel-sub">
                点数套餐一次性购买，不自动续费
              </p>
            </div>
          </div>
          <div className="panel-body flush">
            {orders.length === 0 ? (
              <div className="empty" style={{ padding: "20px 20px 24px" }}>
                <div className="empty-title">还没有订单</div>
                <div className="empty-desc">
                  购买点数后会显示在这里，包括金额、到账点数与状态。
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table credit-orders-table">
                  <thead>
                    <tr>
                      <th scope="col">日期</th>
                      <th scope="col">项目</th>
                      <th scope="col" className="num">
                        到账点数
                      </th>
                      <th scope="col" className="num">
                        金额
                      </th>
                      <th scope="col">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td title={formatDateTime(order.at)}>
                          {formatDate(order.at, "short")}
                        </td>
                        <td className="cell-main">{order.label}</td>
                        <td className="num">
                          {typeof order.credits === "number"
                            ? `+${order.credits}`
                            : "—"}
                        </td>
                        <td className="num">{formatYuan(order.amountFen)}</td>
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
            )}
          </div>
          <div className="panel-foot credit-foot">
            <span>点数为一次性购买，不自动续费；演示环境付款为沙箱模拟。</span>
            <span className="num">共 {orders.length} 笔订单</span>
          </div>
        </section>
      </div>

      <Modal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        title="购买点数"
        description="一次性购买，不自动续费；点数在套餐有效期内可用。"
        size="lg"
        footer={
          <>
            <span className="t-11 t-muted">
              演示环境付款为沙箱模拟，不产生真实扣款。
            </span>
            <Btn variant="ghost" onClick={() => setPurchaseOpen(false)}>
              关闭
            </Btn>
          </>
        }
      >
        <div className="stack-16">
          {noticeBlock}
          <div className="credit-packages is-modal">
            {CREDIT_PACKAGES.map((pkg) => (
              <CreditPackageCard
                key={pkg.id}
                pkg={pkg}
                purchasing={purchasing !== null}
                onBuy={buy}
              />
            ))}
          </div>
          <p className="t-11 t-muted" style={{ margin: 0 }}>
            购买后点数立即到账，可在「点数明细」中查看每一笔获得与消耗；到期未用完的点数会失效。
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
          <p className="page-sub">账号、求职偏好与点数</p>
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
          {view === "plan" ? (
            <div className="settings-view-stack">
              <PlanPanel />
            </div>
          ) : null}
          {view === "data" ? <DataPanel /> : null}
        </div>
      </div>
    </>
  );
}
