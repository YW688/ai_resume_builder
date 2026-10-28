# 登录与邮箱验证码（Neon Auth + Neon Postgres）

本目录记录当前登录系统的实现、QQ 邮箱发信配置步骤与隐私边界。

## 1. 架构

```
浏览器 /sign-in
  ├─ 验证码登录（默认） components/auth/EmailCodeForm.tsx
  │    ├─ 发送：authClient.emailOtp.sendVerificationOtp()
  │    └─ 校验：Server Action signInWithEmailCode() → auth.signIn.emailOtp()
  └─ 密码登录（备选）  components/auth/SignInForm.tsx → signInWithEmail()
        │
        ▼
app/api/auth/[...path]/route.ts（同源代理）
        ▼
Neon Auth（Managed Better Auth，分支级）
  ├─ neon_auth.user / session / account / verification（Neon Postgres）
  └─ 邮件服务：自定义 SMTP（当前为 QQ 邮箱 / Foxmail 别名）
        ▼
应用数据：public.users（首次登录后由 lib/workspace/load.ts 补建，仅 id/email/name）
```

- 认证与数据库都在同一个 Neon 项目 / `production` 分支（`us-east-2`）。
- 未注册邮箱使用验证码登录时**自动创建账号**（Better Auth `disableSignUp=false`），
  昵称默认取邮箱前缀；之后可在设置里修改。
- 应用侧不新增表：验证码记录由 Neon Auth 写入 `neon_auth."verification"`，值为不可读的
  加密/摘要形式（本仓库实测为 45 字符非明文），应用代码不读取、不打印。

## 2. 环境变量

无需新增变量。沿用 `.env.local`（已 gitignore）中的：

| 变量 | 用途 |
| --- | --- |
| `NEON_AUTH_BASE_URL` | 分支的 Managed Auth URL |
| `NEON_AUTH_COOKIE_SECRET` | 应用侧会话 cookie 加密密钥（32+ 字符） |
| `NEON_AUTH_JWKS_URL` | JWT 校验（Functions / Realtime） |
| `DATABASE_URL` | 应用数据库（Drizzle） |

SMTP 凭据**不写入本项目**：保存在 Neon Auth 的邮件服务配置中。

## 3. 用 QQ 邮箱发验证码（由项目管理员在 Neon 控制台配置）

> ⚠️ 不要把自己的 QQ 密码填进任何地方；这里需要的是 QQ 邮箱的「SMTP 授权码」。
> 授权码可随时在 QQ 邮箱设置中删除/重置，且只授予 SMTP 发信权限，不能读取邮件。

1. QQ 邮箱网页版 → 设置 → 账号 → 开启「POP3/IMAP/SMTP 服务」→ 生成「授权码」。
   - 建议使用**专用邮箱**（小号）或邮箱别名，避免个人 QQ 号出现在每封验证码邮件的
     发件人地址里；收件人能看到发件邮箱地址。
2. Neon Console → 选中项目 → **Settings → Better Auth** → Email provider：
   - 选择 **Custom SMTP provider**
   - Host：`smtp.qq.com`
   - Port：`465`（SSL）
   - Username：完整 QQ 邮箱地址
   - Password：上一步的 SMTP 授权码
   - Sender email：与 Username 相同的 QQ 邮箱地址
   - Sender name：`AI 简历编辑器`
3. 保存后可在同一页面发送测试邮件；或在 Neon 控制台 / API 调用
   `POST /projects/{project_id}/branches/{branch_id}/auth/send_test_email`。
4. 配置切换无需改代码或重启应用；下一次「获取验证码」即走 QQ SMTP。

CLI 等价命令（会包含授权码，请勿粘贴到公开渠道，也不要把该命令写进仓库）：

```bash
neon neon-auth config email-provider update \
  --type standard --host smtp.qq.com --port 465 \
  --username <QQ邮箱> --password <SMTP授权码> \
  --sender-email <QQ邮箱> --sender-name "AI 简历编辑器"
```

当前状态（2026-10-28 核实）：Neon 侧已配置**自定义 SMTP**（`smtp.qq.com:465`，应用名
「AI 简历编辑器」，发件人为 Foxmail 别名 `m***@foxmail.com`）；已用一次性测试邮箱实测
「QQ 邮箱发信 → 收码 → 登录」全链路 10/10 通过。可用
`node scripts/auth/check-smtp.mjs` 查看当前 SMTP 类型/主机/端口与掩码后的发件地址。

## 4. 隐私边界（实现层面）

