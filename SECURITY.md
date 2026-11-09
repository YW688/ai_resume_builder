# 安全策略

## 报告漏洞

请不要在公开 issue 中披露安全问题。请通过以下方式私下联系维护者：

- GitHub Security Advisories：在仓库 **Security → Report a vulnerability** 提交
- 或发送邮件至：`<maintainer-email>`（请自行替换为有效邮箱）

请尽量包含：影响版本、复现步骤、影响范围、可能的修复建议。我们会在 7 个工作日内回复。

## 密钥泄露处理

- 本仓库不包含任何真实密钥；`.env.local`、`.codex/`、`.claude/settings.local.json` 均已被 `.gitignore` 忽略。
- 如果你在历史提交、issue 或 PR 中发现疑似密钥，请立即按上面的方式报告，**不要在公开渠道粘贴完整密钥**。
- 维护者收到报告后会轮换对应密钥、清理历史并强制推送。

## 支持范围

仅对默认分支 `main` 的最新提交提供安全修复。
