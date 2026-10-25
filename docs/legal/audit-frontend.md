# 前端审计：法律页（/terms、/privacy）与同意入口

> 审计日期：2026-10-25　范围：`.`　性质：**只读审计**（本文件是唯一写入物）。
> 方法：逐文件 `read`/`grep` 核对代码事实；Next.js 16 约束读自 `node_modules/next/dist/docs/`；**未读取 `.env.local`**，涉及区域/密钥的结论标注「待核实」。
> 说明：本文件只陈述代码事实与实现建议，不提供法律意见；条款正文由法务/Lead 定稿。

---

## 0. 结论摘要（先看这 8 条）

1. `app/privacy/page.tsx:16`「全部数据存于中国大陆境内数据中心，不跨境传输」**与现有实现冲突**：数据库/认证/对象存储/实时均为 **Neon 托管服务**（`README.md:5`、`lib/db.ts:1-7`、`lib/auth/server.ts:1-26`、`lib/storage.ts:9-20`、`lib/realtime/*`），代码未固定任何境内区域；同一声明还散落在首页 3 处（`app/page.tsx:72-74`、`86-89`、`380-385`），必须一起改。
2. `app/privacy/page.tsx:20`「不出售、不共享给第三方」**与数据流冲突**：Neon（数据库/认证/存储）、DeepSeek（AI 改写）、支付渠道（`lib/pay/index.ts:14-25`）都是受托处理方，应写「不出售；为提供服务向下列受托方共享/委托处理」并逐项列名。
3. `app/privacy/page.tsx:20`「仅向持牌支付平台提供订单号与金额」不准确：当前默认 `manual` 本机沙箱（`lib/pay/index.ts:43-55`、`141-164`），真实渠道尚未接入；面包多/爱发电是**平台**而非持牌支付机构；接入后渠道还会拿到商品标题、回调/回跳地址等。
4. `app/privacy/page.tsx:24` 照片条款**未实现**：当前照片只在浏览器内 `FileReader` 预览，**不上传服务器**（`components/editor/FormSections.tsx:824`、`844`、`927`）；无「单独同意」勾选。另有服务端上传路径 `uploadPhotoAction`（`lib/actions.ts:300-325`）当前**无调用方**，且其读取用公开 URL（`lib/actions.ts:77-81`、`.env.example:11-12`），与「私有对象存储」不符。
5. `app/privacy/page.tsx:28`「仅把当段经历与目标 JD 发送给模型」不准确：整份生成/润色会把**姓名、城市、总结、技能、全部经历、教育**一起发给 DeepSeek（`lib/ai/prompts.ts:31-44`、`134-152`）；单段 JD 改写才只发一段经历+JD（`lib/ai/prompts.ts:308-320`）。照片与电话/邮箱确实不发。
6. `app/privacy/page.tsx:32`「交易记录依《电子商务法》另行留存」**与实现相反**：`deleteAccount` 级联删除 `users`，`orders` 是 `onDelete: "cascade"`（`drizzle/schema.ts:244-250`、`lib/actions.ts:452-455`），交易记录实际被一并删除。
7. 站内**没有** `app/terms/`、`app/sitemap.ts`、`app/robots.ts`；页脚 ICP/公安备案是「预留位」（`app/page.tsx:591`）；首页 FAQ/About 与隐私页存在重复且同样的境内声明。
8. Next 16 关键约束：法律页天然静态（无请求时 API 即 ○ Static），但**不能**在预渲染中用 `new Date()`（会触发 current-time 预渲染错误），「最后更新日期」必须写成常量字符串；`metadata` 对象只能在 Server Component 导出，且不能与 `generateMetadata` 同时导出。

---

## 1. 现有 `/privacy` 逐条事实核对

### 1.1 代码现状

- 路由：`app/privacy/page.tsx`（单文件 64 行，Server Component）。
- metadata：`app/privacy/page.tsx:4-7`，`title: "隐私政策 — AI 简历编辑器"`，`description: "我们收集什么、存到哪里、保存多久、如何删除。"`。
- 正文：`SECTIONS` 常量 `app/privacy/page.tsx:9-38`，7 条硬编码文案；渲染 `42-54`：`main.mx-auto.max-w-3xl.px-4.py-16`、`h1.text-3xl.font-bold.text-zinc-900`（43）、副标题 `text-sm text-zinc-600`（44-46）、`h2` + `p.text-sm`（50-51）。
- 页尾：`app/privacy/page.tsx:55-61`，返回首页 `Link href="/"`（56-58）+「支持邮箱随官网上线公布，备案信息见首页页脚」（60）。
- 无页脚组件、无目录锚点、无「最后更新日期」、无生效日期、无处理者主体名称、无联系方式、无打印样式、无 `nav`。

### 1.2 逐条核对表