- 验证码：由 Neon Auth 生成/发送/校验；应用代码不写日志、不进数据库、不写 localStorage。
- 邮箱密码：仅存在 Neon Auth；应用侧只有会话 cookie 与 `public.users` 的 id/email/name。
- SMTP 授权码：只存在 Neon Auth 配置中，本项目仓库、代码、文档均不包含。
- 会话 cookie：由 `@neondatabase/auth` 写入 HttpOnly cookie；`proxy.ts` 只负责保护路由。
- 开放重定向：`redirect_url` 经 `lib/auth/redirect.ts` 的 `safeInternalPath()` 过滤。
- 限流：发送/校验由 Neon Auth 内置限流（错误码 `over_request_rate_limit` 等），
  前端另有 60 秒重发冷却；验证码最多尝试 3 次。
- 已同步更新 `data/legal/privacy.json` 与 `data/legal/terms.json`（登录方式、邮件发送
  受托方、凭据安全），并重新生成 `legal-docs/`。

## 5. 验证

```bash
# HTTP 端到端（真实发信、一次性测试邮箱收码、自动注册、会话、登出）
node scripts/auth/e2e-otp.mjs

# 浏览器点击级端到端（验证码 Tab、发送冷却、自动注册、登出、密码 Tab）
node scripts/auth/e2e-otp-ui.mjs

# 查看当前 SMTP 配置（发件地址掩码显示，不打印密钥）
node scripts/auth/check-smtp.mjs

# 类型检查 / 生产构建
npx tsc --noEmit
npm run build
```

`e2e-otp.mjs` 会创建一次性测试邮箱（mail.tm），读取验证码完成登录，结束后删除测试账号、
验证码记录与临时收件箱；不会使用个人邮箱，也不会打印验证码或完整发件地址。也可用
`OTP_E2E_OTP=<收到的验证码>` 跳过收信，或用 `OTP_E2E_BASE` 指定服务地址。

浏览器级检查：

```bash
node scripts/auth/e2e-auth.mjs   # 原密码登录全流程回归
```

## 6. 临时公网演示（cloudflared quick tunnel）

`cloudflared tunnel --url http://localhost:3000` 生成的 `*.trycloudflare.com` 每次重启都会变。
**Neon Auth 只接受 Trusted domains 白名单内的 Origin**，未登记的域名会返回
`403 INVALID_ORIGIN`，表现为：隧道首页能打开，但登录时报「登录失败，请稍后重试」，
`/dashboard` 又被踢回 `/sign-in`。旧域名在 cloudflared 断线后还会变成 **530**。

用下面的命令代替裸 `cloudflared`：它会拉起隧道、解析新域名、自动写入 Neon Auth
Trusted domains，并清掉上一条 `*.trycloudflare.com` 记录（可用 `--keep-old` 保留）。

```bash
npm run tunnel                 # 默认指向 http://localhost:3000
npm run tunnel -- --keep-old   # 保留历史 trycloudflare 白名单记录
TUNNEL_URL=http://localhost:3100 npm run tunnel   # 指向其它端口
```

> 已知限制：quick tunnel 无可用性保证，网络抖动断线后会返回 530，重新 `npm run tunnel`
> 即可（会拿到新域名并自动重新登记）。需要**固定域名**做正式演示时，应改用 Cloudflare
> Named Tunnel + 自有域名，或直接部署到生产域名并把它加进 Trusted domains。

手工兜底（不加脚本时）：Neon Console → 项目 → **Settings → Better Auth → Trusted domains**
加入当前 `https://<xxx>.trycloudflare.com`；或调用 API
`POST /projects/{project_id}/branches/{branch_id}/auth/domains`
（body：`{"domain":"https://…","auth_provider":"better_auth"}`）。
已实测：登记后隧道内「密码登录 → /dashboard → 刷新会话保持」全链路通过（2026-10-29）。

## 7. 生产上线清单

- [ ] Neon Auth → Trusted domains 加入生产域名（当前仅有 `http://127.0.0.1:3000`；
      临时演示域名用 §6 的 `npm run tunnel` 自动登记）。
- [ ] 生产环境关闭 Allow Localhost（Settings → Better Auth）。注意：当前本地开发也指向
      `production` 分支，建议先拆出 dev 分支再关闭 localhost，否则本地无法登录。
- [x] 应用名、发件人名称、自定义 SMTP 配置。
- [x] 验证 QQ 邮箱收件链路（一次性测试邮箱实测通过；QQ → QQ 送达率最好）。
- [ ] 复核 `data/legal/*.json` 中的跨境与受托处理方描述，补齐运营主体/联系方式/区域/
      跨境合规机制占位符。
