# AI 简历编辑器 v1 — 实施计划文档

> 本文件是项目的完整执行文档：涵盖产品规格、架构、数据模型、已实现进度、剩余工作与验证清单。后续执行（无论是我还是你）以此为准，无需重新访谈或重新推导。
>
> **本版变更（2026-10-18）**：原方案依赖境外订阅计费、境外托管认证、境外 Serverless Postgres、境外对象存储、境外 VPS，在大陆存在开户、访问、备案、数据出境四类硬性障碍。本版已全部替换为中国大陆可开通、可访问、可备案的方案，并配套《地域依赖替换决策表》（同目录）。所有费率、资质、审核周期结论均标注核实日期（2026-10-18）与官方链接；无法核实的一律写「待核实」，不编数字。替换对照见第 17 节附录。

---

## 1. 项目概述

构建一个面向**国内求职者**的**中文 AI 简历编辑器**。核心差异化 = **「针对目标 JD 的关键词 + 量化改写」**。

核心闭环：**填简历 → 粘贴 JD → 逐段 AI 改写 → 导出 PDF → 付费解锁无限**。

> 注：「ATS」是英文求职市场概念，国内平台（BOSS直聘/猎聘）是关键词/硬性条件筛选，所以对外卖点表述为「针对 JD 的关键词+量化改写」，不要只押 "ATS" 一词。

## 2. 技术栈（除地域性服务外锁定）

| 层 | 技术 | 版本 / 说明 |
|---|---|---|
| 框架 | Next.js (App Router) | 16.4.2 |
| UI | React / Tailwind | 19.3.0 / 4 |
| 数据库 | PostgreSQL 16（阿里云 ECS 同机 Docker；v2 可平迁 RDS PostgreSQL） | — |
| ORM | Drizzle + drizzle-kit | 0.45.4 / 0.31.11 |
| 认证 | Auth.js（next-auth 5.0.0-beta.32，Credentials 邮箱+密码） | 不兼容时降级 next-auth 4.24.15 或 `jose` 自写会话 |
| AI | DeepSeek（OpenAI 兼容） | openai SDK 7.38；模型 ID 见 8 节 |
| 支付 | 面包多Pay（个人主体默认）/ 爱发电（兜底）/ 支付宝电脑网站支付 + 微信 Native（个体户后） | 单次购买 30 天，无自动续费；费率见 17.2 |
| 存储 | 阿里云 OSS（私有读 + 签名 URL） | ali-oss SDK |
| PDF | Playwright（服务端） | 1.64.x |
| 部署 | 阿里云 ECS（Ubuntu 22.04）+ nginx + certbot | 华东1（杭州），数据不出境 |
| 备案 | 阿里云 ICP 备案（个人或个体户主体） | ⚠️ 见 15.1 |

**地域性服务的替换原则**：本表原「用户锁定，不可替换」的绝对表述仅约束框架/UI/ORM/AI/PDF 等无地域属性的技术。支付、认证、数据库托管、对象存储、部署（含域名备案）这 5 项受中国大陆监管与网络条件约束，允许且必须替换为境内方案——这是本版的唯一例外来源。替换清单、资质门槛与成本见第 17 节。

⚠️ **Next.js 16.4.2 与旧版差异巨大**（`cacheComponents` + `partialPrefetching` 已默认开启，PPR 为默认渲染模型）。写任何代码前先看第 9 节「Next 16 陷阱清单」。

## 3. 产品范围

**v1 包含**：
- 简历编辑器：5 类固定字段（联系方式/总结/经历/教育/技能）+ **照片上传**。
- 粘贴 JD → **逐段 AI 改写**（带「重新生成」），一次性返回（不流式）。
- 一键导出 PDF（服务端 Playwright 渲染，A4 排版 + 照片）。
- 登录（自建邮箱+密码）+ 点数付费墙（免费每日 5 点；整份简历 AI 生成 2 点；套餐 ¥9.9/12 点起，一次性购买不自动续费）。
- 账号注销 + 级联删除全部数据（PIPL 合规）。

**v1 不包含**：多套模板、求职信（两者为 v2 方向）、英文/双语简历、性别/年龄/求职意向等额外字段、更多 AI 能力、简历评分/批量投递/团队分享、自动续费扣款（个人与个体户无法签约周期扣款，见 7.3）、短信验证码（见 15.3）、微信扫码登录（需企业主体，v2）。

**v2 方向（架构预留、不过度设计）**：多套简历模板、求职信 Cover Letter、年卡/多次卡、微信扫码登录。→ 内容与模板分离；JD→改写逻辑可复用于求职信。

## 4. 核心用户流程

1. **新访客**：落地页 →「开始制作」→ 无需登录进编辑器。
2. **匿名编辑**：填 5 类字段；草稿存 `localStorage`；登录/注册时合并为一个新 Resume 并切到服务端自动保存。
3. **注册/登录**：邮箱 + 密码（≥8 位），无手机号、无验证码、无第三方 OAuth。
4. **AI 改写**：粘贴 JD → 对每段经历点「AI 改写」→ 一次性返回 → 可「重新生成」→ 覆盖式替换。
5. **导出**：点「导出 PDF」→ 服务端渲染下载；免费用户超 2 次 → 引导升级。
6. **付费**：点「购买点数」→ 服务端建单 → 收银台（支付宝/微信扫码）→ 支付成功 → 异步回调验签 → 点数到账 → AI 能力按点扣减。兜底模式（爱发电）为跳转站外支付后回站内填订单号核销。
7. **回访用户**：登录后进仪表盘，看简历列表，编辑/导出/删除。