| # | 现有声明（`app/privacy/page.tsx` 行号） | 代码事实（证据） | 判定 | 建议写法/动作 |
|---|---|---|---|---|
| 1 | `:12`「账号邮箱与密码哈希」 | 应用库 `users` 只存 `id/email/...`，id 来自 `neon_auth.users.id`（`drizzle/schema.ts:13-18`）；密码完全由 Neon Auth 托管（`app/sign-up/[...sign-up]/page.tsx:39`、`components/auth/AuthShell.tsx:132`、`lib/auth/server.ts:1-26`） | **部分不准确**：应用不接触密码哈希 | 改为「账号邮箱（昵称可选）；密码由认证服务商 Neon Auth 托管，本应用不存储明文密码，也不直接保存密码哈希」 |
| 2 | `:12`「简历内容（联系方式、总结、经历、教育、技能）」 | `drizzle/schema.ts` 中 resumes/experiences/educations；`lib/workspace/actions.ts:122-160` 落库 | 准确 | 保留；可补「岗位、投递记录、通知、求职偏好」（`lib/workspace/actions.ts:266`、`337`） |
| 3 | `:12`「订单与点数有效期、点数流水记录」 | `drizzle/schema.ts:244-270` orders；`lib/credits/server.ts`、`lib/workspace/actions.ts:630` | 准确 | 保留 |
| 4 | `:16`「全部数据存于中国大陆境内数据中心，不跨境传输」 | 全链路为 Neon：`lib/db.ts:1-7`（Neon serverless Postgres）、`lib/auth/server.ts:3,17-26`（Neon Auth）、`lib/storage.ts:9-20`（Neon Storage，region/endpoint 由控制台给）、`neon.ts:1-29`（`@neon/config`）、`README.md:5`。代码与 `.env.example:1-12` 均未固定境内区域；Neon 公开区域列表中无中国大陆节点（**具体区域以控制台/`DATABASE_URL` 主机名为准，待运维核实**）。`plan.md:150` 的「阿里云华东1、全部境内」是**旧方案**，实现已替换为 Neon | **重大不准确（跨境风险）** | 二选一：① 迁移到境内托管（Postgres/对象存储/Auth）后再保留境内声明；② 如实写「数据存储于 Neon 托管数据库/对象存储，服务器可能位于中国境外，构成个人信息出境」，并按 PIPL 第三章做告知+单独同意/标准合同。**不能**在现状下继续写「不跨境传输」 |
| 5 | `:20`「仅用于简历排版、AI 改写、PDF 导出与订单核销」 | 与 `lib/ai/actions.ts`、`lib/pdf.ts`、`lib/pay/index.ts` 一致；另有「投递追踪/通知」等已实现功能未列 | 基本准确但**不完整** | 补「投递记录与站内通知、点数流水、偏好设置」 |
| 6 | `:20`「不用于广告画像」 | 代码中无统计/广告/画像 SDK（全站无第三方 analytics；`app/layout.tsx` 仅 `next/font`） | 准确 | 保留 |
| 7 | `:20`「不出售、不共享给第三方」 | 实际存在受托处理方：Neon（DB/Auth/Storage/Realtime）、DeepSeek（`lib/ai/client.ts:18,95-102`）、支付渠道（`lib/pay/index.ts:14-25`）、Neon 管理 API（注销时调用 `console.neon.tech`，`lib/actions.ts:421-426`） | **不准确**：「不共享」与「委托处理」在监管口径不同，且与支付/AI 实现冲突 | 改为「我们不出售你的个人信息；为完成注册登录、存储、AI 改写、支付与注销，会向下列受托方提供完成服务所必需的最小信息：Neon（数据库/认证/对象存储，区域待核实）、DeepSeek（AI 文本处理，境内）、支付渠道（订单号/金额/商品名称）、Neon Management API（仅注销）」 |
| 8 | `:20`「支付时仅向持牌支付平台提供订单号与金额」 | 默认 `manual` 沙箱，不产生真实扣款（`lib/pay/index.ts:43-55`、`602-620` 注释见 `components/settings/SettingsScreen.tsx:617-620`）；真实渠道仅适配层预留（`lib/pay/index.ts:14-25`、`141-164`）；面包多/爱发电为平台，非持牌支付机构；回调统一走 `/api/webhooks/payment`（`app/api/webhooks/payment/route.ts`） | **不准确（当前为演示支付）** | 改为「当前为演示环境，付款为沙箱模拟，不产生真实扣款；正式收款后，支付渠道将获得订单号、金额、商品名称与支付状态，用于收款与对账」 |
| 9 | `:24`「照片属于敏感个人信息，上传前需要你的单独同意」 | **无任何单独同意 UI**（`components/editor/FormSections.tsx:782-930` 照片区无勾选）；照片仅本地 `FileReader`，不上传（`:824`、`:844`、`:927`）。服务端上传 `uploadPhotoAction`（`lib/actions.ts:300-325`）未被任何组件调用 | **未实现** | 若短期不开放上传：改为「当前版本照片仅在你的浏览器内用于预览与导出，不会上传服务器」；若开放上传：必须在选择照片前增加**独立勾选**（不得与注册同意合并），并在上传 action 校验 |
| 10 | `:24`「照片存于私有对象存储，仅在导出排版时临时读取」 | `.env.example:11-12` 明确 bucket 可公开读并配 `NEON_STORAGE_PUBLIC_URL`；`lib/actions.ts:77-81`、`lib/workspace/load.ts:50-53` 直接拼公开 URL；无签名 URL 代码 | **与实现冲突** | 要么改为「照片以不可猜测的 URL 存储于对象存储（若为公开读 bucket，不能声称私有）」；要么实现私有 bucket + 签名 URL（`@aws-sdk/client-s3` `getSignedUrl`）后再写「私有存储」 |
| 11 | `:28`「仅把当段经历与目标 JD 文本发送给境内模型服务，不附带联系方式与照片」 | 整份生成/润色会发送姓名、城市、总结、技能、经历、教育（`lib/ai/prompts.ts:31-44`、`134-152`）；单段 JD 改写只发一段经历+JD（`:308-320`）；电话/邮箱/照片不发 | **部分不准确** | 改为「AI 改写时会把简历文字（含姓名、城市、总结、技能、经历、教育）与你粘贴的 JD 发送给 DeepSeek（境内）用于生成；不会发送电话、邮箱与照片」 |
| 12 | `:32`「账号存续期间保存」 | 业务数据随 `users` 级联；但 `ai_rewrites` 审计也保存 JD/输出（`drizzle/schema.ts:159` 附近、`lib/ai/actions.ts` 写审计） | 基本准确、**不完整** | 补：AI 改写审计记录、点数流水保存期限；会话 cookie 期限（Neon Auth） |
| 13 | `:32`「注销时级联删除全部简历、照片与账号数据」 | 级联删除成立（`drizzle/schema.ts:59,92,105,159,199,220,250` 均为 cascade）；照片删除为 best-effort（`lib/actions.ts:437-444` `.catch(() => {})`）；注销依赖 `NEON_API_KEY/NEON_PROJECT_ID/NEON_BRANCH_ID`，缺配置直接失败（`lib/actions.ts:409-418`） | **部分不准确（效果不保证）** | 「注销后我们会删除账号与全部业务数据；照片对象尽力同步删除，若删除失败将在 X 个工作日内处理。若自助注销失败，可通过邮箱联系我们」 |
| 14 | `:32`「交易记录依《电子商务法》另行留存」 | `orders.userId` 为 `onDelete: "cascade"`（`drizzle/schema.ts:244-250`），注销即删；无留存表/脱敏留存逻辑 | **与实现相反** | 短期：删掉该句，改为「注销后订单记录一并删除」；长期：按法务意见改为 `orders.user_id` 可空 + 脱敏留存金额/时间（`plan.md:113` 亦提出该冲突） |
| 15 | `:36`「查阅、更正、删除与注销均可在「设置」页自助完成」 | 设置页确实有：导出 JSON（`components/settings/SettingsScreen.tsx:1078-1087`）、个人资料保存（`:89-109`）、注销（`:1137-1173`、`lib/actions.ts:405-460`）；但简历/岗位/投递的删除分散在各自页面 | 基本准确 | 建议写「在「设置 → 数据与隐私」可导出数据、注销账号；简历、岗位与投递记录可在对应页面删除；如需协助可联系邮箱」 |
| 16 | `:45`「条款以克制、具体为准，不写做不到的承诺」 | 这句是**写给自己的开发备注**，出现在用户可见副标题 | 文案错误 | 删除；换为「本政策说明我们收集哪些信息、如何使用与共享、保存多久，以及你如何行使权利」 |
| 17 | `:60`「支持邮箱随官网上线公布」 | 全站无联系方式；`app/page.tsx:596` 同样写「随官网上线公布」 | **告知义务缺口**（PIPL 第 17 条要求告知处理者身份与联系方式） | 提供真实联系邮箱（可先用 `support@…` 域名邮箱）与处理者名称；页脚同步 |
| 18 | `:44-46` 视觉 | 无背景色，正文依赖 `text-zinc-900/600`；而 `app/globals.css:14-19` 在系统深色模式下把 `--background` 改为 `#0a0a0a` | **深色模式可读性缺陷**（深底 + zinc-900 文本 ≈ 1.1:1） | 法律页显式设置浅色底（见 §3.4） |

