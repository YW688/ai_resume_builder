# 隐私事实审计报告（代码证据版）

- **审计对象**：.（中文 AI 简历编辑器，Next.js 16 + Neon + DeepSeek + 点数计费）
- **审计时间**：2026-10-25
- **审计方式**：只读静态审计（读源码、schema、migrations、docs、`.env.example` 变量名、构建产物文件名）；未读取 `.env.local` / `.env.neon-cli` / `.neon` 中任何值；未执行写库、调用 AI、调用支付或产生费用的命令。
- **唯一写入文件**：`docs/legal/audit-privacy.md`（本文件）。
- **证据约定**：每条事实后附 `路径:行号`。无法从仓库代码确定的，一律标注「**代码未体现 / 取决于部署配置**」，不做推测。npm 依赖内部实现（cookie 名、TTL）标注为「依赖代码」，属于可核验的第三方实现事实。
- **重要范围声明**：仓库同时存在「计划/文档」与「实际代码」。`plan.md`、`地域依赖替换决策表.md` 中的境内架构属于**计划**，与当前代码的实际供应商不一致，本报告在 §9 单列冲突，请勿把计划文案当作已实现事实。

---

## 0. 结论速览（最影响隐私政策的 10 条）

1. **实际使用的供应商是 Neon 全家桶**（Postgres/Auth/Storage/Realtime/Functions）+ DeepSeek + 本机 Playwright，不是 `plan.md` 里写的 Auth.js/阿里云 OSS/自建 Postgres：`lib/db.ts:5`、`lib/auth/server.ts:17-21`、`lib/storage.ts:10-20`、`lib/realtime/server.ts:34-38`、`lib/functions/extract-keywords.ts:56-64`、`lib/ai/client.ts:18`、`lib/pdf.ts:275-289`。
2. **数据是否出境，代码无法证明**：数据库、对象存储、Auth、Realtime、Function 的**区域全部由部署时环境变量/Neon 控制台决定**（`lib/db.ts:5`、`lib/storage.ts:11-12`、`lib/auth/server.ts:18`、`lib/realtime/client.ts:16`、`lib/functions/extract-keywords.ts:57`），仓库无任何区域记录；而首页/隐私页却已对外宣称「全部存于中国大陆境内数据中心」：`app/page.tsx:88`、`app/privacy/page.tsx:16`。**发布前必须由部署方确认 Neon 项目/桶/Realtime/Function 区域，否则该宣称不可核验。**
3. **AI 请求确实会发送姓名与城市**（整份生成场景），与隐私页「只发当段经历与 JD、不附带联系方式」的表述不符：`lib/ai/prompts.ts:134-152`（含 `姓名：` / `城市：`）、`lib/ai/actions.ts:162-180`；**电话/邮箱/照片不进入 AI 提示词**：`lib/ai/prompts.ts:31-44`、`lib/ai/actions.ts:162-180`。`app/privacy/page.tsx:28` 需改写为「按功能分别说明」。
4. **AI 调用会留审计快照**：每次成功调用把**完整用户提示词（可能含姓名/城市）**、JD 快照、模型输出写进 `ai_rewrites`，上限 8000/8000/12000 字符，**无自动清理、无用户查看/删除入口**：`lib/ai/actions.ts:200-224`、`drizzle/schema.ts:321-339`。
5. **照片当前根本不会上传服务器**：编辑器只做本地 `FileReader` 预览，明确提示「不会上传服务器」：`components/editor/FormSections.tsx:801-831,824,927`。`lib/actions.ts:300-325` 的 `uploadPhotoAction` 属遗留路径，当前 UI 无引用；因此「照片存于私有对象存储」在现版本仅为**代码能力**而非实际数据流。若启用该路径，仓库**没有预签名 URL 实现**，展示依赖 `NEON_STORAGE_PUBLIC_URL` 公开前缀：`lib/actions.ts:77-81`、`lib/workspace/load.ts:49-54`、`app/api/resumes/[resumeId]/pdf/route.ts:20-24`。
6. **没有单独同意勾选**：注册/登录页只有「注册/继续即表示同意《隐私政策》」文字，无 checkbox；照片上传处也无任何同意弹窗/勾选：`app/sign-up/[[...sign-up]]/page.tsx:35-39`、`app/sign-in/[[...sign-in]]/page.tsx:35-39`、`components/editor/FormSections.tsx:864-928`。与 `plan.md:166,303` 要求的「单独同意」不符。
7. **注销账号是真实级联删除**（Auth 用户 + 业务数据 + 照片对象尽力删除），但依赖 3 个管理凭证 `NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID` 且**这些变量未写入 `.env.example`**；凭证缺失时直接失败：`lib/actions.ts:405-461`（凭证 409-418、删 Auth 421-435、删照片 437-444、级联 452-455、登出 458）。Lemon Squeezy 订阅取消仍是 TODO（`:446`）。
8. **交易记录实际会被注销删除**，与隐私页「交易记录依《电子商务法》另行留存」矛盾：`orders.user_id` 外键 `ON DELETE cascade`（`drizzle/migrations/0001_clear_blonde_phantom.sql:86`、`drizzle/schema.ts:250`），注销后 `orders`/`credit_ledger` 一并删除；`plan.md:113,312` 也承认 v1 先级联删除。
9. **没有分析/埋点/错误监控/Cookie 同意弹窗，也没有任何第三方运行时字体或 CDN**：依赖清单无相关包（`package.json:17-44`）；`next/font/google` 字体在构建期下载并自托管（`app/layout.tsx:2,5-8`，构建产物 `.next/static/media/*.woff2` 存在），浏览器运行时不请求 Google。**在当前照片未上传的前提下，浏览器端唯一的第三方运行外连是 Neon Realtime 的 wss 地址**（`lib/realtime/client.ts:16-25`）；若将来启用照片上传且配置公开前缀，浏览器/PDF 预览还会从该存储域名加载照片（`lib/workspace/load.ts:49-54`）。
10. **通知/邮件偏好开关只存库、不触达任何发送逻辑**：`weeklyDigest` 开关文案称「发送到你的邮箱」（`components/settings/SettingsScreen.tsx:463-470`），但全仓库无邮件发送依赖或调用（`package.json:17-44` 无邮件库；检索无 nodemailer/resend/smtp 等命中），`notifications` 表只被演示种子写入（`lib/workspace/seed.ts:113-126`）。`autoKeywordCheck` 也未被业务读取（仅设置页读写与种子：`components/settings/SettingsScreen.tsx:471-481`、`lib/workspace/actions.ts:435-436`、`lib/workspace/seed.ts:110`）。