**关键约束**：AI 改写、照片上传、PDF 导出**都要求登录**（防 DeepSeek/OSS 被匿名滥用）。匿名可填写全部文字字段。

## 5. 数据模型（8 张表，Drizzle / Postgres）

### users（id = 应用内生成 uuid）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text PK | uuid，首次注册生成 |
| email | text unique | 登录邮箱（小写归一化） |
| password_hash | text | bcryptjs，cost 10 |
| plan | text | `free` \| `paid`（**冗余缓存**，以 subscriptions.expires_at 为准） |
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
| photo_key | text | OSS 对象 key（私有读） |
| created_at / updated_at | timestamptz | |

### experiences / educations
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| resume_id | uuid FK→resumes (cascade) |
| company / title / start_date / end_date / description | text |
| sort_order | int |

（educations：school / degree / major / start_date / end_date + sort_order）

### orders（支付订单）
`id` uuid · `user_id` text FK→users (cascade) · `provider` text（`mbdpay` \| `afdian` \| `alipay` \| `wechat`）· `payway` text（`alipay` \| `wechat` \| null）· `out_trade_no` text **unique** · `transaction_id` text（渠道流水号：面包多 `charge_id` / 支付宝 `trade_no` / 微信 `transaction_id`）· `amount_fen` int · `status` text（`pending` \| `paid` \| `failed` \| `refunded`）· `paid_at` timestamptz · `raw_notify` jsonb · `created_at` timestamptz

### subscriptions（30 天通行证，非订阅）
`id` uuid · `user_id` text FK→users (cascade) **unique** · `plan` text（`pass_30d`）· `started_at` timestamptz · `expires_at` timestamptz · `last_order_id` uuid · `created_at` timestamptz

**有效期语义（必须按此实现，不要在文案里说成「订阅/自动续费」）**：
- 首次购买：`started_at = paid_at`，`expires_at = paid_at + 30 天`。
- 未到期续购：`expires_at = GREATEST(now(), expires_at) + 30 天`（不叠加两次 60 天，也不吞掉剩余时间）。
- 到期即降级 `free`，不自动扣款、不自动续期；到期前 3 天站内提示。

### ai_rewrites（审计）
`id` · `user_id` · `resume_id` · `experience_id` · `jd_snapshot` · `prompt` · `output` · `model` · `created_at`

### verification_tokens（仅用于密码重置，v1 可选）
`identifier` text（email）· `token` text · `expires_at` timestamptz

**删除行为**：注销账号 → 删 OSS 照片对象（按 `photos/{userId}/` 前缀列举删除）→ 级联删 users（连带 resumes/experiences/educations/ai_rewrites/orders/subscriptions）→ 清 `session` cookie。
> 交易记录留存与删除的冲突：电子商务法要求交易信息保存不少于 3 年，而 PIPL 要求注销后删除。v1 先按级联删除执行并在隐私政策中说明；若后续被要求留存，改为 `orders.user_id` 可空 + 脱敏保留金额/时间（待财务与法务确认，见 15.6）。

## 6. 路由清单

```
/                               落地页（SEO，static）
/sign-in                        登录（自建表单，client + useSearchParams 需 <Suspense>）
/sign-up                        注册（同上）
/api/auth/[...nextauth]         Auth.js 端点（Credentials 登录/登出）
/editor                         编辑器（client，支持 ?resumeId=xxx 加载指定简历）
/dashboard                      简历列表（受保护，DAL redirect）
/settings                       配额/升级/注销（受保护）
/api/pay/create                 POST → 建单 → 返回收银台 URL/二维码内容
/api/pay/mbdpay/notify          POST → 面包多Pay 异步通知（JSON，v1 默认）
/api/pay/afdian/notify          POST → 爱发电 webhook（JSON，兜底模式）
/pay/return                     GET → 支付完成同步回跳页（仅做提示，不入账）
/redeem                         GET/POST → 爱发电订单号核销（仅 afdian 模式）
/api/resumes/[resumeId]/pdf     GET → 扣次数 → 返回 PDF 流
```

> 回调必须**公网 HTTPS + 已备案域名**，且**只认验签/主动查单结果、不认来源 IP**。面包多Pay 的 webhook URL 不能携带参数或额外验证，否则通知无法到达；因此核销逻辑全部放在服务端，URL 里不放密钥。
>
> 个体户/企业取得营业执照后，再新增 `/api/pay/alipay/notify`（form + RSA2 验签）与 `/api/pay/wechat/notify`（JSON + 微信支付签名验签）。v1 不实现这两条，但 `provider` 枚举与 `orders` 字段已预留，切换时不改表结构。

## 7. 关键设计决策