### 1.3 缺失章节（对照 PIPL 告知清单与竞品惯例）

- 处理者身份：运营主体名称、注册地址、联系邮箱（`app/privacy/page.tsx:60` 目前是占位）。
- 生效日期 / 最后更新日期 / 版本号（当前完全没有；metadata 也没写）。
- 处理目的与法律依据（逐项对应：注册登录=履行合同；AI=同意/合同；支付=合同+法定义务）。
- 第三方/受托处理方清单与共享场景（Neon / DeepSeek / 支付渠道 / Neon Management API）。
- **数据出境**专章：若继续用 Neon，必须写明出境情形、接收方、目的、类型与用户权利行使方式。
- 保存期限表（账号数据、AI 审计、订单、日志、Cookie/会话）。
- 安全措施（TLS、访问控制、最小权限；不要编造未实现的加密/等保）。
- Cookie 与本地存储说明：应用用 `localStorage` 存 UI 偏好（`lib/ui/prefs.ts:1-42`），Neon Auth 写会话 cookie（`lib/auth/server.ts:13-16`）。
- 你的权利与行使路径：查阅/复制/更正/删除/注销/撤回同意/投诉（当前只有一句 `:36`）。
- 未成年人条款（面向求职者，通常写「不面向未满 14 周岁」）。
- 政策变更与通知方式。
- AI 生成内容提示（`plan.md:151`、`313`：AI 辅助改写标识，不属隐私但常与服务条款同页）。
- （若上线照片上传）敏感个人信息单独同意说明与撤回方式。

---

## 2. 条款 / 隐私 / 同意 / 注销相关代码位置（含现有文案）

| 位置 | 现有文案 / 行为 | 问题 |
|---|---|---|
| `app/page.tsx:72-74` | CAPABILITIES「境内存储」：「简历与照片存于境内数据中心，不跨境传输。」 | 与 Neon 实现冲突，需改 |
| `app/page.tsx:81-102`（FAQ） | `:86-89`「我的简历和照片存在哪里？」答：「全部存于中国大陆境内数据中心…照片…单独同意…」 | 同上；且「单独同意」未实现 |
| `app/page.tsx:380-385` | About 卡「数据在境内」：「简历与照片存于境内数据中心，注销即删。」 | 同上；「注销即删」需加限定 |
| `app/page.tsx:586-601`（Footer） | `:591`「ICP 备案号：预留位 · 公安备案号：预留位」；`:592-597` 仅有「隐私政策」链接 +「问题反馈：支持邮箱随官网上线公布」 | **无《用户协议》链接**；备案号占位；无联系邮箱 |
| `app/sign-up/[[...sign-up]]/page.tsx:33-41` | 「注册即表示同意《隐私政策》。密码由 Neon Auth 托管，本应用不存储明文密码。」（`:35-39`） | 无《用户协议》；无勾选；同意不可举证（无 acceptedAt/版本记录） |
| `components/auth/SignUpForm.tsx:58-75` | 密码框（`:58-67`）+ 提交按钮（`:71-75`） | 无任何同意控件；建议在下单按钮前插入必选 checkbox |
| `app/sign-in/[[...sign-in]]/page.tsx:33-41` | 「…继续即表示同意《隐私政策》。」（`:35-39`） | 无《用户协议》；「继续即表示」对既有账号的再同意说明不充分 |
| `app/sign-up/actions.ts:40-62` | `signUpWithEmail(prevState, formData)`；`:44-52` 读 email/password/name/redirectUrl，`:54` 调 `auth.signUp.email` | 服务端**未校验同意**，需加字段校验（客户端 `required` 不够，Server Action 才是安全边界） |
| `app/sign-in/actions.ts:36-52` | 同上结构 | 若登录也要记录条款版本，需要新增字段（超出前端范围，需 Lead/DB 决策） |
| `app/settings/page.tsx:6-8` | `/settings` 301 到 `/dashboard/settings` | 正常；旧链接仍可用 |
| `app/(product)/dashboard/settings/page.tsx:1-11` | 渲染 `SettingsScreen`；metadata title「设置 — 简历编辑器」 | 正常 |
| `components/settings/SettingsScreen.tsx:41-48` | 设置分区「个人资料 / 求职偏好 / 点数与套餐 / **数据与隐私**」 | 正常 |
| `components/settings/SettingsScreen.tsx:330-332` | 账号概览脚注：「数据保存在 Neon Postgres，按登录账号隔离」+「隐私政策 →」链接 | 暴露具体供应商名（可保留，但应与隐私政策一致） |
| `components/settings/SettingsScreen.tsx:1064-1072` | 「数据与隐私」面板副标题「所有数据保存在 Neon Postgres，按登录账号隔离。」 | 同上 |
| `components/settings/SettingsScreen.tsx:1078-1087` | 「导出我的数据 / 下载包含简历、目标岗位、投递记录、通知与偏好的 JSON 文件」 | 实现见 `lib/mock/store.tsx:647-656`（导出的是当前工作区状态，非完整原始数据） |
| `components/settings/SettingsScreen.tsx:1108-1120` | 「隐私政策 / 查看隐私政策 →」 | **缺「用户协议」行**（建议在此处并列新增） |
| `components/settings/SettingsScreen.tsx:1137-1173` | 危险区「注销账号」+确认弹窗「注销账号并删除全部数据？…删除 Neon Auth 账号与所有应用数据…此操作不可恢复。」（`:1169-1172`） | 文案与 `lib/actions.ts:405-460` 基本一致；建议补「交易记录一并删除」与「失败请联系邮箱」 |
| `components/app/AppShell.tsx:16-29` | 主导航只有 工作台/简历库/目标岗位/投递追踪/设置 | 无「帮助 / 条款」入口 |
| `components/app/AppShell.tsx:197-228`（侧栏账户菜单） | 账号设置、导出我的数据、退出登录、返回官网、重置演示数据 | **无隐私政策 / 用户协议入口** |
| `components/app/AppShell.tsx:586-614`（顶栏用户菜单） | 账号设置、点数与订单、返回官网 | 同上 |
| `components/app/AppShell.tsx:658-691`（移动端菜单） | 退出登录 +「已连接 Neon · 数据实时同步」 | 同上 |
| `app/(product)/layout.tsx:1-52` | 产品区受 `requireUser()` 保护（`:32-40`），metadata `noindex`（`:8-10`） | 法律页**不要**放进 `(product)` 路由组，否则会被登录拦截 + noindex |
| `app/(product)/dashboard/layout.tsx:1-9` | 纯 `AppShell` 包裹 | — |
| `components/settings/SettingsView.tsx:18-179` | **未被任何页面/组件引用**的旧设置页（`grep` 仅自身命中），内含第二套注销实现（`:40-52`、`:145-155`，用 `window.confirm`） | 死代码，易与现行注销文案冲突；建议删除或标注弃用（由 Lead 决定） |
| `proxy.ts:39-41` | matcher 仅 `/dashboard/:path*`、`/editor/:path*`、`/settings/:path*` | `/privacy`、`/terms` 天然公开，无需改 proxy |