---

## 1. 数据收集清单（逐项：数据项 → 存储位置/字段 → 写入位置）

### 1.1 账号与注册

| 数据项 | 存储位置（schema.字段） | 写入/读取代码 | 备注 |
|---|---|---|---|
| 邮箱（注册/登录） | 托管 Neon Auth 用户；同时冗余写入 `public.users.email` | 注册：`app/sign-up/actions.ts:54-58`；冗余：`lib/actions.ts:71-73`、`lib/workspace/load.ts:80-88`；字段：`drizzle/schema.ts:20` | 登录只用 Neon Auth 邮箱：`app/sign-in/actions.ts:48` |
| 昵称/姓名 | Neon Auth 的 name；`public.users.name` | 注册表单：`components/auth/SignUpForm.tsx:20-37`；写库：`lib/workspace/load.ts:82-86`；字段：`drizzle/schema.ts:21` | 注册昵称可选（`SignUpForm.tsx:25`） |
| 密码 | **不落本应用数据库**，交由 Neon Auth 托管；注册页明示 | `app/sign-up/actions.ts:54-58`、`app/sign-up/[[...sign-up]]/page.tsx:39` | 哈希算法/迭代次数：代码未体现（Neon Auth 托管） |
| 手机号 | `public.users.phone` | 设置页：`components/settings/SettingsScreen.tsx:158-166`；写库：`lib/workspace/actions.ts:401-418`；字段：`drizzle/schema.ts:22` | 可空；未见格式校验（仅 trim） |
| 城市 | `public.users.city` | `SettingsScreen.tsx:167-175`；`lib/workspace/actions.ts:401-418`；`drizzle/schema.ts:23` | — |
| 目标岗位 | `public.users.target_role` | `SettingsScreen.tsx:176-188`；`drizzle/schema.ts:24` | — |
| 注册时间/资料更新时间 | `users.joined_at/created_at` | `drizzle/schema.ts:25,45-47` | — |

### 1.2 简历与求职内容

| 数据项 | 存储位置/字段 | 写入代码 | 备注 |
|---|---|---|---|
| 简历标题、姓名、电话、邮箱、城市、求职总结、技能 | `resumes.title/full_name/phone/email/city/summary/skills` | `lib/workspace/actions.ts:133-146`（saveResumeAction）；字段 `drizzle/schema.ts:96-103` | 同一份联系方式在 `users` 与 `resumes` 各存一份 |
| 照片对象 key | `resumes.photo_key` | 遗留 `lib/actions.ts:84-168`、`:300-325`；字段 `drizzle/schema.ts:105` | 当前 UI 不调用上传，见 §1.4 |
| 工作/项目经历 | `experiences.company/title/start_date/end_date/description` | `lib/workspace/actions.ts:165-212`；`drizzle/schema.ts:124-135` | — |
| 教育经历 | `educations.school/degree/major/start_date/end_date` | `lib/workspace/actions.ts:175-240`；`drizzle/schema.ts:137-148` | — |
| 收藏/粘贴的岗位与 JD 原文、关键词 | `jobs.company/title/location/salary/source/jd_text/keywords` | `lib/workspace/actions.ts:266-319`；`drizzle/schema.ts:53-80` | `jd_text` 原文会长期保留 |
| 投递记录 | `applications.company/role/stage/applied_at/next_step/next_at/note` | `lib/workspace/actions.ts:337-395`；`drizzle/schema.ts:153-188` | 含个人备注 |
| 站内通知 | `notifications.title/body/kind/read` | 仅演示种子 `lib/workspace/seed.ts:113-126`；当前无真实通知生成代码 | 见 §5 |
| 求职偏好 | `preferences.target_roles/cities/salary/job_type/weekly_digest/auto_keyword_check` | `lib/workspace/actions.ts:426-466`；`drizzle/schema.ts:217-239` | 邮件偏好只存库 |
| 编辑草稿 | 浏览器内存 + 600ms 自动保存到 `resumes` | `components/editor/EditorScreen.tsx:67,1000`；`lib/mock/store.tsx:264` | 无独立草稿表 |

### 1.3 计费、订单、审计

| 数据项 | 存储位置/字段 | 写入代码 | 备注 |
|---|---|---|---|
| 点数余额、每日免费用量、到期时间 | `users.credits_balance/daily_credits_used/daily_credits_date/credits_expire_at` | `lib/credits/server.ts:192-321`；`drizzle/schema.ts:36-44` | 每日额度按北京时间惰性重置（`lib/credits/server.ts:143-156`） |
| 订单 | `orders.amount_fen/label/status/package_id/credits/provider/provider_order_id/paid_at` | `lib/pay/index.ts:166-181`（沙箱购买）；`lib/workspace/actions.ts:517-531`（旧续费） | 当前仅 `manual` 沙箱渠道可成交（`lib/pay/index.ts:150-164`） |
| 点数流水 | `credit_ledger.delta/balance_after/kind/feature/ref/note` | `lib/credits/server.ts:83-106`；`drizzle/schema.ts:276-304` | 含「购买/消耗/退款/过期」记录 |
| 订阅（遗留） | `subscriptions.ls_subscription_id/ls_customer_id/status` | 仅遗留 Lemon Squeezy 回调可写：`app/api/webhooks/lemon-squeezy/route.ts:51-67`；`drizzle/schema.ts:306-319` | 该路由已标注 deprecated，前端无入口 |
| AI 审计快照 | `ai_rewrites.jd_snapshot/prompt/output/model` | `lib/ai/actions.ts:200-224`（现役）；`lib/actions.ts:360-366`（遗留，只写 jd/output） | **`prompt` 可能含姓名/城市**；无 TTL、无用户查看入口 |

### 1.4 照片（当前实际行为）

- 编辑器照片区只把文件读成浏览器内 data URL，用于 A4 预览与导出；代码与 UI 文案均明确「不会上传服务器」：`components/editor/FormSections.tsx:819-831`、`:924`（toast）、`:927`（说明文字）、`lib/mock/types.ts:47`（`photoInitials` 注释）。
- PDF 导出 `POST /api/resumes/[resumeId]/pdf` 会把 data URL/base64 照片随请求体发给服务端做**临时渲染**：`app/api/resumes/[resumeId]/pdf/route.ts:139-145,226`、`lib/pdf.ts:180-192,264-289`；该 Route Handler 不落盘照片（无写文件/写库代码）。
- 遗留上传能力：`lib/storage.ts:25-40` 上传到 S3 兼容桶（key 规则 `${userId}/${uuid}.${ext}`，`:27`），限制 5MB、jpeg/png/webp（`:22-23`）；`lib/actions.ts:300-325` 调用它。**当前无任何 UI/页面引用 `uploadPhotoAction`**（全仓库仅遗留 `docs/dashboard/_legacy/editor-page.tsx.txt:10,224` 引用）。
- PDF `GET` 会使用已保存的 `photo_key` 拼公开地址：`app/api/resumes/[resumeId]/pdf/route.ts:20-24`；列表接口同样 `lib/workspace/load.ts:49-54,257-258`。**无预签名 URL 代码**：`lib/storage.ts:2-6` 只导入 `PutObjectCommand/DeleteObjectCommand`。