1. **AI/照片/导出要求登录**（编辑可匿名）。理由：DeepSeek 按调用计费、OSS 占存储，匿名配额可被清 localStorage 绕过。
2. **PDF 用 Playwright 渲染「A4 HTML 模板」**（纯字符串 HTML，非 React 组件）。理由：Next 16 禁止 `react-dom/server`；字符串模板 + Playwright 最稳、字体/照片可控。
3. **支付改为「单次购买 + 30 天有效期」**。理由：支付宝/微信的周期扣款（协议支付/预授权）需企业主体与支付机构单独签约，个人与个体户无法获得；爱发电官方 FAQ 也明确说明自动扣款权限难以申请。因此不做自动续费，到期前由前端提示续费，`expires_at` 到点即降级 free。语义必须诚实：页面写「30 天通行证」，不写「自动续费」。
4. **匿名草稿存 localStorage，登录时合并**为一个新 Resume。
5. **配额服务端强制**（`consumeAi`/`consumeExport` 用原子 UPDATE + 条件 WHERE，防超发），客户端只展示。
6. **鉴权靠 DAL `verifySession()`，不依赖 middleware/proxy**。所有受保护页面/Server Action/Route Handler 内各自调 `getUserId()`/`requireUser()`。
7. **ORM 用 Drizzle**（`drizzle(sql, { schema })`，postgres-js 驱动，走本机 pg 连接池）。
8. **免费 = 每日 5 点（整份简历生成 2 点 / 单段润色 1 点 / PDF 导出免费）；付费 = 一次性点数套餐（¥9.9/12 点、¥29.9/45 点、¥69/120 点），不自动续费**。
9. **支付分三层，资金不进我方服务器**：个人主体默认走面包多Pay（站内收银台，2% + ¥0.1/笔），备选爱发电（站外 6%，订单号核销）；取得个体户/企业营业执照后再切支付宝/微信官方直连（约 0.6%，以签约页为准）。三条路径都由平台或官方持牌机构完成收款与结算，我方只做「建单 → 验签/查单 → 记账 → 开通有效期」，**不做二清、不碰资金池**。切换只改 `PAY_PROVIDER` 与 `lib/pay/*` 适配器，不改表结构。
10. **照片私有读**：OSS bucket 设为私有，前端展示与 PDF 渲染均使用短时签名 URL（10 分钟，`OSS_SIGNED_URL_TTL=600`），不再假设公开读。
11. **AI 一次性返回**（不流式）。
12. **全部数据境内存储（PIPL）**：ECS、OSS、PostgreSQL、备份全部在阿里云华东1（杭州），不跨境；仅 DeepSeek（境内 API）与支付平台（境内主体）处理完成服务所必需的最小数据。隐私政策必须写明存储地、处理目的、保存期限、删除方式；照片属敏感个人信息，上传前需单独同意。
13. **AI 生成内容标识**：改写结果在编辑页与 PDF 页脚标注「AI 辅助改写」。依据《人工智能生成合成内容标识办法》（2025-09-01 施行），具体标识方式与法务口径在 M0 确认（见 15.7）。

## 8. 分模块实现要点