---

## 3. 站点样式与设计约定

### 3.1 全局层

- 入口：`app/layout.tsx:1-36`。`html lang="zh-CN"`（`:32`），`body.min-h-full.flex.flex-col`（`:33`），全局只引 `./globals.css`（`:3`）。
- 字体：`next/font/google` 的 `Geist` → CSS 变量 `--font-geist-sans`（`app/layout.tsx:2,5-8`）；正文栈：Geist + PingFang SC / Hiragino Sans GB / Microsoft YaHei / Noto Sans CJK SC（`app/globals.css:21-26`）。**不新增字体**；Title/正文都用这套。
- Tailwind 4：**无 `tailwind.config.*`**，CSS-first：`@import "tailwindcss";`（`app/globals.css:1`）+ `@theme inline` 映射 token（`:8-12`、`:103-115`）。因此 `bg-hero-cloud`、`text-hero-ink`、`bg-hero-pink`、`rounded-hero` 等工具类可直接用。
- 圆角约定（产品设计规范 `docs/dashboard/DESIGN.md:45`）：大容器 16px、面板 8px、控件 6px、胶囊 999px；品牌视觉另用 `--hero-radius: 28px`（`app/globals.css:100`）。
- 字号约定（`docs/dashboard/DESIGN.md:48`）：页面标题 24/600、卡片标题 16/600、正文 14/1.65、元信息 12。公开页可放大（现有隐私页 `text-3xl`、`text-sm`）。

### 3.2 三套样式体系（不要混用）

| 区域 | 样式来源 | 典型类 | 适合法律页？ |
|---|---|---|---|
| 公开营销页（`/`） | `app/globals.css` + Tailwind 任意值 | `glass-panel`（`:200-218`）、`cta-primary/secondary`（`:361-381`）、`text-[#0E1B2A]` | 可借鉴色板与圆角，但玻璃/光晕不适合长文 |
| 认证页（`/sign-in`、`/sign-up`） | `components/auth/auth.css`（`AuthShell.tsx:6` 导入） | `.auth-page`、`.auth-frame`、`.auth-foot`、`inputClass`（`components/auth/form-ui.tsx:7-10`） | 仅用于同意文案排版，不必新样式 |
| 产品区（`/dashboard`、`/editor`、`/settings`） | `app/app-ui.css`（`app/(product)/layout.tsx:3` 导入）+ 组件级 css（如 `components/settings/settings.css`） | `.app-shell`、`.panel`、`.page-head`、`.panel-link`、`.t-12`、`.num` | **不可直接用到公开法律页**：该文件只被产品区 layout 导入（token 在 `:root`，但公开页不会加载），且自带全局 print 规则（见 3.4） |

### 3.3 可直接引用的色板 token

| Token / 值 | 定义位置 | 用途 |
|---|---|---|
| `--hero-sky #1A6BD6` | `app/globals.css:90` | 链接 / 强调 |
| `--hero-cloud #F4F8FC` | `:91` | 页面浅底 |
| `--hero-ink #0E1B2A` | `:99` | 主文字 |
| `--hero-chrome-2 #C9D2D9` | `:94` | 分隔线（若需） |
| `--hero-pink-cta #D01E48` | `:97` | 仅 CTA 底色（白字 5.30:1） |
| `--ui-muted #58657A` / `--ui-faint #5F6B7E` | `app/app-ui.css:20-21` | 次级文字（白底 ≥4.5:1） |
| `--ui-border #E2E8F0` | `app/app-ui.css:16` | 边线 |

> 正文对比度目标 ≥4.5:1（`docs/dashboard/DESIGN.md:37-38` 已给白底上的取值）；不要用 `text-zinc-500` 写长正文。

