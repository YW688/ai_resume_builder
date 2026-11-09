# AI 简历编辑器（中文 · 点数计费）

> **English overview** — An open-source Chinese AI resume builder: fill your resume, paste a target job description, let the LLM rewrite it with JD-aligned wording (credit-based billing), then export a pixel-perfect A4 PDF and track applications. Built with Next.js 16, React 19, Tailwind 4, Drizzle/Neon, Playwright and DeepSeek. See [Quick Start](#快速开始) and [.env.example](.env.example). License: MIT.

面向中文求职者的开源 AI 简历编辑器：**填简历 → 粘贴目标岗位 JD → AI 按点润色/生成 → 导出 A4 PDF → 投递追踪**。

> 状态：MVP / 可运行。默认使用演示数据，生产部署前请按 [SECURITY.md](SECURITY.md) 与 `docs/legal/` 完成合规检查。

![Hero](public/hero/poster.jpg)

## 特性

- **JD 对齐改写**：整份简历生成/润色、单段经历润色、技能栏整理、自我评价润色、对照 JD 改写；按点数计费，服务端原子扣点。
- **A4 PDF 导出**：免费、不限次；服务端 Playwright 渲染，图片域名白名单 + 导出限流。
- **投递追踪**：保存目标岗位、投递记录与阶段，实时同步（Neon Realtime）。
- **邮箱验证码 / 密码登录**：由 Neon Auth 托管，不保存明文密码与验证码。
- **主题与模板**：多套简历模板与主题色，玻璃拟态 Hero（视频/封面按 `prefers-reduced-motion` 降级）。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16.4.2（App Router / Cache Components）+ React 19.3 |
| 样式 | Tailwind CSS 4 + 原生 CSS 变量 |
| 数据 | Drizzle ORM + Neon Postgres（分支/迁移） |
| 认证 / 存储 / 实时 | Neon Auth（Managed Better Auth）/ Neon Storage（S3 兼容）/ Neon Realtime |
| AI | DeepSeek（OpenAI 兼容接口） |
| PDF | Playwright + Chromium |
| 语言 | TypeScript |

## 快速开始

```bash
# 1. 安装依赖（Node.js >= 20.11）
npm install

# 2. 配置环境变量：复制模板并填入自己的 Neon / DeepSeek 凭据
cp .env.example .env.local

# 3. 初始化数据库
npm run db:migrate

# 4. 启动
npm run dev            # http://localhost:3000
```

本地无 DeepSeek Key 时：AI 入口会提示「DeepSeek API 尚未配置」且**不会扣点**；也可用 `AI_MOCK=1 npm run dev` 走本地示例改写（仅非生产生效）。

支付默认使用 `PAY_PROVIDER=manual` 本机沙箱（直接到账、不产生真实扣款），生产环境需接入面包多Pay / 爱发电 / 官方直连，见 `.env.example` 与 [`docs/credits/README.md`](docs/credits/README.md)。

## 常用命令

```bash
npm run dev          # 开发
npm run build        # 生产构建
npm run start        # 生产启动
npm run lint         # ESLint
npx tsc --noEmit     # 类型检查

npm run db:generate  # 修改 schema 后生成迁移
npm run db:migrate   # 应用迁移
npm run db:seed      # 演示数据
```

## 计费模型

旧「30 天通行证」已下线，改为 **AI 点数**：

| 能力 | 点数 |
|---|---|
| 整份简历 AI 生成 / 整份润色 | 2 |
| 项目/工作经历单段润色 | 1 |
| 技能栏整理 | 1 |
| 自我评价润色 | 1 |
| 对照 JD 改写单段 | 1 |
| PDF 导出 | 0（免费、不限次） |

- 每日免费 5 点（北京时间 0 点重置，不累积）；先扣免费额度，再扣购买余额。
- 套餐：体验包 ¥9.9 / 12 点 · 求职包 ¥29.9 / 45 点 · 冲刺包 ¥69 / 120 点；一次性购买，不自动续费。
- 定价与利润测算：[`docs/pricing/README.md`](docs/pricing/README.md)；点数实现：[`docs/credits/README.md`](docs/credits/README.md)。

## 目录结构

| 路径 | 内容 |
|---|---|
| `app/` | App Router 页面与 API 路由（`app/(product)/` 为登录后工作台/编辑器/设置） |
| `components/` | UI 组件（编辑器、工作台、设置、认证） |
| `lib/` | 业务逻辑：`lib/credits/` 点数、`lib/pay/` 支付、`lib/ai/` DeepSeek、`lib/workspace/` 工作区、`lib/auth/` 认证 |
| `drizzle/` | Drizzle schema 与迁移 |
| `public/` | Hero 视频/封面、品牌资源、演示图片 |
| `scripts/` | 本地验证、数据迁移、Hero 素材生成脚本 |
| `docs/` | 产品计划、定价、点数、认证、视觉手册 |
| `legal-docs/` | 服务条款 / 隐私政策草稿（需法务审阅后使用） |

## 安全与隐私

- 仓库不包含任何密钥；`.env.local`、`.codex/`、`.claude/settings.local.json` 均被忽略。
- 生产环境演示提权入口（重置演示数据 / 续费）已禁用，新用户默认免费计划、0 点数。
- 支付回调使用 HMAC-SHA256 验签与幂等入账；PDF 导出对图片来源做白名单校验。
- 漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 关于视觉素材

`public/hero/*`、`public/og-hero.jpg`、`public/art/*` 是本项目使用 AI 生成（阿里云百炼 Qwen-Image / 万相）的成品，随仓库分发仅用于演示。`design/` 目录（生成母版、参考视频与截图）**不包含在本仓库中**，因为体积大且参考素材可能涉及第三方版权；如需重新生成，请阅读 [`docs/hero-visual/00-INDEX.md`](docs/hero-visual/00-INDEX.md) 并自备参考素材与 API Key（按次计费）。

## 文档

- 产品事实与实施计划：[`plan.md`](plan.md)
- 视觉与 Hero 手册：[`docs/hero-visual/00-INDEX.md`](docs/hero-visual/00-INDEX.md)
- 认证 / 定价 / 点数 / 法务审计：[`docs/`](docs)

## 贡献

欢迎提交 issue 与 PR，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交前请运行 `npx tsc --noEmit` 与 `npm run build`。

## 许可证

[MIT License](LICENSE) © 2026 YW688

第三方依赖与素材的许可分别归其各自作者所有；`legal-docs/` 中的条款与隐私政策为草稿，不构成法律意见。