- **认证**：Auth.js v5 `Credentials` provider；`authorize()` 里按 email 查 users → `bcryptjs.compare` → 返回 `{id, email}`；会话用 JWT 策略（无需 sessions 表），`session.maxAge` 30 天。注册 Server Action：Zod 校验 → 邮箱唯一性 → `bcryptjs.hash` → insert → 直接建会话。登录/注册接口按 IP 限流（10 次 / 10 分钟，内存 Map + 进程内即可，v1 不用 Redis）。⚠️ `next-auth@beta` 当前为 5.0.0-beta.32，与 Next 16 的兼容性在 M0 实测；不兼容时降级 `next-auth@4.24.15`（其 peerDependencies 已声明支持 next ^16），再不行用 `jose` 签发 HS256 JWT 存 HttpOnly cookie，自写 `getSession()`，DAL 接口保持不变。
- **邮箱/手机号**：手机号**仅作简历联系方式字段，不作登录凭据**——运营商自 2025-06-06 起不再受理个人身份的自用资质与签名报备（阿里云官方公告），故 v1 不做短信验证码。密码重置走阿里云邮件推送（DirectMail）发信；个人认证账号的发信域名审核要求**待核实**，若审核受阻，v1 降级为「不支持找回密码，可重新注册」。
- **编辑器 + 自动保存**：`app/editor/page.tsx` 是 client 组件；用 `useSession().status` 判断数据源（localStorage vs 服务端 `saveResume`），800ms 防抖。照片走 `uploadPhotoAction(formData)`（校验 jpg/png/webp ≤5MB，key 规则 `photos/{userId}/{uuid}.{ext}`，上传后换图删旧对象）。服务端上传而非浏览器直传 OSS，v1 因此**不需要配置 OSS 跨域 CORS**。
- **AI 改写**：`lib/ai.ts` 调 DeepSeek（`baseURL=https://api.deepseek.com`，model `deepseek-flash`，system prompt 要求量化+关键词+中文）。2026-10 官方在售模型为 `deepseek-flash` / `deepseek-v4-pro`；旧名 `deepseek-chat` 是否仍路由以控制台为准，M0 实测后写死。`rewriteExperienceAction`：`getUserId` → JD 非空 → 预检配额 → 调 DeepSeek（超时 30s）→ 校验返回非空 → `consumeAi` → 写 `ai_rewrites` 审计 → 返回文本。
- **PDF 导出**：`components/resume/ats-template.ts` 的 `renderAtsHtml(resume, photoDataUrl)` 返回纯字符串 HTML（含内联 class），`lib/pdf.ts` 包 `<style>` 后 Playwright `page.setContent` + `page.pdf({format:"A4"})` 返回 Buffer。字体只用服务器本机的 `Noto Sans CJK SC`（`fonts-noto-cjk` 包），模板里写 `font-family: "Noto Sans CJK SC","Source Han Sans SC",sans-serif`，**不引用任何远程字体**。照片先由服务端用签名 URL 取流、转 base64 data URL 内嵌，避免 PDF 渲染时外链失效。
- **支付下单（面包多Pay）**：`lib/pay/mbdpay.ts` 的 `createOrder({userId, amountFen, title})` → 生成 `out_trade_no`（`R{yyyyMMdd}{random6}`）→ 写 orders(`pending`) → 调创建支付接口（具体路径以 doc.mbd.pub 为准）传 `app_id`/`out_trade_no`/`amount_total`（分）/`notify_url`/`return_url`/`title`，`sign = md5(参数按 key 字典序拼成 k=v&… + "&key=" + app_key)` → 返回二维码内容或收银台 URL。前端渲染二维码 / `location.href = url`。**不杜撰接口路径**：字段名与签名规则锁定，路径以官方文档为准。
- **支付回调（面包多Pay）**：`/api/pay/mbdpay/notify` 收 `application/json`，`type === "charge_succeeded"` 时取 `data.out_trade_no`、`data.amount`（分）、`data.charge_id`、`data.payway`。**不信任回调体**：先用订单查询接口（同样带 `app_id` + `sign`）按 `out_trade_no` 回查，核对金额与状态后再入账。事务内：`UPDATE orders SET status='paid', transaction_id=?, payway=?, paid_at=now(), raw_notify=? WHERE out_trade_no=? AND status='pending'`（返回 0 行即重复回调，直接 200）→ 延长 `subscriptions.expires_at`（`GREATEST(now(), expires_at) + 30 天`）。Webhook 可能重复推送，必须幂等。
- **支付回调（爱发电，兜底）**：`/api/pay/afdian/notify` 收 JSON，`data.type === "order"` 且 `data.order.status === 2` 时取 `out_trade_no`；用 `query-order` 接口（`user_id` + `params` + `ts` + `sign`，`sign = md5(token + "params" + params + "ts" + ts + "user_id" + user_id)`）回查金额与状态；成功后按同一套入账逻辑处理，并返回 `{"ec":200,"em":""}`（不返回该结构平台会重推）。
- **支付回调（支付宝/微信，个体户后启用）**：支付宝 `alipay.trade.page.pay` 下单，异步通知为 form，按 RSA2 验签，校验 `trade_status=TRADE_SUCCESS`、`out_trade_no` 存在、`total_amount` 一致，成功返回纯文本 `success`；微信 Native 用 `POST /v3/pay/transactions/native` 下单，回调验 `Wechatpay-Signature`（平台证书/公钥），用 APIv3 密钥 AES-256-GCM 解密 `resource`，校验金额与商户号，成功返回 `{"code":"SUCCESS"}`。两条路径都要求服务器保存**原始请求体**再验签，不能先 parse 再序列化。
- **对账**：v1 用后台人工对账——每日导出平台账单，与 orders 差集比对；差异 >1 单再排查。不做 API 退款，退款走平台后台后手动改 `status='refunded'` 并把 `expires_at` 置为 now。
- **合规注销**：`deleteAccount`：删 OSS 对象（列表前缀删除）→ 事务删 DB → 清 session cookie。
- **隐私与告知**：注册页与照片上传处提供隐私政策与单独同意勾选；`/settings` 提供「删除全部数据」入口；不接入任何境外统计/字体/CDN/错误监控 SDK。

## 9. ⚠️ Next 16 陷阱清单（写代码前必读）

1. `middleware.ts` → **`proxy.ts`**（v16 废弃）；本项目鉴权走 DAL，不依赖 proxy。
2. `params` / `searchParams` / `cookies()` / `headers()` **全 async，必须 `await`**。
3. `fetch` **默认不缓存**；缓存用 `'use cache'` 指令 + `cacheLife()` / `cacheTag()`；`revalidateTag(tag, profile)` **第二参数必填**。
4. 读 `cookies()` / `headers()` 的组件（含自建登录/注册页、任何用 `usePathname()`/`useSearchParams()` 的组件）**必须包 `<Suspense>`**，否则 blocking-route 报错。
5. `runtime='edge'` / `preferredRegion` / `dynamic` / `revalidate` / `fetchCache` 已废弃或移除（cacheComponents 开启后）。
6. **禁止 `import 'react-dom/server'`**（`renderToStaticMarkup` 不可用）→ 用纯字符串 HTML 模板。
7. `error.tsx` / `global-error.tsx` 必须 `'use client'`；global-error 需自带 `<html><body>`。
8. Route Handler 仍是 `route.ts` + `GET/POST`，`context.params` 是 Promise；GET 默认动态；返回二进制用 `new Response(uint8Array, {headers})`。
9. Server Actions 仍是 `'use server'`；客户端只能 import 调用；`redirect()` 抛控制流异常。
10. 类型化 props 全局可用：`PageProps<'/editor'>`、`LayoutProps<'/'>`、`RouteContext<'/resumes/[id]'>`。
11. `experimental.serverActions.bodySizeLimit` 默认 1MB，本项目已设为 `"6mb"`（容纳 5MB 照片 + multipart 开销）。
12. **`next-auth@beta` 对 Next 16 是否兼容需在 M0 验证**；不兼容时的降级路径见 8 节认证条目。
13. 支付回调 Route Handler **必须 `const raw = await req.text()` 后再验签**（微信/支付宝），不要用 `req.json()` 后再 `JSON.stringify`，否则签名必然对不上。
14. 回调路由不要读 `cookies()`/`headers()` 以外的请求上下文，也不要依赖登录态；它们必须能被公网匿名 POST。