### 3.4 深色模式与打印

- **深色模式是「半成品」**：`app/globals.css:14-19` 只把 `--background/--foreground` 在 `prefers-color-scheme: dark` 下改成 `#0a0a0a/#ededed`，但所有页面都硬编码浅色；现有 `/privacy` 无背景，深色模式下会变成深底 + `zinc-900` 文本（不可读）。新法律页必须显式给浅底浅色，例如：
  ```tsx
  <main className="legal-page min-h-svh bg-[#F4F8FC] text-[#0E1B2A]">
  ```
  或在 `legal.css` 里 `.legal-page { background: var(--hero-cloud); color: var(--hero-ink); color-scheme: light; }`。
- **打印**：`app/app-ui.css:2017-2058` 已有一套全局 `@media print`，规则是 `body * { visibility:hidden }` + 只显示 `.print-only`（A4 简历打印用）。**法律页不要复用**（否则 Ctrl+P 白纸）。应在新 `legal.css` 内自带：
  ```css
  @media print {
    @page { size: A4; margin: 18mm 16mm; }
    .legal-page { background: #fff !important; color: #000 !important; }
    .legal-toc, .legal-actions, .legal-foot { display: none !important; }
    .legal-page a { color: #000; text-decoration: underline; }
    .legal-page h2 { break-after: avoid; }
    .legal-page p, .legal-page li { break-inside: avoid; }
  }
  ```
- 焦点态：2px `--ui-accent` 外描边（`docs/dashboard/DESIGN.md:50`）；法律页的目录链接沿用。

### 3.5 新法律页建议的组件与 class（复用现有模式）

项目已有「组件 + 组件级 CSS」惯例：`AuthShell` 引 `auth.css`（`AuthShell.tsx:6`）、`SettingsScreen` 引 `settings.css`（`SettingsScreen.tsx:38`）。建议同样落地：

```
components/legal/LegalPage.tsx      // Server Component，接收 title/updated/effective/children
components/legal/legal.css          // .legal-page / .legal-shell / .legal-toc / .legal-sec / .legal-foot + print
app/terms/page.tsx                  // 内容 + metadata
app/privacy/page.tsx                // 重写为同一模板
```

结构骨架（两页共用）：

```tsx
<main className="legal-page min-h-svh">
  <div className="legal-shell mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
    <header>
      <p className="legal-kicker">法律文件</p>
      <h1 className="legal-title text-3xl font-bold tracking-tight sm:text-4xl">用户协议</h1>
      <p className="legal-meta mt-3 text-sm">
        生效日期：2026-10-25 · 最后更新：2026-10-25 · 版本 v1.0
      </p>
    </header>
    <nav className="legal-toc" aria-label="本页目录">
      <ol>
        <li><a href="#s1">1. 协议范围与接受</a></li>
        …
      </ol>
    </nav>
    <article className="legal-body">
      <section id="s1" className="legal-sec scroll-mt-24">
        <h2 className="text-xl font-semibold">1. 协议范围与接受</h2>
        <p className="mt-3 text-[15px] leading-7">…</p>
      </section>
      …
    </article>
    <footer className="legal-foot mt-12 border-t pt-6 text-sm">
      <Link href="/">返回首页</Link> · <Link href="/dashboard">返回工作台</Link> · 联系邮箱：…
    </footer>
  </div>
</main>
```

- 移动端行宽：`max-w-3xl`（48rem）+ `px-4 sm:px-6`；正文 `text-[15px] leading-7`（中文长文 15–16px/1.75 更易读），不要 `max-w-prose`（英文优化）以外的自定义窄栏。
- 目录：≥`md` 时两列网格或左侧 sticky（`lg:sticky lg:top-6`）；锚点用**原生 `<a href="#s1">`**（同页锚点，避免 `Link` 的客户端路由过渡），并给标题 `scroll-mt-24`（Next 文档建议用 `scroll-padding-top` 处理吸顶头：`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:164`）。
- 标题编号：章节用「1. / 1.1」文本编号（不依赖 CSS counter，便于复制与打印）。
- 返回入口：`/`（首页）与 `/dashboard`（工作台）；未登录点工作台会被 `proxy.ts` 带去 `/sign-in`，可接受。
- 「打印本页」按钮需要 client 组件（`window.print()`）；如不想加 client 组件，可只保留 Ctrl+P 样式。

---

## 4. 现有 SEO / 合规基础设施核查

| 检查项 | 现状 | 证据 |
|---|---|---|
| `app/terms/` | **不存在** | `glob` 无命中 |
| `app/sitemap.ts` / `app/sitemap.xml` | **不存在** | `glob` 无命中 |
| `app/robots.ts` / `app/robots.txt` | **不存在** | `glob` 无命中 |
| 页脚 ICP 备案号 | 占位「预留位」，无链接 | `app/page.tsx:591` |
| 页脚公安备案号 | 占位「预留位」 | `app/page.tsx:591` |
| 页脚法律链接 | 仅「隐私政策」 | `app/page.tsx:592-597` |
| 注册/登录法律链接 | 仅《隐私政策》 | `app/sign-up/[...]/page.tsx:36-38`、`app/sign-in/[...]/page.tsx:36-38` |
| 设置页法律链接 | 仅「隐私政策」 | `components/settings/SettingsScreen.tsx:1110-1120` |
| 根 metadata | 有 title/description/openGraph/twitter，**无 `metadataBase`、无 `alternates`** | `app/layout.tsx:10-28` |
| 产品区 noindex | 有 | `app/(product)/layout.tsx:8-10`；编辑器另有 `app/(product)/editor/layout.tsx:4-8` |
| 登录/注册 noindex | 有 | 两页 `:10` |
| 公开页可索引 | `/` 与 `/privacy` 默认可索引（无 robots 覆盖） | — |
| 第三方统计/字体/CDN | 无运行时第三方请求；字体为构建期 `next/font` | `app/layout.tsx:2`、全站 grep 无 analytics |

> 结论：法律页要成为「可被搜索引擎与用户发现」的正式页面，需要补 `app/sitemap.ts` + `app/robots.ts`，并把 `/privacy`、`/terms` 从原隐私页升级为同模板页面。

---

