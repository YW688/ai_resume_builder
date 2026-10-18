# AI 简历编辑器 v1 — 实施计划文档

> 本文件是项目的完整执行文档：涵盖产品规格、架构、数据模型、已实现进度、剩余工作与验证清单。后续执行（无论是我还是你）以此为准，无需重新访谈或重新推导。

---

## 1. 项目概述

构建一个面向**国内求职者**的**中文 AI 简历编辑器**。核心差异化 = **「针对目标 JD 的关键词 + 量化改写」**。

核心闭环：**填简历 → 粘贴 JD → 逐段 AI 改写 → 导出 PDF → 付费解锁无限**。

> 注：「ATS」是英文求职市场概念，国内平台（BOSS直聘/猎聘）是关键词/硬性条件筛选，所以对外卖点表述为「针对 JD 的关键词+量化改写」，不要只押 "ATS" 一词。

## 2. 技术栈（用户锁定，不可替换）

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | 16.4.2 |
| UI | React / Tailwind | 19.3.0 / 4 |
| 数据库 | Neon（Serverless Postgres） | — |
| ORM | Drizzle + drizzle-kit | 0.45.4 / 0.31.11 |
| 认证 | Clerk | @clerk/nextjs 7.9.17 |
| AI | DeepSeek（OpenAI 兼容） | openai SDK 7.38 |
| 支付 | Lemon Squeezy | — |
| 存储 | Neon Storage（S3 兼容） | @aws-sdk/client-s3 |
| PDF | Playwright（服务端） | 1.64.x |
| 部署 | Cloudways VPS | — |

⚠️ **Next.js 16.4.2 与旧版差异巨大**（`cacheComponents` + `partialPrefetching` 已默认开启，PPR 为默认渲染模型）。写任何代码前先看第 9 节「Next 16 陷阱清单」。

## 3. 产品范围

**v1 包含**：
- 简历编辑器：5 类固定字段（联系方式/总结/经历/教育/技能）+ **照片上传**。
- 粘贴 JD → **逐段 AI 改写**（带「重新生成」），一次性返回（不流式）。
- 一键导出 PDF（服务端 Playwright 渲染，A4 排版 + 照片）。
- 登录（Clerk）+ 付费墙（Lemon Squeezy 订阅 ¥19/月）。
- 账号注销 + 级联删除全部数据（PIPL 合规）。

**v1 不包含**：多套模板、求职信（两者为 v2 方向）、英文/双语简历、性别/年龄/求职意向等额外字段、更多 AI 能力、简历评分/批量投递/团队分享。

**v2 方向（架构预留、不过度设计）**：多套简历模板、求职信 Cover Letter。→ 内容与模板分离；JD→改写逻辑可复用于求职信。

## 4. 核心用户流程

1. **新访客**：落地页 →「开始制作」→ 无需登录进编辑器。
2. **匿名编辑**：填 5 类字段；草稿存 `localStorage`；登录/注册时合并为一个新 Resume 并切到服务端自动保存。
3. **AI 改写**：粘贴 JD → 对每段经历点「AI 改写」→ 一次性返回 → 可「重新生成」→ 覆盖式替换。
4. **导出**：点「导出 PDF」→ 服务端渲染下载；免费用户超 2 次 → 引导升级。
5. **回访用户**：登录后进仪表盘，看简历列表，编辑/导出/删除。

**关键约束**：AI 改写、照片上传、PDF 导出**都要求登录**（防 DeepSeek/存储被匿名滥用）。匿名可填写全部文字字段。

## 5. 数据模型（6 张表，Drizzle / Postgres）

### users（id = Clerk userId）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text PK | Clerk userId |
| email | text | 登录邮箱 |
| plan | text | `free` \| `paid`（webhook 维护） |
| ai_used | int | 已用 AI 次数 |
| export_used | int | 已用导出次数 |
| created_at | timestamptz | |

### resumes
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | defaultRandom |
| user_id | text FK→users (cascade) | |
| title / full_name / phone / email / city / summary | text | |
| skills | text | 换行分隔 |
| photo_key | text | Neon Storage 对象 key |
| created_at / updated_at | timestamptz | |

### experiences / educations
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| resume_id | uuid FK→resumes (cascade) |
| company / title / start_date / end_date / description | text |
| sort_order | int |

（educations：school / degree / major / start_date / end_date + sort_order）

### subscriptions
`id` uuid · `user_id` FK(cascade) · `ls_subscription_id` text unique · `ls_customer_id` text · `status` text · `current_period_end` timestamptz · `created_at`

### ai_rewrites（审计）
`id` · `user_id` · `resume_id` · `experience_id` · `jd_snapshot` · `prompt` · `output` · `model` · `created_at`

**删除行为**：注销账号 → 删照片对象 → 级联删 users（连带 resumes/experiences/educations/ai_rewrites/subscriptions）→ 删 Clerk 用户。

## 6. 路由清单