### 1.5 日志、URL 参数与诊断信息

| 数据项 | 位置 | 说明 |
|---|---|---|
| 服务端错误日志 | `lib/ai/actions.ts:222,304,327`；`app/api/webhooks/payment/route.ts:79`；`lib/actions.ts:429`；`lib/credits/server.ts:104`；`lib/workspace/actions.ts:242,256,315,378,392,420,462,558` | 记录错误对象/状态码/订单号；未见显式打印用户简历内容或邮箱 |
| 登录回跳参数 | `lib/auth/redirect.ts:15-24`；`proxy.ts:26-29`；`lib/lemonSqueezy.ts:35`（`?upgraded=1`） | URL 查询参数只含站内路径/状态标记 |
| 编辑器 URL 参数 | `components/editor/EditorScreen.tsx:121-122`（`id`、`print=1`） | 简历 UUID 会出现在 URL/访问日志；UUID 属可关联标识 |
| 实时订阅换取接口 | `app/api/realtime/workspace/route.ts:12-23` | 返回短期 capability，`Cache-Control: private,no-store`，不进 URL |
| 部署层访问日志/备份日志 | — | **代码未体现**（取决于反向代理/平台配置） |

---

## 2. 存储位置、供应商与「是否出境」

### 2.1 代码可确定的处理链

| 供应商 | 代码证据 | 收到/存储什么 | 传输时机 |
|---|---|---|---|
| **Neon Postgres** | `lib/db.ts:5`（`DATABASE_URL`）；`drizzle/schema.ts` 全部业务表 | 账户资料、简历/经历/教育、岗位 JD、投递、通知、偏好、订单/点数流水、AI 审计、订阅 | 每次读写（HTTP driver） |
| **Neon Auth（Managed Better Auth）** | `lib/auth/server.ts:17-26`；`app/api/auth/[...path]/route.ts:9`；`lib/auth/session.ts:17-27` | 邮箱、密码（托管）、昵称、会话；Auth 数据位于同一 Neon 数据库项目的 `neon_auth` schema（`lib/workspace/load.ts:74-78` 直接查询 `neon_auth."user"`） | 登录/注册/会话校验 |
| **Neon Storage（S3 兼容）** | `lib/storage.ts:10-20` | 照片二进制（仅遗留上传路径） | 上传/删除；当前 UI 不触发 |
| **Neon Realtime** | `lib/realtime/server.ts:34-38,51-132`；`lib/realtime/client.ts:15-25`；`app/api/realtime/workspace/route.ts:20` | 应用、通知、岗位三张表的查询结果（含 company/role/note/通知正文/JD 关键词等）以行数据形式下发到浏览器；服务端把加密后的查询 capability 交给客户端（JWE，TTL 60s） | 页面打开时建立 wss 连接并持续同步 |
| **Neon Functions** | `lib/functions/extract-keywords.ts:56-64,99-115`；调用方 `lib/workspace/actions.ts:281-291` | JD 原文（≤20,000 字符）+ Neon Auth JWT | 保存岗位时 |
| **DeepSeek（OpenAI 兼容）** | `lib/ai/client.ts:18-19,69-102,203-231` | 见 §2.3 的提示词内容；模型输出 | 用户点击 AI 功能时 |
| **Playwright（本机 Chromium）** | `lib/pdf.ts:275-289` | 简历 HTML（含姓名/电话/邮箱/城市/经历/教育/照片 data URL）仅在本机进程内渲染，不发起第三方网络请求（除非照片为外部 https URL，见 `app/api/resumes/[resumeId]/pdf/route.ts:139-145`） | 导出 PDF 时 |
| **支付渠道** | `lib/pay/index.ts:42-47,141-200`；`app/api/webhooks/payment/route.ts:24-31,41-83` | 当前代码只有 `manual` 沙箱（不发外部请求）；`mbd/afdian/alipay/wechat` 只有标签和回调契约，**未实现下单** | 当前无真实支付外发 |
| **Lemon Squeezy（遗留）** | `lib/lemonSqueezy.ts:10-51`；`app/api/webhooks/lemon-squeezy/route.ts:1-9,19-69`；`lib/actions.ts:378-388` | 若被调用：邮箱、内部 user_id、订阅/客户 id。触发入口 `createCheckoutAction` 仅被**未被引用的** `components/settings/SettingsView.tsx:6,31` 引用 | 当前 UI 不可达；路由仍存在 |

### 2.2 代码无法确定、必须由部署配置/运营方确认的项

| 待确认项 | 为什么代码不能确定 | 证据 |
|---|---|---|
| Neon 项目所在的云区域（决定 DB 存储地） | 连接串来自 `DATABASE_URL`，仓库不记录区域；`.env.example` 只有占位符 | `lib/db.ts:5`、`.env.example:1-2` |
| Neon Storage 桶区域/端点/是否公开读 | `NEON_STORAGE_REGION` 默认 `auto`，endpoint/bucket 均来自环境变量；公开读依赖 `NEON_STORAGE_PUBLIC_URL` 是否配置 | `lib/storage.ts:10-20`、`.env.example:4-12` |
| Neon Auth 服务区域/数据驻留 | 仅 `NEON_AUTH_BASE_URL` 由环境变量给出 | `lib/auth/server.ts:13-21`（注释）、`:18` |
| Neon Realtime 服务区域 | `NEXT_PUBLIC_NEON_REALTIME_URL`（wss）由环境变量给出 | `lib/realtime/client.ts:16-25` |
| Neon Function 部署区域 | `NEON_FUNCTION_KEYWORDS_BASE_URL` 由环境变量给出；代码注释称「部署在数据库同区域」但无证据 | `lib/functions/extract-keywords.ts:56-64`、`lib/workspace/actions.ts:280`（注释） |
| DeepSeek 的接口域名与数据处理/留存地 | 默认 `https://api.deepseek.com`，也可被 `DEEPSEEK_BASE_URL` 覆盖；模型处理与留存政策属供应商侧 | `lib/ai/client.ts:18,95-102`、`.env.example:22-28` |
| 部署平台/服务器所在区域 | 仓库无部署清单；`docs/pricing/README.md:52,243` 以 Vercel Pro 为成本假设，但**不能据此认定已使用 Vercel** | `docs/pricing/README.md:52,243`；`package.json:5-16` 无部署脚本 |
| 是否启用 HTTPS / HSTS / 安全响应头 | 应用代码未设置安全头，也未强制 https 跳转 | `next.config.ts:1-25`（无 `headers()`）；`proxy.ts:9-41`（仅鉴权） |
| 数据库备份与备份保留期 | 仓库无备份脚本/定时任务 | `package.json:5-16`、`scripts/` 目录（无备份脚本） |