## 5. Next.js 16.4.2 静态法律页约束（读自 `node_modules/next/dist/docs/`）

| 约束 | 要点 | 文档路径 |
|---|---|---|
| 静态渲染默认 | 不依赖请求时数据（cookies/headers/params/searchParams/uncached fetch）的 Server Component 会被**自动预渲染**为 ○ Static，无需任何配置 | `01-app/02-guides/public-static-pages.md:48-66` |
| 法律页无需 `Suspense` | 只有读取 `cookies()`/`headers()`/`searchParams` 或客户端 `usePathname` 的组件才需要 Suspense 边界（本项目注册页就是这种，见 `app/sign-up/[...]/page.tsx:14-22`）；纯内容页不要加，避免无谓的流式壳 | `01-app/02-guides/authentication-with-cache-components.md`、`02-guides/public-static-pages.md:192-200` |
| `new Date()` = 构建错误 | 预渲染期间 `new Date()`/`Date.now()`/`Math.random()` 属同步 IO，会抛 current-time prerender 错误；`instant = false` 也不能豁免 | `01-app/02-guides/migrating-to-cache-components.md:84,101`；`01-app/02-guides/building.md:441`；`01-app/03-api-reference/04-functions/io.md:1-32` |
| `metadata` 导出 | `export const metadata: Metadata` 仅支持 **Server Component**，且不能与 `generateMetadata` 同段导出；静态 metadata 优先（不需要请求信息就别用 generateMetadata） | `01-app/03-api-reference/04-functions/generate-metadata.md:18-48,110-118,190-195` |
| `metadataBase` | 相对 URL 的 metadata 字段在没有 `metadataBase` 时 **build 报错**；本项目根布局没设（`app/layout.tsx:10-28`）。因此 canonical/OG 绝对地址要么先在根布局加 `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")`，要么法律页不要写 relative canonical | `01-app/03-api-reference/04-functions/generate-metadata.md:391-428` |
| `cacheComponents` 已开启 | `next.config.ts:15`；`cacheComponents` 下 `runtime`/`dynamic`/`revalidate` 等路由段配置**不要再用**（本项目 `plan.md:174` 同结论） | `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md:12,31,41` |
| sitemap / robots | `app/sitemap.ts`、`app/robots.ts` 的特殊 Route Handler **默认被缓存**（除非用了请求时 API）；`sitemap` 的 `lastModified` 可传 ISO 字符串，避免 `new Date()` 在 cacheComponents 下的同步 IO 风险 | `01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md:42-71,134`；`robots.md:18-37`；`01-app/03-api-reference/03-file-conventions/01-metadata/index.md:13-16` |
| 静态强约束（可选） | 如希望「任何改动都不能让法律页变动态」，可导出 `ensureStatic = 'navigation'`；否则默认即可 | `01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md`；`01-app/02-guides/keeping-pages-static.md:14-44,218` |
| 内链 | 站内跳转用 `next/link`；同页目录锚点用原生 `<a href="#s1">`，并配 `scroll-padding-top`/`scroll-mt` | `01-app/01-getting-started/04-linking-and-navigating.md:153-164` |
| 路由/文件 | `page.tsx` 是路由叶子，Server Component 默认；法律页不要放进 `(product)` 组（该组 `requireUser` + noindex，`app/(product)/layout.tsx:8-40`） | `01-app/03-api-reference/03-file-conventions/page.md:26-32`；`route-groups.md` |

> 「最后更新日期」实现建议：在页面里写 `const LAST_UPDATED = "2026-10-25"`（或从 `lib/legal/versions.ts` 导出常量），渲染成文本；**不要** `new Date().toISOString()`。若确需运行时日期，只能放进 `<Suspense>` + `connection()` 的子树或改客户端组件（不推荐——法律页应稳定）。

---

## 6. 实现建议

### 6.1 文件与路由

| 动作 | 文件 | 说明 |
|---|---|---|
| 新建 | `app/terms/page.tsx` | 用户协议（同模板），`metadata` 同 §6.2 |
| 重写 | `app/privacy/page.tsx` | 保留路由；内容扩展到 §1.3 的章节；metadata 加 `robots: { index: true, follow: true }`（默认即可，写出来便于审计） |
| 新建 | `components/legal/LegalPage.tsx` | 共用骨架（title/updated/effective/version/toc/children/backLinks），Server Component，无 `"use client"` |
| 新建 | `components/legal/legal.css` | `.legal-page`、`.legal-shell`、`.legal-toc`、`.legal-sec`、`.legal-foot` + `@media print`；`LegalPage.tsx` 内 `import "./legal.css"`（沿用 `AuthShell.tsx:6` 模式） |
| 新建 | `app/sitemap.ts` | 返回 `/`、`/privacy`、`/terms`；`lastModified: "2026-10-25"`；`url` 用 `process.env.NEXT_PUBLIC_APP_URL` 兜底 `http://localhost:3000` |
| 新建 | `app/robots.ts` | `allow: "/"`，`disallow: ["/dashboard", "/editor", "/settings", "/sign-in", "/sign-up", "/api/"]`，`sitemap: "<base>/sitemap.xml"` |
| 可选 | `app/layout.tsx:10-28` | 加 `metadataBase`（若要 canonical/绝对 OG）；不加则法律页不要写相对 canonical |

> 注意：`app/(product)/layout.tsx` 内的 `import "../app-ui.css"`（`:3`）不会作用到 `app/privacy`、`app/terms`；法律页样式必须自备。

### 6.2 页面结构（/terms 与 /privacy 共用）

1. **头部**：小标签「法律文件」→ `h1`（用户协议 / 隐私政策）→ 元信息行：`生效日期`、`最后更新`、`版本`。
2. **目录**：`<nav aria-label="本页目录">`，有序列表链接到 `#s1…`；桌面可在 `lg:` 吸顶，移动端折叠（`<details>` 也可，无需 JS）。
3. **章节**：`section id="sN"` + `h2` 文本编号；每章 `mt-10`，段间距 `space-y-4`；列表用 `ul.list-disc`；定义/表格用于「保存期限」「受托方清单」（表格在移动端用 `overflow-x-auto`）。
4. **两页互相链接**：页尾「另见：用户协议 / 隐私政策」。
5. **页尾**：返回首页、返回工作台、联系邮箱、投诉渠道；再补「本政策自 … 起生效」。
6. **打印**：§3.4 的 `@media print`；目录与返回链接打印时隐藏。
7. **移动端可读性**：`max-w-3xl` + `px-4 sm:px-6`；正文 15px/1.75；标题不超 4xl；表格 `min-w-[36rem]` 横向滚动；不做大段居中。