## 10. 环境变量（`.env.local`，模板见 `.env.example`）

```
# 数据库（同机 Docker Postgres）
DATABASE_URL=postgres://resume:***@127.0.0.1:5432/resume

# 认证
AUTH_SECRET=                            # openssl rand -base64 32
AUTH_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com    # 仅 next-auth v4 降级时使用

# 邮件（密码重置，可选）
MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS / MAIL_FROM

# AI
DEEPSEEK_API_KEY / DEEPSEEK_MODEL=deepseek-flash / DEEPSEEK_BASE_URL=https://api.deepseek.com

# 支付 v1 默认：面包多Pay
PAY_PROVIDER=mbdpay
MBD_APP_ID / MBD_APP_KEY
MBD_API_BASE=https://api.mbd.pub
MBD_NOTIFY_URL=https://your-domain.com/api/pay/mbdpay/notify
MBD_RETURN_URL=https://your-domain.com/pay/return

# 支付兜底：爱发电（PAY_PROVIDER=afdian 时启用）
AFDIAN_USER_ID / AFDIAN_API_TOKEN
AFDIAN_PLAN_ID
AFDIAN_WEBHOOK_URL=https://your-domain.com/api/pay/afdian/notify

# 支付目标态：个体户后启用，v1 留空
ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_NOTIFY_URL
WECHAT_MCH_ID / WECHAT_APP_ID / WECHAT_API_V3_KEY / WECHAT_MCH_SERIAL_NO / WECHAT_PRIVATE_KEY_PATH / WECHAT_NOTIFY_URL

# 存储（阿里云 OSS，私有读）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=
OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
OSS_SIGNED_URL_TTL=600

# 应用
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

> 旧供应商前缀（订阅计费、托管认证、Serverless 数据库）的变量一律不得出现，`.env.example` 与生产环境同步清理；CI 里加一条前缀扫描（见 14 节）。

## 11. 本地运行与数据库迁移

```bash
# 0. 国内镜像（写进项目 .npmrc，避免每次手敲）
registry=https://registry.npmmirror.com
# shell: export PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright
# 若该镜像路径 404，改用 npmmirror 当前的 Playwright 二进制路径（M0 实测并写入 README）

# 1. 起本地数据库（不用装 Postgres）
docker run -d --name resume-pg -p 5432:5432 \
  -e POSTGRES_USER=resume -e POSTGRES_PASSWORD=*** -e POSTGRES_DB=resume \
  postgres:16-alpine

