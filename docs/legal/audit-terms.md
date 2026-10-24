# 服务条款（ToS）事实审计

- **审计对象**：`.`（中文 AI 简历编辑器，Next.js 16 + Neon + DeepSeek + 点数计费）
- **审计时间**：2026-10-25（Asia/Shanghai）
- **审计基线**：仓库当前工作树，HEAD = `664110f`（`git log --oneline -1`）
- **审计方式**：只读代码/文档检索；**未读取 `.env.local` 及任何密钥文件**，未执行支付、写库、部署命令，未修改除本文件外的任何文件。
- **证据约定**：每条事实后用 `` `路径:行号` `` 给出代码证据；无法从代码确定的一律标注「**代码未体现**」，不猜测。
- **用途**：作为起草 ToS 的事实底稿；同时标注代码/营销文案之间的**矛盾点**，这些矛盾若照抄进 ToS 会形成不实陈述。

> 说明：`plan.md`、`docs/` 中的内容属于**产品计划/建议**，不等于已实现。本审计把「代码已实现」「文档声称」「计划建议」分开标注。

---

## 0. 关键结论（最影响条款的 15 条）

1. **实际是「登录后使用」产品，不是匿名产品**：全部产品页（工作台/简历库/目标岗位/投递追踪/编辑器/设置）由 `proxy.ts` matcher + `requireUser()` 双重保护，匿名只能看落地页与隐私政策。这与 `plan.md` 的「匿名编辑 + localStorage 草稿」计划不一致（`proxy.ts:39-41`、`app/(product)/layout.tsx:32-49`、`lib/dal.ts:19-24`、`app/page.tsx:280-285`）。
2. **真实支付尚未接入**：支付适配层只有 `manual`（本机沙箱）会真正到账；`mbd/afdian/alipay/wechat` 均返回「支付渠道尚未接入」，且仓库内无各渠道适配器文件（`lib/pay/index.ts:27-55`、`lib/pay/index.ts:150-164`、`lib/pay/` 目录仅 `index.ts`）。落地页也自述「演示环境，付款为沙箱模拟」（`app/page.tsx:512-519`）。
3. **计费模型是「每日免费点数 + 一次性点数包」**：每日免费 5 点；整份生成 2 点、单段润色/技能/总结/JD 改写各 1 点、PDF 导出免费；先扣当日免费再扣购买余额；套餐一次性购买、**不自动续费**（`lib/credits/catalog.ts:14-57`、`:62`、`:84-115`、`:209`；`lib/credits/server.ts:189-277`）。
4. **点数有效期 90/180/365 天，过期惰性清零且写 `expire` 流水**；无到期提醒、无延期、无用户自助退款入口（`lib/credits/catalog.ts:84-115`、`lib/credits/server.ts:120-141`；退款建议仅见 `docs/pricing/README.md:436-440`）。
5. **AI 调用失败/解析失败自动按原路退点**；未配置 DeepSeek Key 时**不扣点**直接报错；输出会**自动写入当前简历草稿**，没有人工审核环节（`lib/ai/actions.ts:245-358`、`:389-416`、`components/editor/EditorScreen.tsx:475-518`）。
6. **AI 内容会发送给 DeepSeek 境内 API**：整份生成会把姓名、城市、总结、技能、全部经历、教育经历与 JD 一起发送；单段润色会发送该段经历 + 简历总结/技能 + JD（`lib/ai/client.ts:18`、`:203-231`；`lib/ai/prompts.ts:134-152`、`:180-196`、`:224-242`、`:268-281`、`:308-320`）。
7. **AI 输入/输出/JD 被持久化到 `ai_rewrites` 审计表**（`jd_snapshot/prompt/output/model`），随账号注销级联删除（`lib/ai/actions.ts:200-224`、`drizzle/schema.ts:321-339`、`:323-328`）。
8. **AI 没有「AI 辅助」标识**：全仓无「AI 辅助/AI 生成标识」字样，PDF 模板也不含任何 AI 声明；而 `plan.md` 明确要求「编辑页与 PDF 页脚标注 AI 辅助改写」（`plan.md:151`、`docs/hero-visual/05-acceptance.md:163`；`lib/pdf.ts` 无相关字样，`components/resume/` 检索无命中）。
9. **账号注销实现存在但依赖服务端管理凭证**：缺 `NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID` 时注销直接失败；成功路径为删 Neon Auth 用户 → 尽力删照片 → 删 `users`（级联全部业务表）→ 登出（`lib/actions.ts:405-461`、`components/settings/SettingsScreen.tsx:1033-1059`）。
10. **订单不保留**：`orders.user_id` 外键为 `ON DELETE CASCADE`，注销会连订单一起删除，这与隐私政策页「交易记录依《电子商务法》另行留存」的表述冲突（`drizzle/schema.ts:244-251`、`app/privacy/page.tsx:31-33`）。
11. **没有封禁/暂停账号能力**：`users` 表无状态/封禁字段，无后台管理路由，无违规处置实现（`drizzle/schema.ts:18-48`；全仓 `admin|封禁|suspend` 检索无管理实现）。
12. **「数据全部境内存储、不跨境」的营销声明无法由代码证实**：实现使用 Neon（Postgres/Auth/Storage/Realtime/Functions）云服务，仓库看不到托管区域配置（`lib/db.ts:1-7`、`lib/auth/server.ts:3,17-26`、`lib/storage.ts:9-20`、`lib/realtime/client.ts:15-25`、`neon.ts:5-14`）；而落地页/隐私页宣称境内数据中心（`app/page.tsx:71-74`、`:87-89`、`app/privacy/page.tsx:15-17`）。**Neon 的实际数据驻留区域：代码未体现**。
13. **照片当前不上传、不保存**：编辑器照片仅 FileReader 本地预览（≤4MB、image/*），随 PDF 导出时以 data URL 传给服务端渲染；旧的 5MB/jpg/png/webp 上传通道存在但当前 UI 未接入（`components/editor/FormSections.tsx:801-832`、`:844`、`:927`、`:992-998`、`lib/storage.ts:22-23`、`lib/actions.ts:300-325`）。
14. **没有限流**：应用层无登录/注册/AI/导出限流；仅有上游 Neon Auth 的限流错误映射与「点数」这一经济约束（`app/sign-in/actions.ts:27-29`、`app/sign-up/actions.ts:31-33`；`docs/credits/README.md:131`；`plan.md:266`、`:282-283` 列为未完成）。
15. **ToS 本体及同意机制完全缺失**：代码（`app/`、`components/`、`lib/`）中无 `/terms` 页面与链接；注册页只链《隐私政策》（`app/sign-up/[[...sign-up]]/page.tsx:33-41`、`app/sign-in/[[...sign-in]]/page.tsx:33-40`），无勾选同意、无 ToS 页面；文档中只有「应新增用户协议」的建议（`docs/pricing/README.md:430`）。

---

## 1. 服务内容与边界

### 1.1 落地页（公开，无需登录）

- 定位与卖点：填简历 → 粘贴 JD → 逐段改写 → 导出 A4 PDF → 投递追踪（`app/page.tsx:15-28`、`:58-79`；`README.md:3`）。
- 展示的能力卡片：关键词匹配、量化表达、A4 导出、境内存储、注销即删（`app/page.tsx:58-79`）。
- 展示的价格与规则来自 `lib/credits/catalog.ts`，无硬编码价格（`app/page.tsx:4-13`、`:393-523`）。
- 页面 CTA 全部指向 `/editor`（需登录），登录入口指向 `/dashboard`（`components/landing/Hero.tsx:73`、`:105`、`app/page.tsx:280-285`、`:424-429`）。
- 落地页自述「当前为产品演示环境，付款为沙箱模拟，不产生真实扣款」（`app/page.tsx:512-519`）。
- FAQ 自述「当前版本提供一套干净的 A4 模板」（`app/page.tsx:90-93`）——**与代码不符**：实现有 3 套版式模板 + 3 种主色（`lib/mock/templates.ts:3-33`、`components/editor/TemplateDialog.tsx:65-90`）。
- 页脚：品牌名「AI 简历编辑器」、ICP/公安备案号为「预留位」、反馈邮箱「随官网上线公布」（`app/page.tsx:586-601`）。

### 1.2 登录后功能（工作台区域）

入口与信息架构（`components/app/AppShell.tsx:16-20`）：

| 功能 | 实际实现 | 证据 |
|---|---|---|
| 工作台概览 | 简历/岗位/投递统计、匹配度展示 | `app/(product)/dashboard/page.tsx:1-5`、`components/dashboard/OverviewScreen.tsx:187` |
| 简历库 | 多份简历列表、状态（draft/ready/applied/archived）、匹配度 | `drizzle/schema.ts:110-111`、`app/(product)/dashboard/resumes/page.tsx:1-5`、`components/resumes/ResumeCard.tsx:172` |
| 目标岗位（JD 收藏） | 手动粘贴/保存岗位与 JD 文本，自动提取关键词（Neon Function，确定性算法） | `drizzle/schema.ts:53-80`、`lib/workspace/actions.ts:266-319`、`lib/functions/extract-keywords.ts:1-14` |
| 编辑器 | 五类字段（联系方式/总结/经历/教育/技能）+ 本地照片预览、A4 实时预览、模板/主色、自动保存（600ms） | `components/editor/EditorScreen.tsx:999-1001`、`components/editor/FormSections.tsx:840-845`、`lib/workspace/actions.ts:122-247` |
| AI 能力 | 整份生成（2 点）、单段经历润色（1 点）、技能整理（1 点）、自我总结润色（1 点）、对照 JD 单段改写（1 点，**服务端已实现但当前 UI 无入口**） | `lib/ai/actions.ts:375-419`、`:425-480`、`:486-513`、`:519-546`、`:552-600`；`components/editor/EditorScreen.tsx:490`、`:562`；`components/editor/RewriteDialog.tsx:14`、`:115`、`:135`（`rewriteJdAction` 未被任何组件引用） |
| PDF 导出 | 服务端 Playwright Chromium 渲染 A4；免费、不限次数；只校验简历归属 | `app/api/resumes/[resumeId]/pdf/route.ts:77-124`、`:175-236`、`lib/pdf.ts:264-289` |
| 投递追踪 | 手动记录投递（公司/岗位/关联简历/阶段/下一步/备注），阶段枚举 applied/read/interview/offer/rejected | `drizzle/schema.ts:153-188`、`lib/workspace/actions.ts:337-395`、`app/(product)/dashboard/applications/page.tsx:1-11` |
| 站内通知 | 通知列表 + 已读/全部已读；实时同步；**没有运行时生成通知的逻辑**（仅首登录种子数据） | `drizzle/schema.ts:193-212`、`lib/workspace/actions.ts:472-488`、`lib/workspace/seed.ts:113-120`、`lib/workspace/load.ts:170-192` |
| 设置 | 个人资料、求职偏好、点数与套餐、订单记录、点数流水、数据导出、注销 | `components/settings/SettingsScreen.tsx:41-48`、`:1180-1229` |

- 规则型「匹配度」（关键词命中/完整度）存在，是确定性计算而非 AI：`lib/mock/compute.ts:98-124`、`:153`；编辑器展示：`components/editor/JDPanel.tsx:32-34`、`components/editor/EditorScreen.tsx:795`。
- 无「简历文件导入/解析」入口（全仓 `docx|导入简历|解析简历|parseResume` 检索无命中）；无求职信、无英文简历、无公开分享/团队协作（全仓 `share|分享|批量|cover letter|英文` 检索无产品实现）。

### 1.3 匿名可用范围（实际）

- 可匿名访问：落地页 `/`、隐私政策 `/privacy`、登录/注册页、Neon Auth 代理路由、支付回调 webhook（`app/privacy/page.tsx:40-64`、`app/sign-in/[[...sign-in]]/page.tsx:24-48`、`app/sign-up/[[...sign-up]]/page.tsx:24-48`、`app/api/auth/[...path]/route.ts:1-9`、`app/api/webhooks/payment/route.ts:41-84`）。
- **不可匿名**：`/dashboard/*`、`/editor/*`、`/settings/*` 被 `proxy.ts` 拦截并回跳登录；服务端 `requireUser()` 再次兜底（`proxy.ts:9`、`:39-41`、`app/(product)/layout.tsx:32-39`、`lib/dal.ts:19-24`）。
- 因此 `plan.md` 中的「新访客无需登录进编辑器 / 匿名草稿存 localStorage」在**当前代码中不存在**（`plan.md:52-60` 为计划，非实现）。

### 1.4 v1 明确不提供（代码/计划可证）

- 无真实在线收款（见 3.5）、无自动续费/订阅（`lib/credits/catalog.ts:10`、`:64`、`drizzle/schema.ts:32`）。
- 无找回密码、无邮箱验证页、无手机号/短信、无第三方 OAuth 登录（`components/auth/SignInForm.tsx:16-54` 仅邮箱+密码；全仓无 reset/verify/oauth 产品实现；`plan.md:46`、`:156`、`:321` 亦写明 v1 不做短信/微信登录）。
- 无 API/开放平台、无移动 App、无批量投递、无团队共享、无多语言/英文简历、无自建客服工单（全仓检索无对应实现；`plan.md:46`）。
- 无后台管理/运营端（全仓无 admin 路由；`app/` 目录清单可证）。
- 无真实 AI 流式输出（一次性返回：`lib/ai/client.ts:217-231`）。
- 无 PDF 之外的导出格式（路由仅 `app/api/resumes/[resumeId]/pdf/route.ts`）。
- 无用户自助退款/发票功能（`components/settings/SettingsScreen.tsx` 无相关 UI；支付回调退款仅记录：`app/api/webhooks/payment/route.ts:63-66`）。

---

## 2. 账号与认证

### 2.1 认证服务与方式

- 使用 **Neon Auth（Managed Better Auth）**，不是自建邮箱密码体系：`lib/auth/server.ts:3-26`（`createNeonAuth`）、`lib/auth/client.ts:1-11`（同源 `/api/auth` 代理）、`app/api/auth/[...path]/route.ts:1-9`（`auth.handler()`）。
- 登录：邮箱 + 密码，调用 `auth.signIn.email()`（`app/sign-in/actions.ts:36-52`）。
- 注册：邮箱 + 密码（可选昵称），密码最少 8 位，调用 `auth.signUp.email()`（`app/sign-up/actions.ts:40-62`；前端 `minLength={8}`：`components/auth/SignUpForm.tsx:58-67`）。
- 登出：`authClient.signOut()`（`components/app/AppShell.tsx:205-212`、`:680-686`；`components/settings/SettingsScreen.tsx:1047`）。
- 密码由 Neon Auth 托管、应用不存明文：注册页文案亦有声明（`app/sign-up/[[...sign-up]]/page.tsx:39`）。

### 2.2 邮箱验证 / 找回密码 / 会话时长 / 多设备

- **邮箱验证**：应用无验证页/验证流程；仅在登录错误映射中处理 `email_not_confirmed/email_not_verified`（`app/sign-in/actions.ts:24-26`）。是否强制验证取决于 Neon Auth 项目配置，**代码未体现**。
- **找回密码**：无入口、无路由、无页面（`components/auth/SignInForm.tsx:16-54` 无「忘记密码」链接；全仓无 reset 实现）。**代码未体现**；`plan.md:156` 曾计划 DirectMail 发信，但当前实现基于 Neon Auth，未落地。
- **会话时长**：应用侧只配置了 cookie 加密 secret，未配置 `maxAge`/过期时间（`lib/auth/server.ts:17-26`）；会话策略由 Neon Auth 托管，**代码未体现**。代码注释提到 Neon Auth cookie 内有「默认 5 分钟」短时缓存（`lib/workspace/load.ts:71-72`），非会话总时长。
- **多设备/并发会话**：代码未限制登录设备数或会话数；且实现了跨端实时刷新（`lib/mock/store.tsx:205` 注释、`lib/realtime/use-live-workspace.tsx:52-80`）。**是否有并发上限：代码未体现**（取决于 Neon Auth 配置）。
- **账号共享限制**：无设备绑定、无席位、无共享检测、无同账号互斥；同一账号并发编辑采用「最后写入覆盖」（`lib/workspace/actions.ts:122-161`）。**代码未体现任何账号共享限制**。

### 2.3 用户资料字段

- `users` 表：`email`、`name`、`phone`、`city`、`target_role`、`joined_at`、`plan*`、`credits*`（`drizzle/schema.ts:18-48`）。
- 设置页可编辑：姓名、邮箱、电话、城市、目标职位（`components/settings/SettingsScreen.tsx:89-109`、`lib/workspace/actions.ts:401-424`）。
- **注意**：设置页修改「邮箱」只更新应用侧 `users.email`，**不修改 Neon Auth 登录邮箱**（`lib/workspace/actions.ts:401-424`），因此登录凭据邮箱与展示邮箱可能不一致——ToS/账号条款需明确以哪个为准。
- 求职偏好：目标岗位、城市、薪资、工作类型、每周提醒开关、自动关键词检查（`drizzle/schema.ts:217-239`、`components/settings/SettingsScreen.tsx:346-489`）。
- 「每周求职提醒（发送到你的邮箱）」开关存在，但**没有发信实现**（全仓无 SMTP/邮件 SDK；`weeklyDigest` 仅存字段：`drizzle/schema.ts:231`、`lib/workspace/actions.ts:426-470`、`components/settings/SettingsScreen.tsx:462-470`）。

---

## 3. 计费、点数与支付

### 3.1 规则与价格（唯一事实源 `lib/credits/catalog.ts`）

| 项目 | 事实 | 证据 |
|---|---|---|
| 计费单位 | 点数；所有 AI 能力按点计费，PDF 免费 | `lib/credits/catalog.ts:7-11` |
| 整份生成/整份润色 | 2 点 | `lib/credits/catalog.ts:16-21` |
| 经历润色 / 技能优化 / 总结润色 / JD 改写 | 各 1 点 | `lib/credits/catalog.ts:23-49` |
| PDF 导出 | 0 点、不限次数 | `lib/credits/catalog.ts:50-56` |
| 每日免费额度 | 5 点/自然日（Asia/Shanghai 00:00 重置，不累积、不可转赠） | `lib/credits/catalog.ts:61-62`、`:209`；实现 `lib/credits/server.ts:143-156`、`:37-52` |
| 扣减顺序 | 先扣当日免费，不足再扣购买余额；不足则整笔失败（不部分扣减） | `lib/credits/server.ts:189-259` |
| 体验包 | ¥9.90 / 12 点 / 90 天 | `lib/credits/catalog.ts:85-94` |
| 求职包（推荐） | ¥29.90 / 45 点 / 180 天 | `lib/credits/catalog.ts:95-105` |
| 冲刺包 | ¥69.00 / 120 点 / 365 天 | `lib/credits/catalog.ts:106-114` |
| 有效期续期规则 | 再次购买时到期日 = `max(now, 当前到期) + validityDays`（合并为一个余额池） | `lib/credits/server.ts:323-372` |
| 过期处理 | 读取/扣费时惰性清零并写 `expire` 流水；无提醒、无延期 | `lib/credits/server.ts:108-141` |
| 自动续费 | 无；套餐均为一次性购买 | `lib/credits/catalog.ts:10`、`:64`、`:92`、`:102`、`:113`；`drizzle/schema.ts:32` |

### 3.2 扣点与失败补偿

- AI 预扣 → 调模型 → 失败/解析失败按「原路」退回（免费额度还回当日已用、余额还回余额；跨天时免费部分折为余额）（`lib/ai/actions.ts:258-331`、`lib/credits/server.ts:398-473`）。
- 未配置 DeepSeek Key：在扣点**之前**拦截，不扣点（`lib/ai/actions.ts:249-256`、`lib/ai/client.ts:86-92`）。
- 余额不足：返回明确错误文案（含可用点数拆分），不调用 AI（`lib/credits/server.ts:264-277`、`lib/ai/actions.ts:263-269`）。
- 每次扣点/退点/过期都写 `credit_ledger`（`lib/credits/server.ts:83-106`、`:283-291`、`:385-393`、`:462-472`）。
- 失败的写流水容错：流水失败不阻断业务（`lib/credits/server.ts:102-105`、`lib/ai/actions.ts:221-223`）。

### 3.3 订单与订单状态

- 订单表字段：金额（分）、label、`status`（`pending/paid/refunded/cancelled`）、`package_id`、`credits`、`provider`、`provider_order_id`、`paid_at`（`drizzle/schema.ts:244-271`；`lib/pay/index.ts:57-68`）。
- 注意：`orders.status` 数据库默认值为 `paid`（`drizzle/schema.ts:254-255`），非 `pending`，属实现细节/潜在风险。
- 设置页展示订单记录，`paid` 显示「已支付」，其他状态显示原始英文（`components/settings/SettingsScreen.tsx:907-970`）。
- 订单在账号注销时**级联删除**（`drizzle/schema.ts:248-250`），与 `app/privacy/page.tsx:31-33` 的「交易记录另行留存」冲突。

### 3.4 退款

- **用户侧无退款入口/退款政策实现**（设置页无退款 UI；全仓无 refund 请求接口）。
- 支付回调支持 `status: "refunded"`，但仅返回 `refund_manual_review`，**不自动扣回点数、不改订单状态**（`app/api/webhooks/payment/route.ts:63-66`）。
- 只有「AI 失败补偿」是自动退款（见 3.2）。
- 文档建议的「未消耗点数 7 日内可退、过期不退可申请一次延期」**未实现**（`docs/pricing/README.md:436-440`、`docs/credits/README.md:128-131`）。

### 3.5 支付渠道与可达性

- 渠道枚举：`manual`（本机沙箱）、`mbd`（面包多Pay）、`afdian`（爱发电）、`alipay`、`wechat`（`lib/pay/index.ts:27-35`）。
- 渠道选择：`PAY_PROVIDER`；未配置时开发环境 `manual`、生产缺省 `mbd`（`lib/pay/index.ts:42-47`）。
- **只有 `manual` 会真正到账**；其余渠道在 `purchaseCreditPackage` 中直接返回 `payment_not_configured`（`lib/pay/index.ts:150-164`）。仓库内无 `mbdpay.ts/afdian.ts/alipay.ts/wechat.ts` 适配器（`lib/pay/` 仅 `index.ts`）。
- `manual` 在生产需显式 `PAY_ALLOW_MANUAL=1`，否则拒绝（`lib/pay/index.ts:49-55`、`:158-164`）。
- 外部回调统一 `POST /api/webhooks/payment`：HMAC-SHA256(rawBody, `PAY_WEBHOOK_SECRET`)、`timingSafeEqual` 验签、幂等 `pending→paid`、金额不一致拒绝（`app/api/webhooks/payment/route.ts:22-31`、`:41-84`、`lib/pay/index.ts:203-252`）。
- **自动续费**：无。`users.auto_renew` 默认 false 且无置 true 的调用；旧 30 天通行证续费 action 仍在但 UI 无入口（`drizzle/schema.ts:32`、`lib/workspace/actions.ts:490-561`、`lib/mock/store.tsx:502-536`；`renewPlan` 未被任何组件调用）。
- **Lemon Squeezy 残留仍可达**：`app/api/webhooks/lemon-squeezy/route.ts` 标注 `@deprecated` 但 POST 处理器仍有效，验签后会把 `users.plan` 置为 paid/free（`app/api/webhooks/lemon-squeezy/route.ts:1-8`、`:19-70`）；`lib/lemonSqueezy.ts` 仍可创建 LS checkout（`lib/lemonSqueezy.ts:10-51`），`createCheckoutAction` 仍导出但只被未挂载的旧组件 `SettingsView` 引用（`lib/actions.ts:378-388`、`components/settings/SettingsView.tsx:6`、`:28-38`；`app/settings/page.tsx:1-8` 已重定向到新设置页）。`subscriptions` 表保留未使用（`drizzle/schema.ts:306-319`、`docs/credits/README.md:132-133`）。**ToS 不应再写 Lemon Squeezy/订阅**；但需在工程上确认该回调已禁用或环境变量未配置。

### 3.6 演示/首登录数据（影响条款表述）

- 首次登录会自动写入演示种子：示例简历、岗位、投递、通知，并给演示点数余额 18 点、`plan=paid`、到期 2027-04-04（`lib/workspace/load.ts:114-168`、`lib/workspace/seed.ts:44-120`、`lib/mock/data.ts:60-98`）。
- 「重置演示数据」会清空该用户业务数据并把点数/套餐恢复为示例值（`lib/workspace/actions.ts:85-106`、`lib/workspace/seed.ts:33-42`）。
- 因此 ToS 若描述「新用户初始状态」，需与产品或演示环境口径对齐（当前是**演示数据 + 演示点数**，不是空账号）。

---

## 4. 用户内容、归属与授权

### 4.1 用户内容范围

- 简历内容（姓名、电话、邮箱、城市、总结、技能、经历、教育）、照片（当前仅本地）、JD 文本、投递记录、偏好、账号资料（`drizzle/schema.ts:18-48`、`:86-148`、`:53-80`、`:153-188`、`:217-239`）。
- 投递记录强制关联本账号的简历（`lib/workspace/actions.ts:337-347`）；岗位/简历/投递的读写都按 `userId` 过滤（`lib/workspace/actions.ts:112-120`、`:122-161`、`:266-331`、`:337-395`；`lib/ai/actions.ts:108-149`）。

### 4.2 代码是否要求用户授予许可

- **没有**任何用户内容授权条款、勾选或服务端记录（全仓无 ToS/授权/许可文本；注册仅「注册即表示同意《隐私政策》」：`app/sign-up/[[...sign-up]]/page.tsx:33-41`）。用户内容许可只能由新起草的 ToS 确立，**代码未体现任何既有授权要求**。
- 照片上传处也没有「单独同意」勾选（当前照片根本不上传：`components/editor/FormSections.tsx:840-845`、`:927`；`plan.md:166` 要求单独同意，但未实现）。

### 4.3 AI 输入/输出如何处理

- 发送第三方：DeepSeek（`https://api.deepseek.com`），默认模型 `deepseek-chat`（`lib/ai/client.ts:18-19`、`:97-101`、`:203-231`）。
- 发送内容：见结论 6；**不发送电话、邮箱、照片**（prompts 中无这些字段：`lib/ai/prompts.ts:31-44`、`:134-152`、`:180-196`）。但整份生成会发送**姓名、城市、教育经历**，与隐私政策「仅把当段经历与目标 JD 文本发送」的表述不完全一致（`app/privacy/page.tsx:27-29`）。
- 服务端持久化：`ai_rewrites` 存 `jd_snapshot`、`prompt`（完整 user prompt）、`output`、`model`，截断上限 8000/8000/12000 字符（`lib/ai/actions.ts:200-224`、`drizzle/schema.ts:321-339`）。
- 旧兼容路径 `rewriteExperienceAction` 也写 `ai_rewrites`（`lib/actions.ts:360-366`），但当前编辑器不使用（仅 `docs/dashboard/_legacy/` 引用）。
- **是否用于模型训练**：代码中**没有任何**用用户数据训练、微调、语料导出、共享给第三方的逻辑（`ai_rewrites` 仅写入/不读取，除随账号删除外无导出路径；`lib/ai/actions.ts:200-224`）。但 DeepSeek 侧是否留存/训练**代码未体现**，仅文档提示「以 DeepSeek 服务条款为准，待核实」（`docs/pricing/README.md:442-447`）。

### 4.4 删除/导出能力

- 删除单份简历：`deleteResume` 删照片（若存在）再删 DB（`lib/actions.ts:284-297`）；岗位/投递可单条删除（`lib/workspace/actions.ts:321-331`、`:384-395`）。
- 导出：设置页「导出我的数据」是**浏览器端**把当前 workspace 状态序列化为 JSON 下载（含简历、岗位、投递、通知、偏好、订单信息），不是服务端全量导出（`lib/mock/store.tsx:647-668`、`components/settings/SettingsScreen.tsx:1076-1088`）。
- 注销：见 8。
- 无「申请删除/更正」人工通道，也无 AI 历史记录（`ai_rewrites`）导出入口——**代码未体现**。

---

## 5. AI 输出、模型与免责相关事实

- **模型**：`DEEPSEEK_MODEL`，缺省 `deepseek-chat`；`AI_MOCK=1` 时用 `deepseek-mock` 本地演示（不联网，仍扣点）（`lib/ai/client.ts:18-19`、`:78-81`、`:86-92`、`:191-201`）。`plan.md` 提到 `deepseek-flash`，与代码缺省不一致，实际以环境变量为准（`plan.md:158`）。
- **超时**：45 秒；**重试**：仅网络/5xx 重试 1 次（共 2 次尝试），401/403/429/超时不重试（`lib/ai/client.ts:22-26`、`:108-153`、`:213-265`）。
- **失败退款**：调用失败/空响应/解析失败均自动退点（`lib/ai/actions.ts:287-331`）。
- **输出应用**：AI 结果由前端直接写入当前草稿并触发保存，用户可继续编辑；整份生成亦直接覆盖 summary/skills/经历描述（`components/editor/EditorScreen.tsx:415-436`、`:504-518`；`components/editor/RewriteDialog.tsx` 逻辑同）。
- **无人工审核**：无审核队列/人工复核/发布前拦截（全仓无 review/审核实现）。
- **AI 标识**：无。编辑器只显示「AI 生成整份简历（2 点）」「AI 润色（1 点）」等功能标签（`components/editor/EditorScreen.tsx:930-966`、`components/editor/FormSections.tsx:196-220`、`:415-425`），**不是**《AI 生成合成内容标识办法》意义上的内容标识；PDF 无任何标识（`lib/pdf.ts` 无 AI 字样；`components/resume/` 检索无命中）。`plan.md:151` 与验收文档要求「编辑页/PDF 页脚 AI 辅助改写」，**未落地**（`docs/hero-visual/05-acceptance.md:163`）。
- **免责提示**：落地页有「AI 只做组织与润色、不编造、真实性由用户负责」的 FAQ（`app/page.tsx:82-85`）；系统提示词也约束模型不编造（`lib/ai/prompts.ts:53-61`），但这些都不构成服务端免责声明，ToS 需另行撰写。

---

## 6. 第三方服务清单与条款入口

| 第三方 | 在代码中的角色 | 证据 | 仓库内是否有其服务条款链接 |
|---|---|---|---|
| **Neon** | Postgres（HTTP driver）、Auth、Storage（S3 兼容）、Realtime（浏览器 wss）、Functions（JD 关键词） | `lib/db.ts:1-7`、`lib/auth/server.ts:3`、`lib/storage.ts:9-20`、`lib/realtime/server.ts:34-38`、`lib/realtime/client.ts:15-25`、`neon.ts:5-14` | **无**（只有管理 API endpoint：`lib/actions.ts:421`） |
| **DeepSeek** | AI 文本生成（OpenAI 兼容 SDK） | `lib/ai/client.ts:18`、`:97-101`、`:203-231` | **无 ToS 链接**；仅有定价/限流文档链接（`docs/pricing/README.md:33`、`:127`、`:460`、`plan.md:338`） |
| **面包多Pay / 爱发电 / 支付宝 / 微信支付** | 支付渠道枚举与回调契约；真实通道未接入 | `lib/pay/index.ts:14-35`、`:150-164`；`app/api/webhooks/payment/route.ts:5-22` | **无**；仅有费率/文档链接（`plan.md:331`、`docs/pricing/README.md:37-38`、`:66`） |
| **Lemon Squeezy（历史）** | 旧订阅回调/checkout 残留 | `app/api/webhooks/lemon-squeezy/route.ts:1-70`、`lib/lemonSqueezy.ts:4-51`、`drizzle/schema.ts:306-319` | **无** |
| **Google Fonts（next/font）** | `Geist` 字体；构建期由 Next 拉取并自托管 | `app/layout.tsx:2`、`:5-8`；运行期无远程字体引用（`app/globals.css:1` 仅 Tailwind import） | **无** |
| **Playwright / Chromium** | 服务端本地渲染 PDF（非云服务） | `lib/pdf.ts:275-289` | 不适用（本地依赖） |
| **npm 开源依赖** | Next/React/Drizzle/OpenAI SDK/AWS S3 SDK/@neon 系列等 | `package.json:17-33` | **无**（仓库无第三方许可清单） |
| **Neon Function `keywords`** | 确定性关键词提取（无外部 API） | `functions/extract-keywords.ts:1-14`、`neon.ts:9-14` | 不适用 |

- 浏览器端还会直接连 Neon Realtime 的 `wss://` 地址（`NEXT_PUBLIC_NEON_REALTIME_URL`），即终端用户 IP 会被 Neon Realtime 侧看到（`lib/realtime/client.ts:15-25`）。
- 代码/文档中**没有出现任何一家第三方的正式服务条款 URL**；ToS 若做「第三方服务」章节，链接需由法务/运营补充，不能从仓库取材。

---

## 7. 使用限制、配额与防滥用（代码实际强制的）

| 限制 | 是否强制 | 证据 |
|---|---|---|
| 点数不足拦截 | 是（原子 SQL，整笔失败） | `lib/credits/server.ts:189-277`、`lib/ai/actions.ts:258-271` |
| 每日免费 5 点、跨天重置 | 是 | `lib/credits/server.ts:143-156`、`:216-259` |
| AI 未配置拦截 | 是（且在扣点前） | `lib/ai/actions.ts:249-256`、`lib/ai/client.ts:86-92` |
| 登录/注册限流 | **否**；仅映射上游限流错误 | `app/sign-in/actions.ts:27-29`、`app/sign-up/actions.ts:31-33`；`docs/credits/README.md:131` |
| AI/导出每用户限流 | **否** | 全仓 `rate|throttle|ratelimit` 在 `app/` 无实现；`plan.md:266`、`:282-283` 列为未完成 |
| 登录墙（AI/照片/PDF） | 是 | `proxy.ts:39-41`、`app/(product)/layout.tsx:32-39`、`app/api/resumes/[resumeId]/pdf/route.ts:181-184`、`lib/ai/actions.ts` 每个 action 都 `requireUser()`（`:379`、`:432`、`:490`、`:523`、`:557`） |
| 简历/岗位/投递归属校验 | 是 | `lib/ai/actions.ts:108-149`、`lib/workspace/actions.ts:112-120`、`app/api/resumes/[resumeId]/pdf/route.ts:186-193` |
| 照片类型/大小（服务端旧通道） | 是：jpg/png/webp、≤5MB（但当前编辑器未接入） | `lib/storage.ts:22-23`、`lib/actions.ts:300-325` |
| 照片（当前编辑器，本地） | 是：`image/*`、≤4MB、不上传 | `components/editor/FormSections.tsx:801-832`、`:844`、`:927` |
| Server Action 体积上限 | 是：6MB（为 5MB 照片预留） | `next.config.ts:8-14` |
| PDF 请求体积/照片体积 | 是：body ≤ 8,000,000 字符；照片 data/https 且 ≤ 5,000,000 字符 | `app/api/resumes/[resumeId]/pdf/route.ts:130-145`、`:195-204` |
| 文本长度 | 是：AI 的 JD 截断 8000；prompt 内 JD 6000、经历 4000/8000；关键词函数 ≤20000 | `lib/ai/actions.ts:360-363`、`lib/ai/prompts.ts:63-67`、`:138`、`:189`、`:228`、`:272`、`:312`、`lib/functions/extract-keywords.ts:53-54`、`:95-97` |
| 验证码/CAPTCHA/邮箱验证/设备指纹 | **否** | 全仓无实现；`docs/credits/README.md:131` 明确「防薅羊毛限流未实现」 |
| 内容合规审查（违法/侵权/敏感词） | **否** | 全仓无内容审核实现 |
| 用户级并发/重复点击保护 | 部分（前端 loading/disabled） | `components/editor/EditorScreen.tsx:951-956`、`:1134`；服务端无幂等号 |

- 免费额度可被「注册新账号」绕过，代码仅以账号维度计（`lib/credits/server.ts:192-259`）；无邮箱验证/设备/IP 约束。
- `plan.md:399-410` 的限流建议（单账号 AI 60 次/日、同 IP 200 次/日、新账号手机号验证等）**均未实现**，仅文档建议。

---

## 8. 暂停、终止、注销与数据删除

### 8.1 用户主动注销（唯一终止路径）

- 入口：设置 → 数据与隐私 → 危险区「注销账号」，二次确认后调用 `deleteAccount()`，成功后 `signOut` 并回首页（`components/settings/SettingsScreen.tsx:1124-1173`、`:1033-1059`）。
- 服务端流程（`lib/actions.ts:405-461`）：
  1. 缺 `NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID` → 直接返回错误（**注销会不可用**）（`:409-418`）；
  2. 调 Neon 管理 API 删除 Auth 用户，失败即中止以保留应用数据（`:420-435`）；
  3. 尽力删除该用户简历照片对象（`:437-444`）；
  4. 删除 `users` 行（级联删除简历/经历/教育/岗位/投递/通知/偏好/订单/点数流水/AI 记录；`drizzle/schema.ts` 各 `onDelete: "cascade"`），并做 5 次补偿删除防并发复活（`lib/actions.ts:448-455`）；
  5. 结束会话（`:457-458`）。
- 注销后同邮箱可重新注册（`components/settings/SettingsScreen.tsx:1139-1142`）。
- 若用户仅是想停止使用：无「暂停/冻结/停用」功能（**代码未体现**）。

### 8.2 订单与留存

- 订单、点数流水、AI 记录均随 `users` 级联删除（`drizzle/schema.ts:248-250`、`:280-282`、`:323-328`）。
- 照片对象删除是「尽力而为」且依赖 Storage 配置（`lib/actions.ts:437-444`；旧上传通道未使用，当前无服务端照片）。
- 无「交易记录单独留存」实现，与隐私页声明冲突（`app/privacy/page.tsx:31-33`、`plan.md:312`）。

### 8.3 过期点数

- 过期即清零，写 `expire` 流水；不再补发、不可退款、无延期入口（`lib/credits/server.ts:120-141`、`:323-372`）。
- 前端展示到期日与「到期未用完会失效」（`components/settings/SettingsScreen.tsx:688-700`、`:1004-1006`、`:772-777`；`app/page.tsx:94-97`）。

### 8.4 封禁/违约处置

- **无封禁能力**：`users` 表无状态字段、无管理员/后台路由、无风控/冻结动作；`admin|封禁|suspend` 在代码中仅命中错误文案与注释（`drizzle/schema.ts:18-48`；`lib/ai/client.ts:32`、`lib/ai/actions.ts:253`）。
- 因此 ToS 若写「我们可暂停或终止违规账号」，**当前产品无法执行**（只能删号）；需产品补能力或条款改用「拒绝服务/删除数据」等可实现表述。

---

## 9. 知识产权与品牌

- **仓库无 LICENSE 文件**（根目录无 `LICENSE/COPYING`；`package.json:4` 声明 `"private": true`），也无第三方开源许可清单；npm 依赖清单见 `package.json:17-33`。
- 品牌名「AI 简历编辑器」出现在站点元数据与页脚（`app/layout.tsx:10-11`、`app/page.tsx:586-591`），favicon 为 `app/favicon.ico`，图标资产在 `public/icons/`（`public/icons/credit-token.svg` 等）。
- 视觉资产由 Qwen（阿里云百炼）生成（`CLAUDE.md:5-9`、`docs/hero-visual/`），**生成物权利归属、商用授权在仓库内无记载**（代码/文档未体现）。
- 参考素材 `design/UI_ref.jpg`（MOONLITE 版式）与参考视频已入库 git，文档称「只学版式/材质、不当素材用」（`CLAUDE.md:21`、`docs/hero-visual/01-visual-bible.md:35`、`:51`）；但**该参考素材的授权来源/权利人未记录**（代码/文档未体现），属 ToS 知识产权章节与侵权风险的待核实项。
- 无商标注册、无版权声明页、无「©」标识（全仓检索无 copyright 声明）。

---

## 10. 条款缺口清单（代码无法回答，必须由业务/法务确认）

1. **运营主体**：个人 / 个体工商户 / 公司？名称、统一社会信用代码、注册地址——代码与文档仅有「个人/个体户」的规划讨论（`plan.md:275`、`:307`、`docs/pricing/README.md:414-421`），无确定主体。
2. **管辖法律与争议解决**：无（全仓无管辖/仲裁/法院表述）。
3. **年龄/未成年人**：无年龄门槛、无监护人同意流程、无年龄声明（注册页仅有隐私链接：`app/sign-up/[[...sign-up]]/page.tsx:33-41`）。**代码未体现**。
4. **退款政策**：无用户可执行退款；文档建议「未消耗点数 7 日内可退」未实现（`docs/pricing/README.md:436-440`）。渠道退款回调只记录不处理（`app/api/webhooks/payment/route.ts:63-66`）。
5. **联系方式/客服/投诉举报渠道**：页脚「支持邮箱随官网上线公布」、备案号为预留位（`app/page.tsx:589-597`、`app/privacy/page.tsx:55-61`）——**尚无有效联系方式**。
6. **服务条款本体与同意机制**：无 ToS 页面、无注册勾选、无版本号/生效日期/变更通知（全仓无 `/terms`）。
7. **内容侵权（UGC）处理**：简历不公开、无分享功能，但用户上传 JD/经历可能涉及第三方权利；无投诉/下架/通知-删除流程（代码未体现）。
8. **不可抗力、服务可用性/SLA、维护通知**：无（代码未体现；部署为单实例，`plan.md:315` 承认单点）。
9. **通知方式**：无站外通知实现（邮件/短信均无；`weeklyDigest` 仅开关），站内通知也无运行时生成（见 5/1.2）。
10. **价格与规则变更权**：目录为代码常量（`lib/credits/catalog.ts:84-115`），无版本化/变更告知机制；ToS 需自行约定。
11. **数据出境/存储地**：营销称境内（`app/page.tsx:71-74`、`app/privacy/page.tsx:15-17`），实际 Neon 托管区域**代码未体现**；ToS/隐私政策需核实后再写。
12. **发票/税务**：无发票申请入口（代码未体现）。
13. **账号转让/继承/企业采购**：无相关能力。
14. **AI 生成内容标识合规**：《人工智能生成合成内容标识办法》要求未落地（见 5）；ToS 若承诺「AI 生成内容均已标识」会不实。
15. **未成年人内容/敏感信息**：照片属敏感个人信息，当前不上传；若恢复上传，需单独同意与合规评估（`plan.md:150`、`docs/pricing/README.md:442-447`）。
16. **第三方条款传导**：Neon/DeepSeek/支付渠道的 ToS 未在仓库出现（见 6），ToS 需自行加入引用与用户同意路径。
17. **违约处理/封禁**：无实现（见 8.4）。
18. **出口管制/制裁/反洗钱**：无（代码未体现；支付走第三方平台时由平台承担 KYC）。
19. **不可撤销的免费额度滥用**：无限流/无验证，ToS 需保留「调整免费额度/限制滥用」的权利（当前代码可随时改常量，但无用户告知）。

---

## 11. 不确定项（无法从代码确定，需人工确认）

| # | 不确定项 | 原因 |
|---|---|---|
| 1 | Neon 项目/数据库/Storage 的**实际托管区域**与是否跨境 | 只能在 Neon 控制台/环境变量确认；`.env.local` 按规则未读取（`lib/db.ts:1-7`、`lib/storage.ts:9-20`） |
| 2 | Neon Auth 的会话时长、邮箱验证是否强制、并发会话上限、密码策略细节 | 由 Neon Auth 项目配置决定；应用只传 baseUrl+cookie secret（`lib/auth/server.ts:17-26`） |
| 3 | 生产 `PAY_PROVIDER` 实际值与是否配置 `PAY_ALLOW_MANUAL` | 环境变量，代码未体现（`lib/pay/index.ts:42-55`） |
| 4 | `LEMON_SQUEEZY_*` 是否仍配置（残留回调是否会改 plan） | 环境变量，代码未体现（`app/api/webhooks/lemon-squeezy/route.ts:19-70`） |
| 5 | DeepSeek 侧是否留存/用于训练 | 第三方条款问题，仓库仅标注「待核实」（`docs/pricing/README.md:445`） |
| 6 | 生产是否启用对象存储（照片是否真的会被保存） | 当前编辑器不上传；旧通道是否启用取决于环境（`components/editor/FormSections.tsx:844`、`:927`） |
| 7 | 演示种子数据是否会进入正式生产 | `loadWorkspace` 对新账号无条件 seed（`lib/workspace/load.ts:133-168`），是否为演示环境需产品确认 |
| 8 | 实际 AI 模型（`DEEPSEEK_MODEL`） | 缺省 `deepseek-chat`，生产可改（`lib/ai/client.ts:19`、`:97-101`） |
| 9 | 真实支付渠道接入时间与主体 | 代码只有适配层占位（`lib/pay/index.ts:14-25`、`:150-164`） |
| 10 | 备案号/ICP 许可证/经营性许可状态 | 页脚为「预留位」（`app/page.tsx:591`）；`plan.md:275`、`:307` 讨论风险但未落地 |

---

## 12. 给 ToS 起草者的直接建议（基于以上事实）

- 服务描述按「**登录后**的中文简历编辑 + AI 按点改写 + 免费 PDF 导出 + 手动投递追踪/岗位收藏 + 站内通知」写；**不要写匿名编辑**，也不要承诺多模板/分享/批量投递/求职信/英文简历。
- 计费章节照 `lib/credits/catalog.ts` 的 5/2/1/1/1/0 与三档套餐写；明确「一次性购买、不自动续费、每日免费额度不累积、过期作废、点数不可转让/兑现、失败自动退点」。
- 支付章节必须写「当前为演示/沙箱环境，真实支付尚未开通」或等真实通道上线后再改；不要把 `mbd/afdian/alipay/wechat` 写成已可用。**不要提 Lemon Squeezy/订阅**。
- AI 章节必须包含：第三方 DeepSeek 处理、输入内容范围（含整份生成会发送姓名/城市/教育）、输出不保证准确/不构成求职结果承诺、无人工审核、用户需自行核实、失败退点规则；并建议同步补「AI 辅助」标识（代码尚未实现）。
- 账号章节写清「邮箱+密码由 Neon Auth 托管」「注销需服务端凭证、注销即删全部业务数据（含订单）」「无封禁能力/违约处理以拒绝服务与删除账号为限」。
- 数据与隐私章节不要直接复用「境内存储/不跨境」文案，先核实 Neon 区域；照片章节按「当前仅本地预览、不上传」写，若恢复上传再补单独同意。
- 缺口清单（第 10 节）需在 ToS 中以 `[待确认]` 占位，尤其是主体、管辖、年龄、退款、联系方式、投诉渠道、不可抗力、通知方式、AI 标识合规。

---

*本文件为只读代码审计结果，不构成法律意见；所有「代码未体现」项须由产品或法务确认后再写入正式条款。*
