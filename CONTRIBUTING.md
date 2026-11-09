# 贡献指南

感谢你愿意改进这个项目。提交改动前请先阅读以下约定。

## 开发环境

- Node.js >= 20.11，npm
- 一个 Neon 项目（Postgres + Auth + Storage），或按 `.env.example` 自行替换为等价服务
- 复制 `.env.example` 为 `.env.local` 并填写变量；**不要把 `.env.local` 提交进 git**

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

## 提交前自检

```bash
npx tsc --noEmit     # 类型检查
npm run lint         # ESLint
npm run build        # 生产构建必须通过
```

## 提交规范

- 一个 PR 只做一件事，改动尽量小，避免无关格式化。
- 提交信息使用 Conventional Commits 风格，例如 `fix(editor): ...`、`feat(pdf): ...`、`docs: ...`。
- 新增依赖前请先开 issue 说明理由（本项目尽量保持零额外依赖）。
- 涉及数据库 schema 的改动：修改 `drizzle/schema.ts` 后用 `npm run db:generate` 生成迁移，并在 PR 中说明迁移影响。

## 不要提交

- 任何真实密钥、`.env*`（`.env.example` 除外）、数据库连接串
- `design/` 下的生成母版与参考素材（体积大、可能含第三方版权内容）
- 本机路径、个人邮箱/手机号等隐私信息

## 安全

发现安全问题请不要公开开 issue，按 [SECURITY.md](SECURITY.md) 私下报告。

## 许可证

提交即表示你同意以 [MIT License](LICENSE) 授权你的贡献。