> **与对外文案的冲突（必须先确认再发布）**：
> - 首页 FAQ：「全部存于中国大陆境内数据中心」：`app/page.tsx:88`。
> - 隐私页：「全部数据存于中国大陆境内数据中心，不跨境传输」：`app/privacy/page.tsx:16`。
> - `plan.md` 声称已把「境外 Serverless Postgres / 境外对象存储 / 境外托管认证」替换为自建 Postgres + 阿里云 OSS + Auth.js，并称「全部数据境内存储（华东1）」：`plan.md:150,332-334,341`；但**代码实际仍是 Neon 云服务**（§2.1），且 `docs/pricing/README.md:40` 明确「本项目用 Neon Postgres/Auth」。**结论：「境内存储、不跨境」目前只是文案/计划，缺少代码或部署配置证据，需运营方书面确认后才能写入隐私政策。**

### 2.3 发送给 DeepSeek 的具体内容（按功能）

提示词公共类型不含电话/邮箱/照片：`lib/ai/prompts.ts:31-44`；构造时也不传入这些字段：`lib/ai/actions.ts:162-180`。逐功能实际发送：

| 功能 | 发送内容 | 证据 |
|---|---|---|
| 整份简历生成（2 点） | 目标岗位 + JD（≤6000 字）+ **姓名、城市** + 现有总结 + 技能 + 所有经历（公司/职位/时间/原文）+ 教育（学校/学历/专业/时间） | `lib/ai/prompts.ts:134-152`（姓名/城市在 `:141`，JD `:138`，经历 `:146`，教育 `:149`） |
| 单段经历润色（1 点） | JD + 公司/职位/原文（≤4000 字）+ 简历总结摘要 + 技能列表 | `lib/ai/prompts.ts:180-196` |
| 技能栏整理（1 点） | JD + 现有技能 + 总结 + 经历「职位：描述」摘要（≤3000 字） | `lib/ai/prompts.ts:224-242` |
| 自我评价润色（1 点） | JD + 总结 + 技能 + 所有经历（≤4000 字） | `lib/ai/prompts.ts:268-281` |
| 对照 JD 改写（1 点） | JD + 公司/职位/原文（≤4000 字） | `lib/ai/prompts.ts:308-320` |
| 遗留 `rewriteExperience` | 公司/职位/描述 + JD | `lib/ai.ts:13-37` |

- 请求只走 `POST {DEEPSEEK_BASE_URL}/chat/completions`（通过 `openai` SDK）：`lib/ai/client.ts:203-231`。
- 模型名默认 `deepseek-chat`，可被 `DEEPSEEK_MODEL` 覆盖：`lib/ai/client.ts:19,79-81,98-99`。
- **DeepSeek 侧是否留存、留存多久、是否用于训练**：代码未体现（供应商条款决定）。

---

## 3. 安全措施（实现 / 未实现）

### 3.1 服务端鉴权与数据隔离

- 每个受保护页面/Server Action 入口都取服务端会话：`lib/dal.ts:14-24`（`requireUser`）、`lib/auth/session.ts:17-27`（请求级缓存）。路由保护：`proxy.ts:9-10,39-41`。
- 数据归属校验：简历读写均带 `userId` 条件，例：`lib/ai/actions.ts:115-121`、`lib/actions.ts:93-97,235-242`、`lib/workspace/actions.ts:126-132,249-254,337-347`；PDF 路由校验归属：`app/api/resumes/[resumeId]/pdf/route.ts:88-93,187-193`。
- Realtime 换取接口只接受会话用户 id、拒绝请求体传 userId：`app/api/realtime/workspace/route.ts:12-23`。
- 遗留操作 `deleteResume`（`lib/actions.ts:284-297`）与 `uploadPhotoAction`（`:300-325`）也做登录校验，但存在两点注意：
  - **换图时删除旧对象未校验 key 归属**：`lib/actions.ts:319-322` 直接信任客户端 `oldKey` 并删除。
  - 现役 `deleteResumeAction` 删除简历时**不删除照片对象**：`lib/workspace/actions.ts:249-259`（对比遗留 `lib/actions.ts:293` 会删）。由于当前 UI 不产生照片对象，暂无实际影响；一旦启用照片上传即产生孤儿对象。

### 3.2 密码与会话

- 密码由 Neon Auth 托管；应用不接触明文/哈希：`app/sign-up/actions.ts:54-58`、`app/sign-up/[[...sign-up]]/page.tsx:39`。哈希算法、加盐、迭代次数：**代码未体现**。
- 会话 cookie 由 Neon Auth SDK 管理，服务端实例用 `NEON_AUTH_COOKIE_SECRET` 加密：`lib/auth/server.ts:17-26`。
- 依赖实现中的实际 cookie 名（可核验）：`__Secure-neon-auth.session_token`（`node_modules/@neondatabase/auth/dist/server-i57Km2d6.mjs:328,336`），另有会话数据 cookie `__Secure-neon-auth.local.session_data`（由服务端从 session_token 派生，`:330,668-719`）。`__Secure-` 前缀意味着生产环境需 HTTPS（`node_modules/better-auth/dist/cookies/index.mjs:279` 等）。
- 会话有效期：Better Auth 侧默认 7 天（`node_modules/better-auth/dist/cookies/index.mjs:49`），Neon Auth 的实际 `expiresIn` 由托管配置决定（**代码未体现**）。
- 登录/登出/注册全部经同源代理转发：`app/api/auth/[...path]/route.ts:9`。

### 3.3 对象存储与文件访问

