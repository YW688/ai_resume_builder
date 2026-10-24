# AI 点数（额度点）计费系统 —— 实现说明

> 2026-10 重构：旧的「30 天通行证（¥19，不限次数）」已下线，改为**按点计费 + 每日免费额度 + 一次性点数套餐（不自动续费）**。
> 产品定价与利润测算见 [`docs/pricing/README.md`](../pricing/README.md)；本文件只讲工程实现。

## 1. 计费规则（唯一事实源）

所有数字只写在 [`lib/credits/catalog.ts`](../../lib/credits/catalog.ts)，客户端/服务端/文档/定价脚本共用：

| 能力 | 点数 | feature key |
|---|---|---|
| 整份简历 AI 生成 / 整份润色 | **2** | `resume_generate` |
| 项目/工作经历单段润色 | 1 | `experience_polish` |
| 技能栏整理 / 关键词补充 | 1 | `skills_polish` |
| 自我评价 / 求职总结润色 | 1 | `summary_polish` |
| 对照 JD 改写单段 | 1 | `jd_rewrite` |
| PDF 导出 | 0（免费、不限次） | `export_pdf` |

- **每日免费额度**：所有用户每天 5 点，按 Asia/Shanghai 自然日 00:00 重置，不累积、不可转赠。
- **扣减顺序**：先扣当日免费额度，不足部分再扣购买的余额。
- **套餐**（一次性购买，不自动续费）：

| 套餐 id | 名称 | 价格 | 点数 | 有效期 |
|---|---|---|---|---|
| `starter` | 体验包 | ¥9.9 | 12 | 90 天 |
| `jobhunt` | 求职包（推荐） | ¥29.9 | 45 | 180 天 |
| `sprint` | 冲刺包 | ¥69 | 120 | 365 天 |

## 2. 数据模型

`users` 新增（`drizzle/schema.ts`）：

| 列 | 说明 |
|---|---|
| `credits_balance` | 购买点数余额（不含每日免费） |
| `credits_expire_at` | 余额统一到期时间；`null` = 无付费余额 |
| `daily_credits_used` | 当日已用免费点数 |
| `daily_credits_date` | 免费额度所属日期（`YYYY-MM-DD`，Asia/Shanghai），惰性重置 |

`orders` 扩展：`package_id`、`credits`、`provider`、`provider_order_id`、`paid_at`，`status` 支持 `pending/paid/refunded/cancelled`。

`credit_ledger`（新表）：`user_id`、`delta`（正获得 / 负消耗）、`balance_after`、`kind`（`purchase/grant/spend/refund/expire`）、`feature`、`ref`、`note`、`created_at`。设置页「点数明细」读取最近 20 条。

迁移：`drizzle/migrations/0002_outgoing_morph.sql`（已应用到开发库，`npm run db:migrate` 可重放）。

## 3. 服务端实现

### 3.1 核心：[`lib/credits/server.ts`](../../lib/credits/server.ts)

- `getCreditsState(userId)`：读状态，顺手做两件惰性维护 —— 跨天重置 `daily_credits_used`；已过期余额清零并写 `expire` 流水。
- `consumeCredits(userId, feature, meta)`：**单条原子 SQL** 完成「过期判断 + 免费额度优先 + 余额扣减 + 日期重置」，余额不足时整笔失败（不会部分扣减）。返回 `{fromDaily, fromBalance, state}`。
  - 为什么不用 `db.transaction`：数据库驱动是 `@neondatabase/serverless`（HTTP），drizzle 事务不可用。
- `grantCredits(userId, {amount, kind, validityDays, ref, note})`：发点 / 购买到账，延长有效期。
- `refundCredits(userId, amount, {fromDaily, fromBalance, ...})`：AI 调用/解析失败时**按原路退回** —— 当天扣的免费额度还回今日已用，购买余额还回余额；跨天退款时免费部分折为余额补偿，避免重复领取每日额度。
- `getCreditLedger(userId, limit)`：流水查询。

### 3.2 AI 扣点：[`lib/ai/actions.ts`](../../lib/ai/actions.ts)

统一流程：`requireUser` → 校验简历归属/JD → **未配置 DeepSeek 时直接报错、不扣点** → `consumeCredits` 预扣 → 调 DeepSeek → 失败/解析失败 `refundCredits` → 写 `ai_rewrites` → `getCreditsState` 回读并随结果返回。返回值全部可序列化。

| Action | 能力 | 点数 |
|---|---|---|
| `generateResumeAction` | 整份生成（摘要+技能+所有经历描述） | 2 |
| `polishProjectAction` | 单段经历润色 | 1 |
| `polishSkillsAction` | 技能栏整理 | 1 |
| `polishSummaryAction` | 自我评价润色 | 1 |
| `rewriteJdAction` | 对照 JD 单段改写 | 1 |