# 2. 填好 .env.local（从 .env.example 复制）
# 3. 建表（生成迁移已存在 drizzle/migrations/，可直接 push）
npx drizzle-kit push          # 或 migrate
# 4. 下载 PDF 用的 Chromium
npx playwright install chromium        # Linux VPS 上：--with-deps
# 5. 启动
npm run dev
# 6. 验证
npm run build && npm run lint
```

## 12. 当前进度（截至 2026-10-18）

**与供应商无关、可直接复用**：编辑器与自动保存、逐段 AI 改写 + 配额、服务端 Playwright PDF、落地页/仪表盘/设置页骨架、Drizzle schema 与迁移流程。

**需按本版重做（原实现绑定境外服务）**：
- [ ] 认证：境外托管认证 → Auth.js 邮箱密码（含注册、登录、登出、DAL `getUserId`）
- [ ] 支付：境外订阅计费 → 境内单次通行证（面包多Pay 下单/回调/查单/有效期判定/对账，爱发电兜底核销）
- [ ] 存储：境外对象存储 → 阿里云 OSS（私有读 + 签名 URL，PDF 内嵌 base64）
- [ ] 数据层：Serverless 驱动 → 本机 Postgres（postgres-js 连接池），数据模型加 orders 表、改 subscriptions 字段
- [ ] 环境变量与部署脚本全量替换

**未完成**：
- [ ] M0 风险验证（见第 13 节）
- [ ] AI/导出轻量限流（配额已兜底）
- [ ] 关键路径测试（M7）
- [ ] 部署到阿里云 ECS（M8）

## 13. 剩余工作（按顺序执行）

### M0 — 风险验证（先做，阻塞项）
1. **支付开通 + 小额联调**：面包多Pay 提交「闪电认证」与产品说明，审核约 1–2 天；通过后申请支付宝/微信渠道。用 ¥0.01（或平台允许的最小金额）跑通「下单 → 扫码 → 异步通知 → 主动查单 → 验签/核对 → 入账 → 延期」全链路，核对回调字段名、金额单位（分）、重复推送行为与响应体要求（**字段名以 doc.mbd.pub 为准，本文件属已核对字段**）。若审核被拒，切爱发电档位 + 订单号核销。— 最高优先
2. **主体与备案**：个人主体备案的网站为**非经营性**，不得用于商业用途；本项目含站内收费，属经营性互联网信息服务，严格合规需「公司 + 经营性 ICP 许可证」（公司、省内注册资本≥100 万、3 名技术人员社保、≥40㎡ 场地、30 个工作日审批）。现实折中：先注册个体工商户（数百元/年，地区差异待核实）并以个体户备案，同时把支付尽量放在平台侧。若审核受阻，控制上线规模、保留退款通道。— 高优先，决定上线时间
3. **阿里云 ECS 规格能否同时跑 `next build` 与 Chromium**：2C4G 起步，`next build` 峰值内存高；不够就加 swap 或在本地/CI 构建后上传产物。
4. **`next-auth@beta`（5.0.0-beta.32）与 Next 16 兼容性**：跑通 Credentials 登录 + `auth()` 读取；不行切 `next-auth@4.24.15` 或 `jose` 自写会话。
5. **DeepSeek 中文 JD 改写质量**（小样本验证「量化改写」是否可靠），并确认 `deepseek-flash` 的账号可用性与超时/限流表现。
6. **密码重置发信**：DirectMail 发信域名验证（TXT/MX 记录）+ 个人认证账号能否申请发信域名（待核实）+ 送达 QQ 邮箱/163 邮箱实测。
7. **OSS 配置**：私有读、签名 URL 有效期、图片处理压缩参数、同地域备份；确认服务端上传不需要 CORS；若后续改为浏览器直传，必须配置 OSS 跨域规则并把 `AllowedOrigin` 限定到自己的备案域名（不要用 `*`）。

### M7 — 限流 + 边界 + 测试
- AI/导出/登录加每用户或每 IP 轻量限流（如每 5s 1 次；登录 10 次/10 分钟），防重复点击/撞库。
- 关键路径测试：注册/登录 → 填简历 → AI 改写（mock DeepSeek）→ 导出（mock Playwright）→ 支付回调（构造已签名/已查单的订单 + 重放）→ 注销。
- 边界补强：空态、DeepSeek 超时降级、**重复回调幂等**（同 out_trade_no 再来一次不得重复延期）、金额篡改、会话过期 redirect、会员到期降级。

### M8 — 部署（阿里云 ECS）
- `next.config.ts` 设 `output: "standalone"`（可选）；`npm run build` + `node .next/standalone/server.js` 或 `next start`，用 pm2/systemd 守护。
- nginx 反代 + certbot 签 HTTPS（证书 90 天自动续）；`client_max_body_size 8m`（照片上传）。
- 静态资产瘦身：上线前用 ffmpeg 将 `public/hero.mp4` 压到 ~3MB（`-crf 30 -preset slow`），或将视频/大图迁 OSS/CDN；落地页插画 `public/art-*.jpg` 为 MB 级原图，一律经 `next/image` 按需压缩下发（页面已如此实现），不得用 `<img>` 直引原图。
- 装 `fonts-noto-cjk`（中文 PDF）+ `npx playwright install chromium --with-deps`。
- Postgres 同机 Docker，`pg_dump` 每日定时备份到 OSS（保留 7 天），`rm -rf` 前先验证备份可恢复。
- 单实例无需 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`；多实例需设。
- 备案通过、域名解析到 ECS 后，再把 `AUTH_URL`/`MBD_NOTIFY_URL` 切生产；页脚放 ICP 备案号与公安备案号。

## 14. 验证清单（完成标准）

- [ ] `npm run build` + `npm run lint` 通过。
- [ ] 代码、配置与文档中无旧供应商名称、无旧订阅计费字段前缀残留：CI 增加 `npm run check:legacy`（旧名单内置在脚本里，不在本文件出现），要求 0 命中；第 17.1 节一律用「境外订阅计费」「境外托管认证」「境外 Serverless Postgres」等中性描述。
- [ ] 手动关键路径：落地页 → 匿名填简历 → 照片上传 → 注册（草稿合并）→ 逐段 AI 改写 → 重新生成 → 导出 PDF（计数递减）→ 免费触顶被拦截 → 下单 ¥0.01 → 扫码支付 → 回调入账 → 无限导出 → 注销账号数据清空（含 OSS 对象）。
- [ ] 支付异常：伪造回调被拒（查单不通过）、金额被改被拒、重复回调不重复延期、回调超时后平台重推能正确入账。
- [ ] 边界：空态、DeepSeek 超时/限流提示、重复提交、会话过期。
- [ ] 数据合规：隐私政策可见、照片上传有单独同意、注销后 OSS 对象与 DB 记录均无残留、页面无任何境外字体/统计/CDN 请求。

## 15. 风险与待办