- S3 客户端：`forcePathStyle: true`、region 默认 `auto`、凭证来自环境变量：`lib/storage.ts:10-18`。
- 上传限制：5MB、jpeg/png/webp：`lib/storage.ts:22-23`；服务端再校验：`lib/actions.ts:306-313`。UI 另写 4MB：`components/editor/FormSections.tsx:811`（前后口径不一致）。
- **私有桶 + 签名 URL：未实现**。仓库没有 `getSignedUrl`/预签名代码；展示/导出依赖 `NEON_STORAGE_PUBLIC_URL` 拼接的公开地址（`lib/actions.ts:77-81`、`lib/workspace/load.ts:49-54`、`app/api/resumes/[resumeId]/pdf/route.ts:20-24`）。`.env.example:11` 把「公开读」与「预签名 URL」列为二选一，但代码只支持前者。**因此「照片存于私有对象存储、签名 URL 临时访问」目前无法从代码证实。**

### 3.4 传输、头部、限流、密钥

- HTTPS/HSTS/CSP/X-Frame-Options 等：应用层**代码未体现**（`next.config.ts:1-25` 无 `headers()`；`proxy.ts` 只做鉴权跳转）。生产是否强制 HTTPS 取决于反向代理/平台配置。
- 限流/防刷：**代码未体现**（登录、AI、PDF 导出均无应用层限流；AI 侧仅 45s 超时 + 1 次网络重试：`lib/ai/client.ts:23-26,213-265`）。
- CSRF：依赖 Next.js Server Actions/同源策略，**未见自定义 CSRF token 代码**（代码未体现）。
- 密钥硬编码扫描：未发现硬编码 API Key/云凭证。源码中只有变量名与占位前缀：`lib/ai/client.ts:21`（`sk-placeholder` 占位判定）、`lib/lemonSqueezy.ts:14-16`、`lib/storage.ts:14-15`、`lib/actions.ts:409-411`。`.env*` 已被 gitignore：`.gitignore:33-34`；`git ls-files` 未列出任何 `.env*` 文件（本次只读执行）。`.env.local` 实际存在于工作区（未读取其内容）。
- 支付回调验签：HMAC-SHA256 + `timingSafeEqual`：`app/api/webhooks/payment/route.ts:24-31`；Lemon Squeezy 同样实现：`lib/lemonSqueezy.ts:53-64`。回调幂等/金额校验：`lib/pay/index.ts:220-241`。

### 3.5 日志卫生

- 错误日志主要记录错误对象/状态码/订单号：`lib/ai/actions.ts:222,304,327`、`app/api/webhooks/payment/route.ts:79`、`lib/actions.ts:429`（Neon Auth 删除失败的响应体截断 300 字）。
- 未发现主动打印用户邮箱/手机号/简历正文的代码。
- 但部署侧访问日志、Neon/Auth 侧日志、DeepSeek 侧日志的字段与保留期**代码未体现**。

---

## 4. 第三方清单（收到什么、用途、跨境、合同状态）

| 供应商/组件 | 收到或存储的数据 | 用途 | 跨境判断 | DPA/条款链接 | 证据 |
|---|---|---|---|---|---|
| Neon（Postgres） | §1 全部业务数据（除密码明文） | 数据库存储/查询 | **取决于 Neon 项目区域（代码未体现）** | **代码未体现**（仓库无 DPA/条款链接） | `lib/db.ts:5`、`drizzle/schema.ts:18-350` |
| Neon Auth | 邮箱、密码（托管）、昵称、会话、Auth 用户记录 | 注册/登录/会话 | 同上（取决于 Auth Base URL 指向的区域） | 代码未体现 | `lib/auth/server.ts:17-26`、`app/api/auth/[...path]/route.ts:9`、`lib/workspace/load.ts:74-78` |
| Neon Storage | 照片二进制（仅遗留上传路径启用时） | 照片存储 | 取决于桶区域（`NEON_STORAGE_REGION` 默认 `auto`） | 代码未体现 | `lib/storage.ts:10-40`、`.env.example:4-12` |
| Neon Realtime | 应用/通知/岗位三表查询结果（含公司、岗位、备注、通知正文等） | 多端实时刷新 | 取决于 wss 服务区域 | 代码未体现 | `lib/realtime/server.ts:34-38,51-132`、`lib/realtime/client.ts:16-25`、`app/api/realtime/workspace/route.ts:20` |
| Neon Functions | JD 原文 + Neon Auth JWT | 关键词提取 | 取决于 Function 部署区域 | 代码未体现 | `lib/functions/extract-keywords.ts:56-64,99-115` |
| DeepSeek | 见 §2.3 提示词；不含电话/邮箱/照片 | AI 改写/生成 | 取决于 `DEEPSEEK_BASE_URL`（默认 `api.deepseek.com`）与供应商处理地 | 代码未体现 | `lib/ai/client.ts:18-19,203-231`、`lib/ai/prompts.ts:134-152` |
| Playwright/Chromium（本地） | 简历 HTML（含联系方式与照片 data URL） | 服务端渲染 PDF | 不涉及第三方网络（照片若为外部 https URL 时浏览器会发起该 URL 请求） | 不适用 | `lib/pdf.ts:264-289`；`app/api/resumes/[resumeId]/pdf/route.ts:139-145` |
| 支付平台（mbd/afdian/alipay/wechat） | 当前**未实现下单**；仅定义回调契约（订单号、金额、渠道订单号） | 支付入账 | 未发生 | 代码未体现 | `lib/pay/index.ts:27-35,100-119,202-252`、`app/api/webhooks/payment/route.ts` |
| Lemon Squeezy（遗留） | 若被调用：邮箱、内部 user_id、订阅/客户 id | 历史订阅支付 | 境外（代码中的 API 域名 `api.lemonsqueezy.com`） | 代码未体现 | `lib/lemonSqueezy.ts:4,10-51`、`app/api/webhooks/lemon-squeezy/route.ts:1-9` |
| Google Fonts | 无运行时数据（字体在构建期下载，静态文件自托管） | 字体 | 无运行时跨境请求 | 不适用 | `app/layout.tsx:2,5-8`；`.next/static/media/*.woff2` |
| 分析/埋点/错误监控/CDN | **无** | — | — | — | `package.json:17-44`；全仓库检索无 analytics/sentry/posthog/gtag 等命中 |

> 说明：仓库没有任何供应商 DPA、SCC、数据处理条款链接或文本；`app/privacy/page.tsx` 也未列出供应商清单。**政策若写「不共享给第三方」，必须替换为「向以下受托处理方提供必要数据」并逐项披露**（数据实际流向见上表）。

---

## 5. 用户控制（实际实现 vs 缺失）