建议章节编号（隐私政策）：
`1 我们是谁 / 2 我们收集哪些信息 / 3 我们如何使用 / 4 委托处理与共享（含跨境）/ 5 存储地点与期限 / 6 照片与敏感个人信息 / 7 AI 处理说明 / 8 Cookie 与本地存储 / 9 你的权利 / 10 账号注销 / 11 安全措施 / 12 未成年人 / 13 政策更新 / 14 联系我们`

建议章节编号（用户协议）：
`1 协议范围与接受 / 2 服务说明 / 3 账号与安全 / 4 点数、套餐与支付 / 5 退款与发票 / 6 用户内容与授权 / 7 使用规范 / 8 AI 生成内容与免责 / 9 知识产权 / 10 服务变更与终止 / 11 责任限制 / 12 争议解决与法律适用 / 13 其他 / 14 联系方式`

> 付款文案需与产品事实一致：当前为演示环境、沙箱支付（`app/page.tsx:517-518`、`components/settings/SettingsScreen.tsx:985`、`lib/pay/index.ts:43-55`）；点数一次性购买、不自动续费（`app/page.tsx:96`）；有效期 90/180/365 天（`lib/credits/catalog.ts`）。

### 6.3 注册 / 登录同意文案（需 Lead 改的具体位置）

| 文件:行 | 现状 | 建议 |
|---|---|---|
| `app/sign-up/[[...sign-up]]/page.tsx:33-41` | 「注册即表示同意《隐私政策》。密码由 Neon Auth 托管…」 | 改为「注册即表示你已阅读并同意《用户协议》与《隐私政策》，并同意我们按《隐私政策》处理你的个人信息。」两个 `Link`：`/terms`、`/privacy`（样式沿用现有 `text-[#1A6BD6] hover:underline`）；「密码由 Neon Auth 托管」保留或移到副标题 |
| `components/auth/SignUpForm.tsx:69-75` | `AuthError` 后直接 `SubmitButton` | 在 `AuthError`（`:69`）与 `SubmitButton`（`:71`）之间插入**必选勾选**：`<input type="checkbox" name="agreeTerms" value="1" required />` + `<label>` 内嵌两个链接；样式沿用 `form-ui.tsx` 的玻璃输入风格（`text-[13px] text-[#58657a]`），`disabled={pending}` |
| `app/sign-up/actions.ts:44-59` | 只校验 email/password | 在 `:52` 后加：`if (formData.get("agreeTerms") !== "1") return { error: "请先阅读并同意《用户协议》与《隐私政策》" };`（服务端强制，客户端 `required` 只做体验） |
| `app/sign-in/[[...sign-in]]/page.tsx:33-41` | 「继续即表示同意《隐私政策》」 | 改为「继续即表示你已阅读并同意最新版《用户协议》与《隐私政策》」并补 `/terms` 链接；注意「继续即表示」不能替代注册时的明示同意 |
| 照片区（未来开放上传时） | `components/editor/FormSections.tsx:782-930` 无同意控件 | 在文件选择器（`:888`）前加**单独勾选**「我同意将照片用于简历排版与导出（敏感个人信息单独同意）」；并在 `lib/actions.ts:300-325` 的 action 内校验，未勾选拒绝上传 |

> 若要可举证（推荐）：在 `users` 表增加 `terms_version`、`privacy_version`、`accepted_at`，注册/重新同意时写入；这属于 DB + auth 流程改动，需 Lead 与隐私/条款审计员对齐后决定，前端审计只标注位置。

### 6.4 页脚 / 导航 / 设置页法律入口放置点

| 位置 | 建议 |
|---|---|
| `app/page.tsx:586-601` Footer | 在「隐私政策」旁加「用户协议」（`:592-597`）；`ICP 备案号`/`公安备案号`待真实号下来后替换，并给工信部/公安备案链接；「问题反馈」换成真实邮箱 |
| `components/auth/AuthShell.tsx:136-152` | 顶部栏「返回官网」旁或 `auth-foot` 下方加一行法律链接（两页都传 footer，页面级文案见 6.3，不必改 AuthShell 也能达成） |
| `components/settings/SettingsScreen.tsx:1108-1120` | 在「隐私政策」行前/后并列「用户协议」行（`/terms`），统一用 `.panel-link` + `Icon name="arrowRight"` |
| `components/settings/SettingsScreen.tsx:330-332` | 账号概览脚注的隐私链接旁可加「用户协议」 |
| `components/app/AppShell.tsx:197-228`（侧栏账户菜单） | 加「隐私政策」「用户协议」两项（`external` 或 `help` 图标），`router.push("/privacy")` / `push("/terms")`；移动端菜单 `:658-691` 同步加一行 |
| `app/(product)/dashboard/settings/page.tsx` | 无需改（入口在 SettingsScreen） |
| 法律页本身 | 页尾「返回首页 / 返回工作台 / 联系邮箱」，两页互链 |

### 6.5 Lead 需要修改/新增的文件与行（汇总）