```
/                               落地页（SEO，static）
/sign-in/[[...sign-in]]         Clerk 登录（包 <Suspense>）
/sign-up/[[...sign-up]]         Clerk 注册（包 <Suspense>）
/editor                         编辑器（client，支持 ?resumeId=xxx 加载指定简历）
/dashboard                      简历列表（受保护，DAL redirect）
/settings                       配额/升级/注销（受保护）
/api/resumes/[resumeId]/pdf     GET → 扣次数 → 返回 PDF 流
/api/webhooks/lemon-squeezy     POST → 验签 → 更新订阅/plan
```

## 7. 关键设计决策

1. **AI/照片/导出要求登录**（编辑可匿名）。理由：DeepSeek 按调用计费、照片占存储，匿名配额可被清 localStorage 绕过。
2. **PDF 用 Playwright 渲染「A4 HTML 模板」**（纯字符串 HTML，非 React 组件）。理由：Next 16 禁止 `react-dom/server`；字符串模板 + Playwright 最稳、字体/照片可控。
3. **匿名草稿存 localStorage，登录时合并**为一个新 Resume。
4. **配额服务端强制**（`consumeAi`/`consumeExport` 用原子 UPDATE + 条件 WHERE，防超发），客户端只展示。
5. **鉴权靠 DAL `verifySession()`，不依赖 middleware/proxy**。所有受保护页面/Server Action/Route Handler 内各自调 `getUserId()`/`requireUser()`。
6. **ORM 用 Drizzle**（`drizzle(sql, { schema })`，Neon HTTP driver）。
7. **免费 = 1 简历/2 次 AI/2 次下载；付费 = ¥19/月**（Lemon Squeezy 订阅）。
8. **AI 一次性返回**（不流式）。

## 8. 分模块实现要点

- **认证**：`<ClerkProvider>` 包根布局；`lib/dal.ts` 的 `getUserId()` 用 `await auth()`；`requireUser()` 未登录 `redirect("/sign-in")`。首次登录在 `users` upsert（`getOrCreateUser`）。⚠️ Clerk v7 的 `auth()` 是 async、`clerkClient()` 返回 Promise。
- **编辑器 + 自动保存**：`app/editor/page.tsx` 是 client 组件；用 `useAuth().isSignedIn` 判断数据源（localStorage vs 服务端 `saveResume`），800ms 防抖。照片走 `uploadPhotoAction(formData)`（校验 jpg/png/webp ≤5MB，上传后换图删旧对象）。
- **AI 改写**：`lib/ai.ts` 调 DeepSeek（`baseURL=https://api.deepseek.com`，model `deepseek-chat`，system prompt 要求量化+关键词+中文）。`rewriteExperienceAction`：`getUserId` → JD 非空 → 预检配额 → 调 DeepSeek → `consumeAi` → 写 `ai_rewrites` 审计 → 返回文本。
- **PDF 导出**：`components/resume/ats-template.ts` 的 `renderAtsHtml(resume)` 返回纯字符串 HTML（含内联 class），`lib/pdf.ts` 包 `<style>` 后 Playwright `page.setContent` + `page.pdf({format:"A4"})` 返回 Buffer。route 里 `new Response(new Uint8Array(pdf), { headers })` 返回。
- **付费墙**：`lib/lemonSqueezy.ts` 的 `createCheckoutUrl`（checkout_data.custom.user_id 传 userId）；webhook `POST` 验签（HMAC-SHA256，header `x-signature`）→ upsert `subscriptions` → `status==="active"` 则 `users.plan="paid"`，否则 `free`。
- **合规注销**：`deleteAccount`：删照片 → 删 DB → `await clerkClient()` 删 Clerk 用户（尽力而为）。

## 9. ⚠️ Next 16 陷阱清单（写代码前必读）

1. `middleware.ts` → **`proxy.ts`**（v16 废弃）；本项目鉴权走 DAL，不依赖 proxy。
2. `params` / `searchParams` / `cookies()` / `headers()` **全 async，必须 `await`**。
3. `fetch` **默认不缓存**；缓存用 `'use cache'` 指令 + `cacheLife()` / `cacheTag()`；`revalidateTag(tag, profile)` **第二参数必填**。
4. 读 `cookies()` / `headers()` 的组件（含 Clerk 的 `<SignIn/>`/`<SignUp/>`、用了 `usePathname()` 的组件）**必须包 `<Suspense>`**，否则 blocking-route 报错。
5. `runtime='edge'` / `preferredRegion` / `dynamic` / `revalidate` / `fetchCache` 已废弃或移除（cacheComponents 开启后）。
6. **禁止 `import 'react-dom/server'`**（`renderToStaticMarkup` 不可用）→ 用纯字符串 HTML 模板。
7. `error.tsx` / `global-error.tsx` 必须 `'use client'`；global-error 需自带 `<html><body>`。
8. Route Handler 仍是 `route.ts` + `GET/POST`，`context.params` 是 Promise；GET 默认动态；返回二进制用 `new Response(uint8Array, {headers})`。
9. Server Actions 仍是 `'use server'`；客户端只能 import 调用；`redirect()` 抛控制流异常。
10. 类型化 props 全局可用：`PageProps<'/editor'>`、`LayoutProps<'/'>`、`RouteContext<'/resumes/[id]'>`。
11. `experimental.serverActions.bodySizeLimit` 默认 1MB，本项目已设为 `"6mb"`（容纳 5MB 照片 + multipart 开销）。