| 控制项 | 是否实现 | 证据与细节 |
|---|---|---|
| 账号注销 + 级联删除 | **已实现（有条件）** | `lib/actions.ts:405-461`：先删 Neon Auth 用户（`:421-435`），再删照片对象（`:437-444`，逐简历 `photo_key`，失败忽略），再连续 5 次删 `users` 触发级联（`:452-455`），最后登出（`:458`）。**依赖 `NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID`（`:409-418`），未配置则直接报错；这 3 个变量不在 `.env.example`。** 级联依赖外键：`drizzle/migrations/0000_smart_richard_fisk.sql:70-76`、`0001_clear_blonde_phantom.sql:82-87`、`0002_outgoing_morph.sql:22`。E2E 脚本存在但本次未运行：`scripts/verify/e2e-delete-account.mjs:79-91`。 |
| 注销时取消订阅 | **未实现** | `lib/actions.ts:446` 明写 `TODO M6`；`subscriptions` 表的 `ls_customer_id` 不会清理。 |
| 照片删除 | **仅删除本地预览；无服务器对象** | `components/editor/FormSections.tsx:834-838`（移除预览）；遗留 `lib/actions.ts:293` 删对象、`:319-322` 换图删旧对象（未校验归属）。现役删除简历不清理对象：`lib/workspace/actions.ts:249-259`。 |
| 数据导出 | **已实现（客户端 JSON，覆盖范围有限）** | `lib/mock/store.tsx:647-668`（把当前 `WorkspaceState` 序列化为 `jianli-data.json` 下载）；入口 `components/settings/SettingsScreen.tsx:1076-1087`、`components/app/AppShell.tsx:203`。**不含 `ai_rewrites` 审计快照，也不含照片二进制**；导出在本机完成，不上传。 |
| AI 审计查看/删除 | **未实现** | `ai_rewrites` 只有写入（`lib/ai/actions.ts:211-220`、`lib/actions.ts:360-366`），全仓库无读取/删除该表的用户入口。 |
| 单条数据删除 | **部分实现** | 简历：`components/...` → `lib/workspace/actions.ts:249-259`；岗位：`:321-331`；投递：`:384-395`；通知无删除入口（仅已读）：`:472-488`；偏好不能删除只能改：`:426-466`。 |
| 更正资料 | **已实现** | 设置页个人资料：`components/settings/SettingsScreen.tsx:120-189`；写库 `lib/workspace/actions.ts:401-424`。注意：**应用侧 `users.email` 可改，但登录邮箱（Neon Auth）不会同步改**（`lib/workspace/actions.ts:408` vs `app/sign-in/actions.ts:48`），会出现「资料邮箱 ≠ 登录邮箱」。 |
| 注册同意勾选 | **未实现（仅文字告知）** | `app/sign-up/[[...sign-up]]/page.tsx:35-39`（「注册即表示同意」+ 链接）；`app/sign-in/[[...sign-in]]/page.tsx:35-39`。无 checkbox、无单独弹窗、无同意记录字段（schema 无 consent 列）。 |
| 照片上传单独同意 | **未实现** | 照片区无勾选/弹窗（`components/editor/FormSections.tsx:864-928`）；但 `app/privacy/page.tsx:24` 与 `app/page.tsx:88` 对外称「上传前需要你的单独同意」，`plan.md:166,303` 也把它列为要求。 |
| 邮件/通知偏好开关 | **开关存在，但不触达发送** | `weeklyDigest`/`autoKeywordCheck` 存库：`lib/workspace/actions.ts:426-466`、`drizzle/schema.ts:231-232`；UI：`components/settings/SettingsScreen.tsx:463-481`。无邮件发送代码（见速览第 10 条）；`autoKeywordCheck` 未被业务读取。 |
| 注销入口可用性 | 存在 | 设置页「数据与隐私」：`components/settings/SettingsScreen.tsx:1137-1150,1165-1173`；调用 `deleteAccount`：`:1033-1059`。 |
| 隐私政策页面 | 存在但内容滞后 | `app/privacy/page.tsx:9-38`；至少有 5 处与代码不符，见 §9。 |

---

## 6. 数据保留期（代码实际逻辑）

| 数据 | 保留/过期逻辑 | 证据 |
|---|---|---|
| 简历、经历、教育、岗位、投递、通知、偏好、账户资料 | 账号存续期间保留；注销时随 `users` 级联删除 | 无过期字段：`drizzle/schema.ts:18-239`；级联：`drizzle/schema.ts:59,92,128,141,159,164,200,220,250,282,310,325-331` |
| 购买点数余额 | 有到期日：套餐 90/180/365 天；读取时惰性清零并写 `expire` 流水 | `lib/credits/catalog.ts:84-115`、`lib/credits/server.ts:113-141` |
| 每日免费额度计数 | 按 Asia/Shanghai 自然日惰性重置 | `lib/credits/server.ts:143-156,28-52` |
| 订单 (`orders`) | **无过期/清理**；注销时随 `users` 级联删除 | `drizzle/schema.ts:244-271`；`drizzle/migrations/0001_clear_blonde_phantom.sql:86` |
| 点数流水 (`credit_ledger`) | **无过期/清理**；注销时随 `users` 级联删除 | `drizzle/schema.ts:276-304`；`0002_outgoing_morph.sql:22` |
| AI 审计 (`ai_rewrites`) | **无过期/清理**；仅随用户/简历/经历级联删除 | `drizzle/schema.ts:321-339`；`0000_smart_richard_fisk.sql:70-72` |
| 会话 | 由 Neon Auth 托管；cookie 默认 7 天，实际 TTL 由托管配置决定（代码未体现） | `node_modules/better-auth/dist/cookies/index.mjs:49`、`lib/auth/server.ts:17-26` |
| Realtime capability | 60 秒后过期，客户端自动续签 | `node_modules/@neon/realtime/dist/server/capability/issuer.js:4`；`lib/realtime/use-live-workspace.tsx:143-156,335-347` |
| 演示种子数据 | 首登录/重置时写入，无过期 | `lib/workspace/load.ts:133-168`、`lib/workspace/seed.ts:48-220` |
| 定时清理/归档任务 | **代码未体现**：仓库无 cron/定时清理脚本或路由 | `package.json:5-16`（scripts 无清理任务）、`next.config.ts:1-25`（无 cron 配置）、`scripts/` 目录清单（无清理脚本） |
| Neon 备份/时间点恢复保留期 | **代码未体现**（Neon 控制台/套餐配置） | 无相关代码 |