DeepSeek 客户端见 [`lib/ai/client.ts`](../../lib/ai/client.ts)：`DEEPSEEK_API_KEY` 为空或 `sk-placeholder*` 视为未配置；45s 超时；仅网络/5xx 重试一次；`AI_MOCK=1` 为本地演示模式（不联网、仍按点扣费）。

### 3.3 购买与支付：[`lib/pay/index.ts`](../../lib/pay/index.ts)

- `purchaseCreditPackage(userId, packageId)`：建单 + 到账发点 + 开通点数有效期。
- 渠道由 `PAY_PROVIDER` 控制：`manual`（本机沙箱，开发环境默认）/ `mbd`（面包多Pay）/ `afdian`（爱发电）/ `alipay` / `wechat`。
- `createPendingOrder` + `settlePaidOrder`：外部渠道建单与**幂等入账**（`pending → paid` 条件更新，重复回调不会重复发点；金额不一致拒绝入账）。
- 异步回调：`POST /api/webhooks/payment`，`x-pay-signature = HMAC-SHA256(rawBody, PAY_WEBHOOK_SECRET)`。

> **资金合规边界**：只做「建单 → 验签/查单 → 记账 → 发点」，收款与清结算由持牌平台完成，不做二清、不碰资金池。

### 3.4 前端

- `components/credits/CreditIcon.tsx`：额度点图标「星券 Spark Token」（16px 自适配三态配色），独立 SVG 在 `public/icons/`。
- 设置页 `点数与套餐`：余额、每日免费进度、消耗规则、三档套餐购买、订单记录、点数流水。
- 工作台侧栏 / 首页提醒：点数余额 + 今日免费 + 购买入口。
- 编辑器：AI 助手条（整份生成 2 点）、总结/经历/技能 AI 入口（各 1 点）；每次生成前展示消耗与可用点数，额度不足拦截，成功后即时同步余额。
- 落地页 Pricing：免费每日 5 点 + 三档套餐（数字全部来自 catalog）。

## 4. 环境变量

```bash
# DeepSeek（先留空也能跑：AI 入口会提示未配置且不扣点）
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-chat"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
AI_MOCK="0"                      # 1 = 本地演示模式（不联网，仍扣点）

# 支付
PAY_PROVIDER="manual"            # 生产缺省 mbd；manual 仅开发机
PAY_ALLOW_MANUAL="0"             # 生产若用沙箱需显式置 1
PAY_WEBHOOK_SECRET="..."         # 回调验签
MBD_PAY_MERCHANT_ID=""           # 面包多Pay（字段以 doc.mbd.pub 为准）
MBD_PAY_API_KEY=""
MBD_PAY_NOTIFY_URL=""
AFDIAN_USER_ID=""                # 爱发电兜底
AFDIAN_API_TOKEN=""
```

## 5. 验证

```bash
# 1) 类型 + 构建
npx tsc --noEmit
npm run build

# 2) 点数核心自测（真实数据库，跑完自动清理测试用户）
#    纯 Node 下需临时创建 node_modules/server-only 空壳（Next 内部 alias）：
#    mkdir -p node_modules/server-only && echo '{"name":"server-only","main":"index.js"}' > node_modules/server-only/package.json && echo 'module.exports={}' > node_modules/server-only/index.js
npx tsx scripts/verify/credits-selftest.mts

# 3) 浏览器 E2E（注册 → 购买 → AI 扣点 → 每日重置 → 375px）
PAY_PROVIDER=manual PAY_ALLOW_MANUAL=1 AI_MOCK=1 npm run start
node scripts/verify/credits-e2e.mjs
```

自测覆盖（29 项）：初始额度、免费优先扣减、余额不足拒绝、购买发点、跨天重置、退款按原路退回（免费/余额）、流水、沙箱购买、回调幂等。
E2E 覆盖（10 项）：注册、设置页余额、沙箱购买到账、整份生成扣 2 点、技能整理扣 1 点、跨天免费重置、落地页定价、375px 无横向溢出。

## 6. 已知边界 / 后续

1. **退款按原路**已实现；若渠道退款需要回收已消耗点数，需人工按 `credit_ledger` 处理（v1 不自动扣回）。
2. **防薅羊毛限流**（手机验证、IP/设备级日限）未实现，目前仅受「每日 5 点 + 购买余额」约束；上线前按 `docs/pricing/README.md` §10 的限流建议补齐。
3. 旧 `lib/quota.ts`（1 简历 / 2 次 AI / 2 次导出）与 Lemon Squeezy 回调已**废弃**，仅为历史 Server Action 编译保留；新代码不要调用。
4. `subscriptions` 表为旧订阅模型残留，未删除，v1 不再使用。