## 10. 环境变量（`.env.local`，模板见 `.env.example`）

```
DATABASE_URL=                             # Neon 连接串
NEON_STORAGE_ENDPOINT / REGION / BUCKET / ACCESS_KEY / SECRET_KEY / PUBLIC_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in    NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/editor
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/editor
DEEPSEEK_API_KEY / DEEPSEEK_MODEL=deepseek-chat / DEEPSEEK_BASE_URL=https://api.deepseek.com
LEMON_SQUEEZY_API_KEY / STORE_ID / WEBHOOK_SECRET / VARIANT_ID
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 11. 本地运行与数据库迁移

```bash
# 1. 填好 .env.local（从 .env.example 复制）
# 2. 建表（生成迁移已存在 drizzle/migrations/，可直接 push）
npx drizzle-kit push          # 或 migrate
# 3. 下载 PDF 用的 Chromium（已在本机下载过，换环境需重跑）
npx playwright install chromium        # Linux VPS 上：--with-deps
# 4. 启动
npm run dev
# 5. 验证
npm run build && npm run lint
```

## 12. 当前进度（截至 2026-10-18）

**已完成**（构建 + lint + 迁移 + Chromium 均通过）：
- 落地页、Clerk 登录/注册、编辑器（匿名草稿合并 + 自动保存 + 照片上传）、逐段 AI 改写 + 配额、服务端 Playwright PDF、仪表盘、设置页、Lemon Squeezy checkout/webhook、注销账号级联删除。
- 文件：`lib/{actions,db,dal,quota,ai,storage,pdf,lemonSqueezy}.ts`、`drizzle/schema.ts`、`app/{page,editor,dashboard,settings,api/*,sign-in,sign-up}`、`components/{editor,resume,dashboard,settings}`。

**未完成**：
- [ ] M0 风险验证（见第 13 节）
- [ ] AI/导出轻量限流（配额已兜底）
- [ ] 关键路径测试（M7）
- [ ] 部署到 Cloudways（M8）

## 13. 剩余工作（按顺序执行）

### M0 — 风险验证（先做，阻塞项）
1. **Lemon Squeezy 是否支持大陆卖家主体**（现为 Stripe 旗下，需验证收款/提现资质；不行换 Paddle 或海外主体）。— 高优先
2. **Cloudways VPS 能否装 Chromium**（`npx playwright install chromium --with-deps`；内存/依赖是否顺畅；不行 PDF 退回 `@react-pdf/renderer`）。
3. **Clerk 与 Next 16 兼容性**（peer 依赖已覆盖 16.4.2，版本层面已确认；若 `protect()`/`redirectToSignIn` 有问题再补 `proxy.ts`）。
4. **DeepSeek 中文 JD 改写质量**（小样本验证「量化改写」是否可靠）。

### M7 — 限流 + 边界 + 测试
- AI/导出接口加每用户轻量限流（如每 5s 1 次），防重复点击/滥用。
- 关键路径测试：认证 → 填简历 → AI 改写（mock DeepSeek）→ 导出（mock Playwright）→ 付费（webhook 验签）→ 注销。
- 边界补强：空态、DeepSeek 超时降级、重复提交幂等、会话过期 redirect。

### M8 — 部署（Cloudways VPS）
- `next.config.ts` 设 `output: "standalone"`（可选）；`npm run build` + `node .next/standalone/server.js` 或 `next start`。
- 前面加 nginx 反代；设生产 env；VPS 装 `fonts-noto-cjk` 中文 + `npx playwright install chromium --with-deps`。
- 单实例无需 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`；多实例需设。

## 14. 验证清单（完成标准）

- [ ] `npm run build` + `npm run lint` 通过。
- [ ] 手动关键路径：落地页 → 匿名填简历 → 照片上传 → 注册（草稿合并）→ 逐段 AI 改写 → 重新生成 → 导出 PDF（计数递减）→ 免费触顶被拦截 → 升级付费 → 无限导出 → 注销账号数据清空。
- [ ] 边界：空态、DeepSeek 超时/限流提示、重复提交、会话过期。

## 15. 风险与待办

1. Lemon Squeezy 大陆卖家资质（M0 最高优先）。
2. Cloudways VPS 跑 Chromium 的资源。
3. 面向国内用户部署海外：ICP 备案 / 延迟 / 数据跨境（PIPL）。
4. DeepSeek 中文 JD 改写质量。
5. Lemon Squeezy webhook 的 `custom.user_id` 字段路径、Neon Storage endpoint、DeepSeek 模型名——当前按通用惯例写，联调时对着官方文档核对。
6. 照片 bucket 当前假设公开读（v1 简化），敏感照片建议后续改预签名 URL。

## 16. 假设（未明确、按默认取的）

邮箱登录、落地页 SEO/编辑器 noindex、照片 ≤5MB jpg/png/webp、桌面优先编辑、Clerk 自带认证邮件（无营销邮件）、无独立监控、技能换行分隔、DeepSeek 模型 ID 实施时查文档、取消订阅立即生效（不做周期末尾宽限）。
