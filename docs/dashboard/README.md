# 产品工作台（演示版）

落地页之外的产品端 UI：用户在这里管理简历、对照 JD 改写、导出 PDF、追踪投递。
当前版本**不接认证 / 数据库 / AI / 支付**，全部数据来自 `lib/mock/` 的硬编码演示数据，
编辑结果保存在浏览器 `localStorage`（key `jianli-demo-v1`），可随时重置。

## 路由

| 路由 | 页面 | 主要功能 |
|---|---|---|
| `/dashboard` | 工作台 | 主推简历体检、匹配度与缺失关键词、近期面试、待办、投递漏斗 |
| `/dashboard/resumes` | 简历库 | 搜索 / 状态筛选 / 排序、新建 / 重命名 / 复制 / 删除、A4 缩略、进编辑器 |
| `/dashboard/jobs` | 目标岗位 | JD 列表与详情、关键词命中 / 缺失、一键加入技能、粘贴 JD 并自动提词 |
| `/dashboard/applications` | 投递追踪 | KPI、漏斗、近期面试、12 条投递记录、记录 / 编辑、阶段切换 |
| `/dashboard/settings` | 设置 | 个人资料、求职偏好、套餐与用量（演示续购）、数据导出 / 重置 / 注销 |
| `/editor?id=r1` | 简历编辑器 | 三栏表单 + 实时 A4 预览、JD 对照改写（模拟）、模板 / 主色、打印导出 PDF |

全局交互：`⌘K / Ctrl+K` 命令面板、通知、账户菜单、移动端导航抽屉、Toast。

> `/settings`、`/sign-in`、`/sign-up` 均为 307 跳转：设置指向 `/dashboard/settings`，
> 登录/注册直接进入工作台（演示版不做身份认证）。

## 演示数据

- 求职者：林晓（产品经理 · 上海）
- 3 份简历：产品经理 · 字节 / 用户增长 · 小红书 / 数据分析 · 美团
- 3 个目标岗位：字节跳动、小红书、美团；24 个唯一关键词
- 12 条投递记录：已投递 4、已读 2、面试中 3、Offer 1、未通过 2
- 30 天通行证，2026-11-05 到期；本月 AI 改写 18 次、导出 4 次

所有匹配度 / 完成度 / 数量 / 日期均由 `lib/mock/compute.ts` 从数据计算，不手写百分比。

## 文件结构

```
app/(product)/
  layout.tsx                 # WorkspaceProvider + app-ui.css
  dashboard/layout.tsx       # AppShell（侧栏 / 顶栏 / 通知 / 命令面板）
  dashboard/page.tsx         # 工作台
  dashboard/{resumes,jobs,applications,settings}/page.tsx
  editor/                    # 三栏编辑器 + editor.css
components/app/              # 共享 UI：AppShell / icons / ui / A4Page / NewResumeDialog
components/{dashboard,resumes,jobs,applications,editor,settings}/
lib/mock/                    # types / data / compute / store / templates
docs/dashboard/DESIGN.md     # 设计规范（唯一事实源）
```

## 命令

```bash
npm run dev        # http://localhost:3000
npm run build
npx tsc --noEmit
npm run lint
```

## 重置数据

侧栏底部 → 用户菜单 → 「重置演示数据」，或设置 → 数据与隐私 → 重置演示数据。
也可以在浏览器控制台执行 `localStorage.removeItem("jianli-demo-v1")` 后刷新。

## 已知边界（演示版有意为之）

- AI 改写 / JD 分析为 700–900ms 的本地 mock，不调用任何模型；结果可「重新生成」并在应用前预览。
- 导出 PDF 走浏览器打印（`window.print()`，打印对话框选择「另存为 PDF」），服务端 PDF 路由未接入。
- 续购 / 注销均为演示流程，不会产生真实支付或删除真实账号。
- 照片仅本地 FileReader 预览，不持久化、不上传；A4 中使用姓名首字母占位。