> 结论：除「点数余额到期清零」外，**代码中不存在任何自动删除/匿名化/保留期到期机制**；注销是唯一的批量删除路径，且交易记录也被删除（与电商法留存要求存在冲突，见 `plan.md:113,312` 与 `app/privacy/page.tsx:32`）。

---

## 7. 浏览器存储、cookies 与 URL 数据

### 7.1 Cookies

| Cookie | 用途 | 证据 |
|---|---|---|
| `__Secure-neon-auth.session_token` | Neon Auth 会话令牌（签名/加密；`__Secure-` 表示仅 HTTPS） | 依赖代码：`node_modules/@neondatabase/auth/dist/server-i57Km2d6.mjs:328,336` |
| `__Secure-neon-auth.local.session_data` | 会话数据缓存（签名 JWT），由服务端自 session_token 派生 | 依赖代码：`node_modules/@neondatabase/auth/dist/server-i57Km2d6.mjs:330,668-719`；分片逻辑 `node_modules/better-auth/dist/cookies/session-store.mjs:29-44` |
| `__Secure-neon-auth.session_challenge` | OAuth 挑战 cookie（仅当启用 OAuth 流程时；当前 UI 只有邮箱密码登录，代码未体现 OAuth 入口） | 依赖代码：同上 `:331-334` |
| 其他 Cookie（分析/广告/偏好） | **无**：应用代码未设置任何业务 cookie | 全仓库检索 `document.cookie`/`cookies()`/`Set-Cookie` 无业务命中；仅 `proxy.ts:33-35` 转发 SDK 的 Set-Cookie |

### 7.2 localStorage / sessionStorage（实际键名）

| 键名 | 内容 | 证据 |
|---|---|---|
| `shell.sidebar.collapsed.v1` | 侧栏折叠状态（布尔） | `components/app/AppShell.tsx:258,265` |
| `editor.layout.v1` | 编辑器分栏宽度等布局状态 | `components/editor/useEditorLayout.ts:34,82,97` |
| `editor.collapsed-sections.v1` | 内容卡片折叠集合（区块 id 数组） | `components/editor/sectionCollapse.ts:7,13,18` |
| `editor.highlight-color.v1` | 高亮颜色偏好 | `components/editor/EditorScreen.tsx:65,263,269` |
| sessionStorage | **无使用** | 全仓库检索无命中 |
| 匿名草稿 | **未实现**：无匿名编辑入口，工作区数据由服务端 layout 注入；客户端不再读 localStorage 业务数据 | `lib/mock/store.tsx:143-144`；`app/(product)/layout.tsx:32-40` |
| 旧键 `jianli-demo-v1` | 仅文档提到（历史演示版），当前代码不再使用 | `docs/dashboard/README.md:60`（文档）；全仓库无该键的代码命中 |

> localStorage 工具注释明确「不存放简历内容」：`lib/ui/prefs.ts:1-4`。以上键均为 UI 偏好，不含个人信息；但它们属于终端本地数据，隐私政策如承诺「不写本地存储」需修正。

### 7.3 URL 查询参数

- `redirect_url`/`redirectTo`/`next`：登录回跳站内路径，做了开放重定向防护：`lib/auth/redirect.ts:1-24`、`proxy.ts:26-29`。
- 编辑器 `id`、`print=1`：`components/editor/EditorScreen.tsx:121-122`。
- 支付回跳 `?upgraded=1`：`lib/lemonSqueezy.ts:35`（遗留）。
- Realtime capability 不进 URL：`app/api/realtime/workspace/route.ts:22` 注释与实现。

---

## 8. 外部字体 / CDN / 分析 / 错误监控 / 埋点扫描结论

| 类别 | 结论 | 证据 |
|---|---|---|
| 字体 | `next/font/google` 在**构建期**下载并自托管为本地 `.woff2`；浏览器运行时不请求 Google。PDF 用系统中文字体栈 | `app/layout.tsx:2,5-8`；`.next/static/media/` 下存在 5 个 woff2 构建产物；`lib/pdf.ts:247-251`；`app/globals.css:1`、`app/app-ui.css:1` 无外部 `@import`/字体 URL |
| 图片 CDN | 无第三方图片 CDN；`next.config.ts` 未配置 `images.remotePatterns` | `next.config.ts:1-25`；`app/layout.tsx:20,26` 使用本地 `/og-hero.jpg` |
| 分析/埋点 | **无**（package.json 无 GA/PostHog/Umami/Clarity/Segment 等；源码检索无命中） | `package.json:17-44` |
| 错误监控 | **无**（无 Sentry/Datadog 等依赖或初始化） | `package.json:17-44` |
| 广告/第三方脚本 | **无**；`app/layout.tsx` 仅加载本地 CSS 与字体变量，无 `<Script>` | `app/layout.tsx:1-36` |
| 运行时外部域名（源码可见） | 仅：`api.deepseek.com`（`lib/ai/client.ts:18`）、`console.neon.tech`（注销管理 API，`lib/actions.ts:421`）、`api.lemonsqueezy.com`（遗留，`lib/lemonSqueezy.ts:4`）；其余均为环境变量配置的 Neon 端点 | 同左 |
| Cookie 同意 | **无 Cookie 同意弹窗/偏好中心**；只有必要鉴权 cookie | 全仓库无 consent 组件；`app/privacy/page.tsx` 无 cookie 章节 |

---

## 9. 与现有对外文案/计划的冲突清单（供政策修订）

