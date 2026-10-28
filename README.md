# AI 简历编辑器（中文 · 点数计费）

面向中国大陆求职者的中文 AI 简历编辑器：**填简历 → 粘贴目标岗位 JD → AI 按点润色/生成 → 导出 A4 PDF → 投递追踪**。

- 技术栈：Next.js 16.4.2（App Router / Cache Components）+ React 19 + Tailwind 4 + TypeScript + Drizzle ORM + Neon Postgres/Auth/Storage + Playwright（PDF）+ DeepSeek（AI）。
- 产品事实与实施计划：[`plan.md`](plan.md)
- 视觉与 Hero 资产施工手册：[`docs/hero-visual/00-INDEX.md`](docs/hero-visual/00-INDEX.md)

## 计费模型（2026-10 重构）

旧「30 天通行证 ¥19 / 不限次数」已下线，改为**AI 点数**：

| 能力 | 点数 |
|---|---|
| 整份简历 AI 生成 / 整份润色 | 2 |
| 项目/工作经历单段润色 | 1 |
| 技能栏整理 | 1 |
| 自我评价润色 | 1 |
| 对照 JD 改写单段 | 1 |
| PDF 导出 | 0（免费、不限次） |

- **每日免费 5 点**（北京时间 0 点重置，不累积）；先扣免费，再扣购买余额。
- **套餐**：体验包 ¥9.9 / 12 点 · 求职包 ¥29.9 / 45 点 · 冲刺包 ¥69 / 120 点；一次性购买，不自动续费。
- 定价与利润测算：[`docs/pricing/README.md`](docs/pricing/README.md)
- 点数系统实现说明：[`docs/credits/README.md`](docs/credits/README.md)

## 登录方式（2026-10 起）

- **邮箱验证码登录（默认）**：输入任意邮箱 → 收 6 位验证码 → 登录；未注册邮箱自动创建账号。
- **邮箱 + 密码登录**：保留为备选 Tab，兼容已有账号。
- 认证与验证码由 **Neon Auth（Managed Better Auth）** 托管，用户/会话存于 Neon Postgres 的
  `neon_auth` schema；应用侧不保存明文密码或验证码。
- 发件已在 Neon 配置**自定义 SMTP**（QQ 邮箱 / Foxmail 别名），步骤与隐私边界见
  [`docs/auth/README.md`](docs/auth/README.md)。

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入 Neon DATABASE_URL / Neon Auth / Storage
npm run db:migrate           # 应用 drizzle/migrations
npm run dev                  # http://localhost:3000
```

- AI：`DEEPSEEK_API_KEY` **可以先留空**，编辑器会提示「DeepSeek API 尚未配置」且**不会扣点**；配置后即时生效（重启 dev）。
- 本地联调 AI 成功路径：`AI_MOCK=1 npm run dev`（不联网、返回示例，但仍按点扣费）。
- 支付：开发环境默认 `PAY_PROVIDER=manual`（沙箱，点击购买直接到账、不产生真实扣款）；生产接面包多Pay / 爱发电 / 支付宝微信直连，见 `.env.example` 与 `docs/credits/README.md`。

## 常用命令

```bash
npm run dev          # 开发
npm run build        # 生产构建（必须通过）
npx tsc --noEmit     # 类型检查
npm run db:generate  # 改 schema 后生成迁移
npm run db:migrate   # 应用迁移

# 点数系统验证
npx tsx scripts/verify/credits-selftest.mts          # 核心逻辑自测（真实库，自动清理）
node scripts/verify/credits-e2e.mjs                  # 浏览器 E2E（沙箱支付 + AI_MOCK）
node scripts/pricing/calc.mjs                        # 定价 / 单位经济重算

# 登录（邮箱验证码）验证
node scripts/auth/e2e-otp.mjs                        # HTTP 链路 + 一次性邮箱真实收码
node scripts/auth/e2e-otp-ui.mjs                     # 浏览器点击级 E2E（含截图）
```

## 目录速记

| 路径 | 内容 |
|---|---|
| `app/(product)/` | 工作台 / 编辑器 / 设置（登录后） |
| `lib/credits/` | 点数配置（`catalog.ts`，客户端可读）与服务端核心（`server.ts`） |
| `lib/pay/` | 点数购买、渠道适配、回调幂等入账 |
| `lib/ai/` | DeepSeek 客户端、提示词、解析、Server Actions |
| `lib/skills/` | 12 个岗位族的中文求职技能参考库（可扩展 JSON） |
| `drizzle/` | schema 与迁移 |
| `docs/pricing/`、`docs/credits/` | 定价利润方案 / 点数系统说明 |