1. **个人备案 + 收费 = 经营性风险（本方案最大非技术风险）**：《互联网信息服务管理办法（2025）》第 3 条把「有偿提供信息或网页制作」定义为经营性，第 4 条要求许可，第 11 条明确「非经营性互联网信息服务提供者不得从事有偿服务」，第 19 条对无证经营可处 10–100 万元罚款并关闭网站；阿里云备案文档也写明「个人主体备案的网站为非经营性网站，不可用于商业用途」。而经营性 ICP 许可证要求「依法设立的公司」、省内注册资本≥100 万、3 名技术人员社保、≥40㎡ 场地，省局指南审批 30 个工作日（法规上限 60 日）。**结论：个人主体 + 站内收费在严格口径下不合规。** 缓解：尽快注册个体工商户（优于个人，但仍非 ICP 许可证）、把支付放在平台侧、控制上线规模、保留退款通道；要走完全合规路径则注册公司并申请 ICP 许可证。
2. **支付通道的可用性风险**：面包多Pay 规模小、审核严格（官方自述停止推广、标准更严），可能拒绝本项目；爱发电费率 6% 且需站外跳转；虎皮椒/蓝兔宣称「个人无需营业执照」，但微信官方文档明确小微商户仅限线下行业、不支持线上行业，支付宝当面付则是线下当面收银产品（进件需店铺名称/地址/内景照片），个人通道用于线上 SaaS 属超范围，商户号可能被风控限制，**不作为主选**。缓解：`PAY_PROVIDER` 可切；M0 同时申请面包多Pay 与爱发电；不把全部收入押在一家。
3. **短信验证码不可用**：运营商自 2025-06-06 起不再受理个人身份的自用资质与签名报备（阿里云官方公告）。因此 v1 不做手机号登录；若后续要加，需先有个体户/企业主体。
4. **OSS 费用与流量**：签名 URL 每次访客都产生流量费，照片建议前端 `?x-oss-process=image/resize,w_600` 压缩后展示，PDF 才取原图；标准存储 ¥0.12/GB/月 + 外网流出流量另计（官方计费文档）。
5. **DeepSeek 中文 JD 改写质量、价格与限流**：按 token 计费，价格会调整；上线前用真实 JD 小样本评估，并在超时/限流时给用户明确提示（不静默失败）。
6. **数据合规（PIPL）**：简历含姓名、手机号、照片等个人信息，照片属敏感个人信息；需 privacy policy、单独同意、最小化收集、可删除、境内存储。注销删除与电商交易留存（≥3 年）存在冲突，v1 先级联删除并在政策中说明，后续再按法务意见调整。
7. **AI 生成内容标识**：《人工智能生成合成内容标识办法》2025-09-01 施行，AI 改写结果是否需显式标识、标识放在页面还是 PDF，需法务确认；v1 先在编辑页与 PDF 页脚加「AI 辅助改写」提示。
8. **无自动续费意味着流失**：需要到期前 3 天站内提醒（登录时判断），否则用户到期即静默降级。
9. **单机单点**：ECS 挂了即全站不可用，无高可用；v1 接受，靠每日备份兜底数据。
10. **备案周期**：阿里云初审 1–2 个工作日、管局 1–20 个工作日，首次备案期间网站必须关闭；不要把上线日期押在「一周内」。
11. **时区与对账**：`expires_at` 统一 timestamptz + UTC，展示时转 Asia/Shanghai；平台账单与 orders 的对账口径（含退款、重复推送）需在 M0 固定。

## 16. 假设（未明确、按默认取的）

邮箱+密码登录（≥8 位，不做邮箱验证）、落地页 SEO/编辑器 noindex、照片 ≤5MB jpg/png/webp、桌面优先编辑、无营销邮件、无独立监控（先看 nginx access log + pm2 log）、技能换行分隔、DeepSeek 模型 ID 以官方文档为准、会员到期立即降级（不做宽限期）、退款仅人工处理、单实例部署、支付宝与微信通道由所选支付方式统一呈现、数据全部境内存储、v1 不做短信与微信登录。

---

## 17. 附录 A：地域依赖替换对照

### 17.1 替换总表