| # | 对外表述 | 代码事实 | 建议 |
|---|---|---|---|
| 1 | 「全部数据存于中国大陆境内数据中心，不跨境」：`app/page.tsx:88`、`app/privacy/page.tsx:16`（`plan.md:150,341` 同） | 实际为 Neon 云服务，区域由部署配置决定；无代码/配置证据证明境内（§2.2） | 先确认 Neon 项目/桶/Auth/Realtime/Function 区域；否则改为如实披露跨境/境外处理，或迁移后再宣称 |
| 2 | 「AI 改写仅把当段经历与 JD 发送，不附带联系方式与照片」：`app/privacy/page.tsx:28` | 整份生成会发送**姓名 + 城市**，并发送教育/技能/全部经历：`lib/ai/prompts.ts:134-152`；`ai_rewrites.prompt` 还留存该内容：`lib/ai/actions.ts:200-224` | 按功能列出输入数据；明确「姓名/城市会发送，电话/邮箱/照片不发送」 |
| 3 | 「照片存于私有对象存储，仅在导出排版时临时读取」：`app/privacy/page.tsx:24` | 当前照片不上传、不落盘（`components/editor/FormSections.tsx:927`）；遗留上传路径**无签名 URL**，展示依赖公开前缀（§3.3） | 若保持现版本，写「照片仅在本机内存处理、不存储」；若启用上传，先实现私有读+短 TTL 签名 URL |
| 4 | 「上传前需要单独同意」：`app/page.tsx:88`、`app/privacy/page.tsx:24`、`plan.md:166,303` | 无任何同意勾选/弹窗/同意记录（§5） | 增加照片上传单独同意 UI，或删除该承诺 |
| 5 | 「交易记录依《电子商务法》另行留存」：`app/privacy/page.tsx:32` | `orders`/`credit_ledger` 随用户注销级联删除（§6）；`plan.md:113,312` 也承认 v1 级联删除 | 明确二选一：留存脱敏交易记录（需改 FK/删除逻辑），或如实写「注销即删除」并说明法律冲突处理 |
| 6 | 「不共享给第三方」：`app/privacy/page.tsx:20` | 数据实际流向 Neon（DB/Auth/Storage/Realtime/Functions）与 DeepSeek（§4） | 改为「向受托处理方提供必要数据」，逐项列供应商与用途 |
| 7 | 「邮件/每周提醒」暗示有邮件触达：`components/settings/SettingsScreen.tsx:469` | 无邮件发送实现；通知表只有演示数据（§5） | 删除邮件承诺，或实现发送后再写并补充退订机制 |
| 8 | plan 声称使用 Auth.js/阿里云 OSS/自建 Postgres（`plan.md:259-261,332-334`） | 代码使用 Neon Auth/Neon Storage/Neon Postgres（§2.1）；`.env.example:14-20` 还残留**未被代码使用的 Clerk 变量**，`.env.example` 未列 Neon Auth/Realtime/管理 API 变量 | 清理 `.env.example` 与计划文档，避免法务/运维误判 |
| 9 | 「数据可查阅、更正、删除、注销均可在设置页自助完成」：`app/privacy/page.tsx:36` | 删除仅覆盖简历/岗位/投递；通知、偏好、AI 审计无法单独删除；导出不含审计快照（§5） | 收窄表述或补齐功能 |

---

## 10. 需运营方/法务确认的开放问题（不要猜测）

1. **Neon 项目、Storage 桶、Auth、Realtime、Function 的实际区域**（以及是否使用 Neon 的跨区域备份）——决定「是否出境」与隐私政策的核心表述。
2. **部署平台与服务器所在区域**：仓库无部署清单；`docs/pricing/README.md:52,243` 只是成本假设（Vercel Pro），不能据此认定。若部署在境外平台，即使数据库在境内也需评估。
3. **DeepSeek 的数据处理与留存政策**（是否留存请求、是否用于训练、留存期限、是否签署数据处理协议）。
4. **是否启用照片上传**：当前未启用；一旦启用，需先补「私有读 + 签名 URL + 单独同意 + 删除级联」。
5. **注销管理凭证是否已配置**：`NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID` 不在 `.env.example`，未配置时注销会失败（`lib/actions.ts:409-418`）。
6. **交易记录留存策略**：与 `plan.md:113,312` 记录的法律冲突一致，需财务/法务定调。
7. **数据保留期限**：除点数到期外无任何自动清理；需人为定义并实现（或如实披露「账号存续期间保存」）。
8. **运营主体、联系方式、DPO/个人信息保护负责人、投诉渠道、适用法律与管辖**：代码与页面均未体现（`app/privacy/page.tsx:60` 仅写「随官网上线公布」）。
9. **Cookie/同类技术说明**：当前只有必要鉴权 cookie，但政策仍需披露（含 localStorage 偏好键，§7）。
10. **未成年人/年龄限制**：代码无年龄门槛或年龄声明（`app/sign-up` 仅邮箱/昵称/密码）。
11. **供应商 DPA/SCC 是否签署**：仓库无任何合同文本或链接（§4）。
12. **日志保留期限**：应用日志、Neon 日志、DeepSeek 日志均无代码侧保留控制（§3.5、§6）。

---

## 附录 A：证据索引（按主题）

- 数据模型：`drizzle/schema.ts:18-350`；迁移：`drizzle/migrations/0000_smart_richard_fisk.sql`、`0001_clear_blonde_phantom.sql`、`0002_outgoing_morph.sql`
- 数据库连接：`lib/db.ts:5`；工作区装配：`lib/workspace/load.ts:118-332`；写入：`lib/workspace/actions.ts:122-633`
- 认证：`lib/auth/server.ts:17-48`、`lib/auth/session.ts:17-28`、`lib/auth/client.ts:11`、`lib/dal.ts:14-24`、`proxy.ts:1-41`、`app/api/auth/[...path]/route.ts:9`
- 照片/存储：`lib/storage.ts:1-44`、`lib/actions.ts:77-81,284-325,437-444`、`components/editor/FormSections.tsx:782-933`
- AI：`lib/ai/client.ts:1-271`、`lib/ai/prompts.ts:1-388`、`lib/ai/actions.ts:1-600`、`lib/ai.ts:13-53`、`lib/actions.ts:327-369`
- 计费/订单：`lib/credits/catalog.ts:1-209`、`lib/credits/server.ts:1-496`、`lib/pay/index.ts:1-252`、`app/api/webhooks/payment/route.ts:1-84`、`lib/workspace/actions.ts:490-633`
- Realtime：`lib/realtime/server.ts:1-134`、`lib/realtime/client.ts:1-26`、`lib/realtime/use-live-workspace.tsx:1-347`、`app/api/realtime/workspace/route.ts:1-33`
- 注销/导出：`lib/actions.ts:390-461`、`lib/mock/store.tsx:647-668`、`components/settings/SettingsScreen.tsx:1013-1176`
- 浏览器存储：`lib/ui/prefs.ts:1-42`、`components/app/AppShell.tsx:258-265`、`components/editor/EditorScreen.tsx:65,263-269`、`components/editor/useEditorLayout.ts:34,82-97`、`components/editor/sectionCollapse.ts:7-18`
- 字体/外部资源：`app/layout.tsx:1-36`、`next.config.ts:1-25`、`package.json:17-44`、`.next/static/media/`
- 计划 vs 实际：`plan.md:113,150,165-166,228,259-261,303,312,321,332-334,340-341,362-366`、`docs/pricing/README.md:40,52,243`、`.env.example:1-48`

> **审计限制**：本报告只覆盖仓库内代码与文档；未运行应用、未登录、未读取任何环境变量值、未验证 Neon/DeepSeek 控制台配置。所有「代码未体现」项必须由运营方以部署事实补全，或由工程师补实现后再写入隐私政策。