| 优先级 | 文件 | 行 | 动作 |
|---|---|---|---|
| P0 | `app/privacy/page.tsx` | 全文（4-7、9-38、42-62） | 重写：改掉境内/不共享/交易留存/照片/AI 等不实声明，补 §1.3 章节、日期、目录、联系方式、打印样式 |
| P0 | `app/terms/page.tsx` | 新建 | 用户协议页，同模板 |
| P0 | `app/page.tsx` | 72-74、86-89、380-385 | 三处「境内存储/不跨境」与「单独同意」同步改为事实文案 |
| P0 | `app/sign-up/[[...sign-up]]/page.tsx` | 33-41 | 双法律链接 + 明示同意文案 |
| P0 | `components/auth/SignUpForm.tsx` | 69-75 | 插入必选同意勾选 |
| P0 | `app/sign-up/actions.ts` | 52-54 | 服务端校验 `agreeTerms` |
| P1 | `app/sign-in/[[...sign-in]]/page.tsx` | 33-41 | 补《用户协议》链接与措辞 |
| P1 | `app/page.tsx` | 586-601 | 页脚加《用户协议》、真实备案号/邮箱（待数据） |
| P1 | `components/settings/SettingsScreen.tsx` | 1108-1120、330-332 | 设置页加《用户协议》入口 |
| P1 | `components/app/AppShell.tsx` | 197-228、658-691 | 账户菜单/移动端加法律入口 |
| P2 | `app/sitemap.ts`、`app/robots.ts` | 新建 | 收录 `/`、`/terms`、`/privacy`；屏蔽产品区与认证页 |
| P2 | `app/layout.tsx` | 10-28 | 若需 canonical，补 `metadataBase` |
| P2 | `components/legal/LegalPage.tsx`、`legal.css` | 新建 | 共用模板 + 打印样式 |
| P3 | `components/settings/SettingsView.tsx` | 全文 | 未被引用；删除或标注弃用，避免第二套注销文案 |
| P3 | `.env.example` | 14-20 | 仍是 Clerk 变量（与 Neon Auth 实现不符，`lib/auth/server.ts:13-16` 需要 `NEON_AUTH_*`），建议同步清理（非本任务写入范围） |

### 6.6 验收清单

- [ ] `npm run build` 通过；`next build` 输出中 `/privacy`、`/terms` 为 ○ (Static)。
- [ ] 页面无 `new Date()` / `Math.random()` 等同步 IO；日期为常量。
- [ ] 深浅色模式下正文对比度 ≥4.5:1（强制浅底）。
- [ ] Ctrl+P 打印：隐藏目录与返回链接，A4 边距正常，无白纸/截断。
- [ ] 375 / 768 / 1440 三档截图：正文行宽不超 ~75 字符，目录可点、锚点能跳转。
- [ ] 注册流程：不勾选同意无法提交；服务端也拒绝（可直接 POST Server Action 验证）。
- [ ] 法律页中的供应商名称、区域、支付方式与 `lib/db.ts`/`lib/ai/client.ts`/`lib/pay/index.ts` 实际一致。
- [ ] `sitemap.xml` 含 `/privacy`、`/terms`；`robots.txt` 屏蔽 `/dashboard`、`/editor`、`/settings`、`/sign-in`、`/sign-up`。

---

## 7. 风险与待确认（按优先级）

1. **数据出境（最高）**：Neon 区域未在代码中锁定；`DATABASE_URL`/`NEON_AUTH_BASE_URL`/`NEON_STORAGE_ENDPOINT` 实际区域需运维从控制台导出后确认。若为境外区域，「境内存储」类文案**全部**必须改，且需评估出境合规路径（标准合同/单独同意/安全评估）。
2. **交易记录留存**：条文与级联删除冲突（`drizzle/schema.ts:244-250`），需法务在「删」与「留」之间定口径。
3. **照片**：当前不上传、无单独同意；若产品决定开放上传，务必先做单独同意 + 私有存储（或明确公开 URL 的风险）。
4. **注册同意的可举证性**：当前仅文案，无版本/时间记录；如需满足监管举证，需 DB 字段（超出前端范围）。
5. **备案号**：`app/page.tsx:591` 仍是占位；正式上线前必须替换，法律页页脚建议同步展示。
6. **DeepSeek 数据处理**：`lib/ai/client.ts:18` 默认 `https://api.deepseek.com`；若生产用 `DEEPSEEK_BASE_URL` 指向其他区域/代理，隐私政策的「境内模型服务」需随之调整。
7. **`app/privacy` metadata 缺 `robots` 显式声明**：当前默认 index，可接受；如需与产品区一致策略，明确写出。

---

## 附录 A：本次审计引用的关键文件

- 页面：`app/privacy/page.tsx`、`app/page.tsx`、`app/sign-up/[[...sign-up]]/page.tsx`、`app/sign-in/[[...sign-in]]/page.tsx`、`app/settings/page.tsx`、`app/(product)/dashboard/settings/page.tsx`、`app/(product)/layout.tsx`、`app/(product)/dashboard/layout.tsx`、`app/(product)/editor/layout.tsx`、`app/layout.tsx`。
- 组件：`components/auth/SignUpForm.tsx`、`components/auth/SignInForm.tsx`、`components/auth/AuthShell.tsx`、`components/auth/form-ui.tsx`、`components/settings/SettingsScreen.tsx`、`components/settings/SettingsView.tsx`、`components/app/AppShell.tsx`、`components/editor/FormSections.tsx`。
- 服务端事实：`lib/db.ts`、`lib/auth/server.ts`、`lib/storage.ts`、`lib/ai/client.ts`、`lib/ai/prompts.ts`、`lib/pay/index.ts`、`lib/actions.ts`、`lib/workspace/actions.ts`、`lib/workspace/load.ts`、`lib/ui/prefs.ts`、`drizzle/schema.ts`、`proxy.ts`、`next.config.ts`。
- 样式/文档：`app/globals.css`、`app/app-ui.css`、`components/auth/auth.css`、`components/settings/settings.css`、`docs/dashboard/DESIGN.md`、`plan.md`、`README.md`、`.env.example`。
- Next.js 文档：`node_modules/next/dist/docs/01-app/02-guides/public-static-pages.md`、`.../01-app/02-guides/migrating-to-cache-components.md`、`.../01-app/02-guides/building.md`、`.../01-app/02-guides/keeping-pages-static.md`、`.../01-app/03-api-reference/04-functions/generate-metadata.md`、`.../04-functions/io.md`、`.../03-file-conventions/01-metadata/sitemap.md`、`.../01-metadata/robots.md`、`.../01-metadata/index.md`、`.../03-file-conventions/page.md`、`.../05-config/01-next-config-js/cacheComponents.md`、`.../01-app/01-getting-started/04-linking-and-navigating.md`。

## 附录 B：未做/未读声明

- 未读取 `.env.local`、未发起网络请求、未运行 `next build`、未修改任何代码。
- Neon 实际部署区域、支付渠道真实接入状态、备案主体信息均需运维/法务侧确认，本文件已在对应处标注「待核实」。