| 层 | 原方案（境外/受限） | 障碍 | 现方案（大陆可用） | 主体门槛 | 费用量级 | 官方依据（核实/检索 2026-10-18） |
|---|---|---|---|---|---|---|
| 支付 | 境外订阅计费（Merchant of Record，自动续费） | 大陆主体开户与收款受限；MoR 由境外主体统一收款，境内无对应牌照/发票路径（需人工确认）；自动续费需企业签约 | 面包多Pay（默认）/ 爱发电（兜底）/ 支付宝+微信直连（个体户后） | 个人实名（前两者）；个体户或企业（直连） | 2% + ¥0.1/笔；6%；直连约 0.6%（待核实） | [面包多](https://doc.mbd.pub/untitled)；[爱发电](https://guide.afdian.com/faq/faq-for-creators)；[微信支付](https://pay.wechatpay.cn/static/applyment_guide/applyment_detail_website.shtml) |
| 认证 | 境外托管认证（SaaS） | 国内访问/邮件送达不稳；无手机号；数据出境 | Auth.js 邮箱+密码自建 | 个人 | 0 | [next-auth 版本](https://registry.npmmirror.com/-/package/next-auth/dist-tags) |
| 数据库 | 境外 Serverless Postgres | 延迟、出境、无法备案 | 同机 Docker PostgreSQL 16（v2 迁 RDS） | 个人 | 0（自建） | [阿里云 RDS PostgreSQL](https://www.aliyun.com/product/rds/postgresql) |
| 存储 | 境外对象存储（S3 兼容） | 出境、签名/Endpoint、无法备案 | 阿里云 OSS，私有读 + 签名 URL | 个人实名 | ¥0.12/GB/月 + 流量 | [OSS 计费](https://help.aliyun.com/zh/oss/billing-overview) |
| 部署 | 境外托管 VPS | 国内访问慢，域名无法备案 | 阿里云 ECS + nginx + certbot | 个人实名 | 百元级/月（待核价） | [阿里云 ECS](https://www.aliyun.com/product/ecs) |
| 备案 | 无 | 无备案无法绑定域名对外提供服务 | 阿里云 ICP 备案 + 公安联网备案 | 个人可办但不得经营性；经营性需公司 + 许可证 | 备案免费；许可证需公司/100 万/3 人社保 | [阿里云备案](https://help.aliyun.com/zh/document_detail/3043304.html)；[管理办法](https://policy.mofcom.gov.cn/claw/clawContent.shtml?id=102438) |
| 短信 | 无 | — | v1 不做（个人无法报备签名） | 企业/个体户（待核实） | 按条，待核价 | [阿里云公告](https://help.aliyun.com/zh/sms/product-overview/announcement-on-sms-not-supporting-application-for-personal-use-qualification) |
| AI | DeepSeek | 无（境内服务，无需替换） | 保留 | 个人实名 | 按 token | [DeepSeek 定价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) |
| 依赖源 | npm / Playwright 官方源 | 国内下载慢/易断 | npmmirror 镜像 + Playwright 下载镜像 | — | 0 | [npmmirror](https://registry.npmmirror.com) |
| 字体 | 远程字体（Google Fonts） | 境内不可用，PDF 缺字 | 本机 `fonts-noto-cjk`（思源黑体） | — | 0（OFL） | [Noto CJK](https://github.com/notofonts/noto-cjk) |
| 数据出境 | 用户数据存境外 | 违反 PIPL 告知/单独同意要求 | 全部数据境内存储（华东1） | — | 0 增量 | [个人信息保护法](http://www.scio.gov.cn/xwfb/gwyxwbgsxwfbh/wqfbh_2284/2021n_2711/2021n11y16r/wjxgzc_4286/202208/t20220808_315296.html) |

**替换后的收益**：全链路境内可访问（延迟从 200ms+ 降到 20ms 级）、无需出境评估、支付转化率提升（支付宝/微信扫码是国内默认习惯）、基础设施成本可压到百元级/月。

**替换后的代价**：失去开箱即用的托管认证（要自己写注册/登录/会话）、失去全球税务代缴（本来也用不上）、支付费率更高（2%–6%）、备案与主体资质成为上线关键路径。

### 17.2 支付通道对比（决定 `PAY_PROVIDER`）

| 通道 | 个人可否 | 费率 | 体验 | 资金路径 | 主要风险 | 结论 |
|---|---|---|---|---|---|---|
| 面包多Pay | 可（实名 + 审核） | 2% + ¥0.1/笔 | 站内原生，支付宝/微信 | 支付宝直达；微信托管 T+1 | 审核可能拒；规模小 | **v1 默认** |
| 爱发电 | 可（实名） | 6% | 站外跳转 + 回站核销 | 平台月结 | 费率最高、转化路径长 | **兜底** |
| 支付宝电脑网站支付 | 个体户/企业 | 约 0.6%（待核实） | 原生 | 官方直连 | 需营业执照 + 备案 | 个体户后目标态 |
| 微信支付 Native | 个体户/企业 | 0.6%–1% | 原生扫码 | 官方直连 | 需营业执照 + 备案 | 个体户后目标态 |
| 虎皮椒 | 宣称可（无营业执照） | 开户 ¥118 + 1–2% + 0.6% | 原生扫码 | 官方清算 | 线上超范围、商户号风控 | 不推荐 |
| 蓝兔支付 | 宣称可 | 开户 ¥50/通道 + 0.7% + 0.6% | 原生扫码 | 官方清算 | 同上 | 不推荐 |

### 17.3 地域可用性自检（上线前逐项打勾）

- [ ] 域名在境内注册商实名，ICP 备案通过，页脚展示备案号并链接工信部。
- [ ] 全站 HTTPS，证书自动续期；回调地址为公网 HTTPS 且不带多余参数。
- [ ] 页面与 PDF 不请求任何境外域名（字体、图片、统计、CDN、错误监控）。
- [ ] 数据库、OSS、备份都在华东1，未开启跨地域复制到境外。
- [ ] 支付回调可被公网匿名 POST，验签/查单失败时不入账、不返回成功。
- [ ] npm/Playwright 走镜像，服务器无需访问境外源即可完成构建与浏览器安装。
- [ ] 隐私政策写明境内存储、处理目的、保存期限、删除与注销方式。
- [ ] 个人/个体户主体与备案类型一致；若站内收费，已评估经营性许可风险。

### 17.4 待核实清单（不要当成已确认）

1. 阿里云 RDS PostgreSQL、ECS/轻量的具体月价（按规格、地域、包年折扣差异大，需用官网计价器核算）。
2. DirectMail 个人认证账号能否申请发信域名、审核周期与单价。
3. 面包多Pay 创建支付接口的路径、返回结构、Webhook 期望的响应体（本文件已核对字段与签名规则，路径未锁定）。
4. 爱发电「售卖方案/兑换码」是否支持自动发货；若支持，可把核销从人工改为自动。
5. 支付宝周期扣款（协议支付）对个体户的开放情况；微信支付服务商对线上行业的小微商户政策是否变化。
6. 《人工智能生成合成内容标识办法》对「AI 改写简历」的具体标识要求。
7. 个体工商户注册成本与当地备案规则（各省管局差异）。
