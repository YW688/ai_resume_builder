# Geist 字体（本地自托管）

- 文件：`geist-latin.woff2`（Geist Latin 子集，可变字重 100–900，woff2）
- 来源：Google Fonts 提供的 Geist（由 Vercel 设计），SIL Open Font License 1.1。
- 用途：`app/layout.tsx` 通过 `next/font/local` 加载，避免构建期访问 `fonts.googleapis.com`，也避免运行时向第三方请求字体。
- 许可：SIL OFL 1.1，允许嵌入、分发与商业使用；如需再分发字体文件，请保留版权与许可声明。
