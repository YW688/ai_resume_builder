# 简历编辑器 · 产品工作台 UI 设计规范（v1 · 演示数据版）

> 本文件是本次「落地页之外的产品端」唯一事实源。所有页面、组件、文案、交互以本文件为准。
> 所有数据来自 `lib/mock/` 的硬编码演示数据，不接认证 / 数据库 / AI；所有交互在浏览器内真实可用。

---

## 1. 一句话概念

**产品：** 面向国内求职者的中文 AI 简历编辑器。核心闭环：填简历 → 粘贴 JD → 对照关键词逐段改写 → 导出 A4 PDF → 追踪投递。

**工作台要回答的一个问题：** 「下一次投递之前，这份简历还差什么？」
**一个发现（放在标题行下方）：** 「字节的 JD 里还有 2 个关键词没写进简历：SQL、A/B 测试。」

**设计隐喻（页面属于这个产品，而不属于任何模板）：** 简历是**一张 A4 纸**。
侧边栏是**桌面**（带一点品牌蓝的浅灰），内容是一张**白色纸面**；每一份简历都用**真实的 A4 缩略页**出现，而不是灰色占位条。A4 纸是整套 UI 的签名元素：列表、卡片、编辑器预览、打印导出都用同一个页面组件渲染。

**App 风格：** `framed-sheet`（浅色）。侧边栏 + 48px 顶栏共用一层淡蓝灰底，内容是一张内嵌 8px、16px 圆角、1px 边线的白纸，没有阴影。安静、扁平、靠 1px 线和一档色阶分层。

---

## 2. 品牌与 Token（唯一来源 `app/app-ui.css`）

沿用落地页色板：蓝 `#1A6BD6`、墨 `#0E1B2A`、云 `#F4F8FC`、粉 `#E5355B`、日光黄 `#FFE9B0`。

| Token | 值 | 用途 |
|---|---|---|
| `--ui-chrome` | `#EDF2F8` | 侧边栏 + 顶栏底色（品牌蓝的低饱和一档） |
| `--ui-chrome-2` | `#E4EBF4` | 导航 hover、chrome 上的次级表面 |
| `--ui-surface` | `#FFFFFF` | 纸面、面板 |
| `--ui-raised` | `#F7F9FC` | 内嵌井、表格行 hover、输入框底 |
| `--ui-active` | `#E8EEF6` | 选中行、激活导航 pill |
| `--ui-border` | `#E2E8F0` | 面板 / 纸面边线（约 1.15:1） |
| `--ui-rule` | `#EEF1F5` | 行分隔线 |
| `--ui-control` | `#CDD6E1` | 输入框、描边按钮的边线 |
| `--ui-text` | `#0E1B2A` | 主文字 / 近黑主按钮 |
| `--ui-muted` | `#58657A` | 次级文字（白底 5.4:1） |
| `--ui-faint` | `#6B7688` | 元信息 / 占位（白底 4.5:1） |
| `--ui-accent` | `#1A6BD6` | 唯一数据色：匹配度、进度、图表、关键数字、链接 |
| `--ui-accent-soft` | `#E9F1FC` | 蓝色淡底（badge、选中 chip、表格高亮） |
| `--ui-pink` | `#E5355B` | 仅品牌标记圆点与「AI」星标；不作为大面积色 |
| `--ui-sun` | `#FFE9B0` | 关键词命中高亮（纸面 mark） |
| `--ui-positive` / `--ui-negative` / `--ui-warning` | `#247B50` / `#C4242A` / `#92400E` | 仅状态语义 |

- **半径只允许三档：** 纸面/大容器 16px，面板 8px，控件 6px，胶囊 999px。不要再出现 10/12/14px。
- **没有渐变、玻璃、发光、图标彩色方块、KPI 迷你折线、emoji、lorem。**
- 只用 Geist（`--font-geist-sans`）+ 系统中文字体（PingFang / 微软雅黑）。数字一律 `font-variant-numeric: tabular-nums`（类 `.num`）。
- 字号：页面标题 24/600；卡片标题 16/600；正文 14/1.65；元信息 12；KPI 28/600；匹配度大数字 32–36/600。最大不超过 40px。
- 颜色预算 <3%：彩色只出现在匹配度环、进度条、主数据、状态 pill 和一条链接上；导航、按钮、边框全是墨/灰。主按钮 = 墨底白字（`.btn-primary`）；蓝色只做数据与焦点。
- 焦点态：`:focus-visible` 用 2px `--ui-accent` 外描边，偏移 2px。

---

## 3. 外壳（唯一 `components/app/AppShell.tsx`）

### 3.1 结构

```
.app-shell  grid: 232px | 1fr；整屏 100svh；背景 --ui-chrome
├─ aside.app-sidebar  sticky 100svh
│   ├─ brand（纸页 SVG 标记 + “简历编辑器” + 小字“AI 求职工作台”）
│   ├─ scope（林晓的求职工作台 · 上海）
│   ├─ nav：工作台 / 简历库 / 目标岗位 / 投递追踪
│   ├─ 底部：设置（底部推到底）、plan-card、user 行
├─ div.app-main  flex column
│   ├─ header.app-topbar (48px)
│   │   ├─ 左：面包屑（工作台 / 当前页）
│   │   ├─ 中：搜索按钮（⌘K）
│   │   └─ 右：通知、用户菜单
│   └─ main.app-sheet  > .app-content（padding 24–28px，最大宽 1216 居中）
```

- 顶栏和侧栏同一底色，**中间没有分隔线**。白纸从侧栏右侧、顶栏下方开始，右边/下边各内嵌 8px，16px 圆角，1px 边线，**无阴影**。
- 导航行高 34px，图标 16px，label 14px。激活项：白底 pill + 墨色文字（不是蓝底，不是左侧蓝条）；hover 为 `--ui-chrome-2`。
- 侧栏底部 plan-card：`30 天通行证`、剩余天数（由 `expiresAt` 计算）、本月 AI 改写次数、细进度条、`续购` 链接（去设置·套餐）。下面 user 行：圆形首字母头像「林」、名字、邮箱、更多菜单。
- 侧栏最底部一行小字：`演示工作区 · 数据只保存在本机`。
- 顶栏搜索：白底 32px 高、圆角 6px，左侧放大镜，右侧 `⌘K` 键帽。点击打开命令面板。
- 通知：铃铛 + 未读蓝点；popover 列出 `notifications`，可「全部标为已读」。
- 用户菜单：设置、导出数据、返回官网（`/`）、重置演示数据（二次确认）。
- 移动端（<900px）：隐藏侧栏；顶栏 48px（菜单按钮 + 当前页名 + 一个操作）。菜单按钮打开全屏 nav sheet（含品牌、导航、plan、用户）。白纸变全屏，去圆角和边线，padding 16px。

### 3.2 页面通用骨架

- 每页一个 `h1.page-title`（24/600），下面一行 14px 灰副标题（数据范围 / 发现）。右侧最多一个主按钮 + 一个次按钮 + 新鲜度时间戳。
- 内容区第一行到标题 20–24px；页面内 12 栏栅格（`.grid-12`），gap 16px；卡片在 1440 宽度下满行、对齐左右边。**同一行卡片底边对齐**。
- 面板统一 `.panel`：白底、1px `--ui-border`、8px 圆角、**无阴影**。头部 16/12 padding，标题 16/600，右侧可放时间/链接。正文 20px padding。
- 表格：12px 灰字 sentence-case 表头、无底色、无斑马纹；数字右对齐 tabular；行高 56px；行线 1px `--ui-rule`；状态 pill 20px 高、11–12px。
- 空状态：保留面板与标题，一句说明 + 一个操作，1px 虚线框（高 48–64px）。不要插画。
- 载入态：不用全屏 spinner；按钮内 loading + 骨架条。演示环境的异步（AI 改写、JD 分析）用 700–900ms 延迟模拟。

---

## 4. 共享组件 API（写页面时直接 import，禁止另起炉灶）

### 4.1 `components/app/icons.tsx`

```tsx
export type IconName = "home" | "file" | "target" | "send" | "settings" | "plus" | "search" |
  "bell" | "chevronDown" | "chevronRight" | "chevronLeft" | "arrowLeft" | "arrowRight" |
  "arrowUp" | "arrowDown" | "more" | "close" | "check" | "sparkle" | "download" | "printer" |
  "edit" | "copy" | "trash" | "clock" | "calendar" | "external" | "menu" | "zoomIn" | "zoomOut" |
  "filter" | "grid" | "list" | "undo" | "eye" | "link" | "logout" | "help" | "refresh" | "user" |
  "briefcase" | "chart" | "lock" | "warning" | "info" | "upload" | "mail" | "phone" | "pin" |
  "star" | "drag" | "checkCircle" | "sparkles" | "fileText" | "sliders" | "chevronUp";
export function Icon({ name, size = 16, strokeWidth = 1.6, className }: {...})
```
统一 24×24 viewBox、`fill="none"`、`stroke="currentColor"`、圆角线帽；16/18/20 三种尺寸。

### 4.2 `components/app/ui.tsx`（`"use client"`）

```tsx
<Btn variant="primary|secondary|ghost|danger" size="sm|md|lg" icon? iconRight? loading? block?>…
<IconBtn label icon size? variant? />
<Pill tone="neutral|accent|positive|warning|negative|outline" dot?>…
<Progress value={0-100} tone? showValue? label? />
<Ring value={0-100} size={48} stroke={4} />            // 匹配度环，蓝弧 + 墨色数字
<Modal open onClose title description? footer? size="sm|md|lg" children />
<ConfirmDialog open onClose onConfirm title description confirmLabel tone? />
<Menu trigger={<button…>} items={[{label, icon?, onSelect, danger?, disabled?}]} align="left|right" />
<EmptyState icon? title description? action? />
<Field label hint? error? htmlFor? children />
<Toggle checked onChange label? description? id? disabled? />
<Segmented options={[{value,label}]} value onChange ariaLabel />
<KeywordChip label state="hit|missing|neutral" onClick? />
<Spinner size? />
```
- `Modal` 用 `createPortal` 挂到 body；Esc 关闭、点遮罩关闭、焦点移入/归还、Tab 环形；移动端底部抽屉（宽 100%，圆角 16 顶部）。
- 所有按钮/图标按钮必须可键盘操作、有 `aria-label`（图标按钮）或可见文字；禁用态保留可读性并说明原因。

### 4.3 `components/app/A4Page.tsx`

```tsx
<A4Page resume={resume} variant={templateId} accent={accent} highlight={keywords?} className? />
<A4Thumb resume={resume} variant? accent? job? width={160} className? />
```
- A4 真尺寸画布：`.a4-page` 794×1123px，白底、纸面内边距 56px 60px，实际渲染简历内容（姓名、联系方式、简介、经历、教育、技能），不是灰条。
- 三套模板：`classic` 单栏、`split` 左侧 30% 侧栏、`compact` 紧凑单栏。
- `highlight` 给出关键词时，在文本中把命中的词包成 `<mark class="a4-kw">`（日光黄底、无圆角或 2px）。
- `A4Thumb` 用 CSS `transform: scale()` 缩放真实页面，外面固定宽度 + `overflow:hidden` + 1px 边线；尺寸 `width` 默认 160（高 226）。
- 纸面允许一层很轻的悬浮阴影（它是“漂浮的纸”），但面板/卡片不允许。

### 4.4 `lib/mock/`

```ts
// types.ts
export type TemplateId = "classic" | "split" | "compact";
export type AccentId = "blue" | "ink" | "green";
export type ResumeStatus = "draft" | "ready" | "applied" | "archived";
export type Experience = { id; company; title; startDate; endDate; description };
export type Education = { id; school; degree; major; startDate; endDate };
export type Resume = { id; title; targetJobId: string | null; fullName; phone; email; city;
  summary; skills: string[]; experiences: Experience[]; educations: Education[];
  templateId: TemplateId; accent: AccentId; status: ResumeStatus; updatedAt: string; createdAt: string };
export type Job = { id; company; title; location; salary; source; savedAt; keywords: string[]; jdText };
export type ApplicationStage = "applied" | "read" | "interview" | "offer" | "rejected";
export type Application = { id; company; role; resumeId; stage; appliedAt; nextStep?; nextAt?; note? };
export type Notification = { id; title; body; at; read; kind: "plan" | "application" | "resume" };
export type Plan = { name; startedAt; expiresAt; priceFen; autoRenew; orders: Order[] };
export type Order = { id; at; amountFen; label; status: "paid" };
export type User = { name; email; phone; city; targetRole; joinedAt };
export type Preferences = { targetRoles: string[]; cities: string[]; salary: string; jobType: string;
  weeklyDigest: boolean; autoKeywordCheck: boolean };
export type WorkspaceState = { user; preferences; plan; resumes; jobs; applications; notifications; };
```

```ts
// compute.ts —— 所有派生的数字必须走这里，禁止页面里手写总数 / 匹配度
computeCompletion(resume): number            // 0–100，字段完整度
computeMatch(resume, job): { score: number; hit: string[]; missing: string[] }
daysLeft(plan, now?): number
formatDate(iso, style: "short" | "long" | "relative"): string
formatDateTime(iso)
formatMoney(fen): string                    // "¥19.00"
stageLabel(stage): string                   // 已投递 / 已读 / 面试中 / Offer / 未通过
stageTone(stage): "neutral" | "accent" | "positive" | "negative" | "warning"
applicationCounts(applications): { total; active; interview; offer; rejected; thisWeek }
```
- 匹配度 = 命中关键词数 / JD 关键词数（四舍五入）。命中判断：把简历的 summary、skills、每段经历描述拼成文本，检查是否包含该关键词（中文字符串包含，忽略大小写）。
- 总览、列表、编辑器三处显示的匹配度 / 完成度必须来自同一函数。

### 4.5 `lib/mock/store.tsx`

```tsx
"use client";
export function WorkspaceProvider({ children })
export function useWorkspace(): {
  state: WorkspaceState;
  // 读取
  resume(id): Resume | undefined; job(id): Job | undefined;
  // 写
  updateResume(id, patch: Partial<Resume>): void;
  createResume(input?: { title?; targetJobId?; templateId? }): string;   // 返回新 id
  duplicateResume(id): string;
  deleteResume(id): void;
  addJob(input: { company; title; location?; salary?; source?; jdText; keywords?: string[] }): string;
  updateJob(id, patch: Partial<Job>): void;
  deleteJob(id): void;
  addApplication(input: Omit<Application, "id">): string;
  updateApplication(id, patch: Partial<Application>): void;
  deleteApplication(id): void;
  updateUser(patch: Partial<User>): void;
  updatePreferences(patch: Partial<Preferences>): void;
  markAllNotificationsRead(): void;
  renewPlan(): void;                       // 演示续购：+30 天并追加订单
  resetDemo(): void;                       // 恢复初始硬编码数据
  exportData(): void;                      // 下载 JSON
  toast(input: { title: string; description?; tone?: "default" | "positive" | "negative" }): void;
}
```
- state 持久化到 `localStorage`（key `jianli-demo-v1`），首次访问使用硬编码种子数据；`resetDemo` 清除。
- 所有写操作后自动保存；页面无需自己持久化。
- `ToastViewport` 由 provider 渲染，右下角堆叠，3.5s 自动消失，带关闭按钮，`role="status"`。
- 禁止在页面里直接修改 `state`。

---

## 5. 演示数据（`lib/mock/data.ts`，唯一数据源）

**用户：** 林晓 · 产品经理 · 上海 · linxiao@example.com · 138 0000 0000。
**通行证：** 30 天通行证，2026-10-06 开通，2026-11-05 到期（按 `daysLeft` 显示剩余天数），¥19，不自动续费；订单 2 笔（10-06、09-05）。
**用量：** 本月 AI 改写 18 次、导出 4 次；简历 3 份（通行证不限量）。

**目标岗位（3）：** 字节跳动 · 高级产品经理（30–50K·15 薪，BOSS 直聘）；小红书 · 用户增长经理（25–40K）；美团 · 数据分析师（20–35K）。每个 JD 12 / 10 / 10 个关键词，带完整 JD 文本。
**简历（3）：** 「产品经理 · 字节」（目标字节，83% 匹配，缺 SQL、A/B 测试）、「用户增长 · 小红书」（已投递，80%）、「数据分析 · 美团」（草稿，60%）。
**投递（12 条）：** 覆盖 已投递 / 已读 / 面试中 / Offer / 未通过；本周投递 4 条；近期面试 3 场（10-24 10:30 拼多多二面、10-27 14:00 小红书一面、10-28 16:00 阿里二面）。
**通知（3）：** 通行证到期、面试提醒、简历未更新。

**数据真实性要求：**
- 所有数字从行计算，不写死。KPI 的「本周投递」= 周一至今的 applications 数；漏斗 = 投递总数 → 进入筛选（已读+面试+offer）→ 面试 → offer。
- 简历正文文字必须真的包含要展示为「命中」的关键词；缺的关键词不能偷出现在正文里。
- 不用 Lorem / Acme / 张三；所有公司、职位、日期、金额成体系。

---

## 6. 页面规格

### 6.1 工作台 `/dashboard`（`components/dashboard/OverviewScreen.tsx`）

**h1：** 工作台。
**副标题：** `3 份简历 · 2 个目标岗位 · 本周 4 次投递`（全部计算）。
**右侧：** 新鲜度 `更新于今天 09:42` + 次按钮「新建简历」（打开新建弹窗，可直接复用简历库的创建逻辑：简单版 → 创建后跳 `/editor?id=`）。
**发现句（标题下方，14px，墨色）：** 当前主推简历对「字节跳动 · 高级产品经理」还缺 **SQL、A/B 测试** 2 个关键词。

栅格（12 栏）：
1. **主块（8 栏）· 简历体检**：左半是主推简历信息（名称、目标岗位、状态 pill、完成度进度条、匹配度 32–36px + `/100`、命中 `10/12`、缺失关键词 chips「继续编辑」主按钮 + 「查看 JD」链接）；右半是 200px 宽的 A4 缩略页（真实渲染，命中关键词高亮）。卡片高度约 300–340px。这是整屏最大的东西，直接回答标题问题。
2. **近期安排（4 栏）**：标题「近期安排」+ `3 场`；3 行日期/时间/公司/轮次（10-24 周六 10:30 拼多多 · 二面 视频；10-27 周二 14:00 小红书 · 一面；10-28 周三 16:00 阿里 · 二面），每行右侧「详情」链接到投递追踪。底部「查看全部投递 →」。
3. **KPI 条（12 栏，一个面板 4 等分，1px 分隔，无图标无迷你图）**：简历 3 份；目标岗位 3 个；本周投递 4 次；匹配度 83 / 100（或「AI 改写 18 次」）。标签 12px 灰，值 24–28px 墨，单位小号灰。
4. **待办（4 栏）**：3–4 条，每条一行：事项 + 关联对象 + 右侧操作按钮（继续编辑 / 查看 / 更新状态）。事项来自真实数据：补齐字节 JD 缺失关键词；「数据分析 · 美团」完成度 60%；更新「拼多多」二面结果？不要造没有的事实——改为「投递追踪里有 3 条待更新状态」。
5. **投递进展（8 栏）**：左：漏斗 4 行（投递 12 → 进入筛选 6 → 面试 3 → Offer 1），每行横向细条（蓝，长度=比例），数字右对齐；右：最近投递 3 行（公司/岗位、时间、阶段 pill），底部「查看全部投递 →」。
6. 行高平衡：2 与 3 之间的间距 16px；4 与 5 一行，底边对齐；总屏高 900px 内至少看到 1、2、3 和 4/5 的标题与首行。

**交互：** 主按钮进 `/editor?id=<主推简历>`；A4 缩略点击进编辑器；近期安排「详情」进 `/dashboard/applications`；待办操作可跳转或直接改状态（用 store + toast）。KPI 无交互。新建简历弹窗（标题 + 目标岗位 + 模板）→ 创建后进入编辑器。

### 6.2 简历库 `/dashboard/resumes`（`components/resumes/ResumesScreen.tsx`）

- **h1：** 简历库。副标题：`共 3 份 · 最近更新 今天 09:42`。右侧：主按钮「新建简历」。
- 工具栏：搜索（标题 / 目标岗位），筛选 chips `全部 3 / 草稿 2 / 已投递 1 / 已归档 0`（数量计算），排序 `最近更新 / 匹配度 / 完成度`。
- 内容：3–4 列卡片栅格（1440 下 4 列，768 下 2 列，手机 1 列），每张卡片：顶部 A4 缩略（宽 100%，比例 1:1.414，白纸 + 轻阴影）；下面标题、目标岗位 / 未设目标、状态 pill、匹配度（带环或数字）、完成度细条、更新时间；右上角更多菜单（编辑 / 重命名 / 复制 / 导出 PDF / 删除）。卡片 hover：边线加深一档，不上浮、不放大。
- 「新建简历」虚线卡片放最后：+ 新建，点击打开弹窗（标题、目标岗位 select、模板 3 选 1）。
- 重命名弹窗、删除确认弹窗；删除后 toast 可「撤销」？——简化：确认弹窗写清后果，删除后 toast「已删除」即可。
- 搜索 / 筛选无结果：保留工具栏 + 空状态（「没有符合条件的简历」+ 清除筛选）。
- 导出 PDF：跳转编辑器并触发打印（`/editor?id=...&print=1`）——编辑器读取 `print=1` 后自动打开打印对话框，若实现成本高则 toast「已打开导出预览」并进入编辑器。以简单可靠为准。
- 每张卡片需显示「示例」小 pill 吗？不需要，侧栏已声明演示数据。

### 6.3 目标岗位 `/dashboard/jobs`（`components/jobs/JobsScreen.tsx`）

- **h1：** 目标岗位。副标题：`已保存 3 个岗位 · 覆盖 24 个关键词`。右侧：主按钮「粘贴 JD」。
- 两栏：左 5/12 岗位列表（每行：公司 + 职位、地点/薪资、保存时间、最佳匹配度、当前选中的 1px 蓝左标？——用 2px 下划线或白底 pill 表示选中，不用彩色侧条）；右 7/12 详情。
- 详情：公司 · 职位标题、元信息行（地点 · 薪资 · 来源 · 保存于）、操作（「用这份 JD 改写」主按钮 → 打开简历选择/直接进入主推简历编辑器；「删除」文本按钮）。下方两栏：`关键词命中 10/12`（chips：命中=淡蓝底蓝字 + 对勾，缺失=灰边 + 加号，可点击加入简历技能？——点击把词加到简历 skills 并 toast，真实可用）；右侧 `匹配的简历` 列表（3 条：名称 + 匹配度 + 编辑）。再下方 JD 原文（限高 260px 滚动，关键词用 `<mark>` 高亮）。
- 「粘贴 JD」弹窗：公司、职位、地点、薪资、来源、JD 原文；点击「保存并分析」→ 模拟 800ms → 从 JD 文本中按关键词词典提取关键词（见 data 的 `KEYWORD_DICTIONARY`），保存岗位、选中并 toast。
- 删除确认：若被简历引用，提示「3 份简历的目标岗位不会自动更改」。
- 空状态：没有岗位时保留右侧框架 + 主按钮。

### 6.4 投递追踪 `/dashboard/applications`（`components/applications/ApplicationsScreen.tsx`）

- **h1：** 投递追踪。副标题：`12 条记录 · 9 条进行中 · 3 场面试待进行`。右侧：主按钮「记录投递」。
- KPI 条（4 格）：已投递 12（累计）、进入筛选 6、面试中 3、Offer 1。
- 第二行：左 8 栏「投递漏斗」（同总览的组件复用或同样样式）；右 4 栏「近期面试」3 条（日期、时间、公司、轮次）+ 每人「详情」。
- 表格（12 栏面板）：列 = 公司 · 岗位（两行：岗位 + 公司）、使用简历（可点进编辑器）、投递日期（ISO，右对齐）、阶段（pill + 内嵌 `<select>` 或菜单切换阶段）、下一步（文字 + 时间）、操作（菜单：编辑 / 删除）。默认按投递日期倒序；阶段筛选 chips 有数量；搜索公司/岗位。
- 「记录投递」弹窗：公司、岗位、使用简历 select、阶段 select、投递日期、下一步说明、下一步时间；保存后更新全部 KPI / 漏斗 / 副标题。
- 阶段变化：直接改 store，toast「已更新为 面试中」；「Offer」用 positive pill。
- 空筛选结果：保留表格框架 + 空状态行。

### 6.5 设置 `/dashboard/settings`（`components/settings/SettingsScreen.tsx`）

- **h1：** 设置。副标题：`账号、求职偏好与套餐`。右侧：无主按钮（或「保存」在每个面板内）。
- 左侧 200px 子导航（不是路由，客户端切换视图，右侧只显示一个面板）：个人资料 / 求职偏好 / 套餐与用量 / 数据与隐私。选中项白底 pill；其余灰字。
- **个人资料**：两栏表单（姓名、邮箱、手机、城市、目标职位），保存按钮在面板底部 → `updateUser` + toast「已保存」。
- **求职偏好**：目标岗位（chip 多选：产品经理 / 用户增长 / 数据分析 / 商业化）、期望城市（chip 多选）、期望薪资、工作类型（全职/实习）；两个开关：每周求职提醒、自动检查 JD 关键词；保存。
- **套餐与用量**：左上：计划卡（30 天通行证 · 剩余 13 天 · 到期 2026-11-05 · 不自动续费）；「续购 30 天 ¥19」按钮 → 结算弹窗（支付宝/微信 radio、金额明细、说明「演示环境不会真实扣款」）→ 确认后 `renewPlan()` + toast「已续购（演示）」；右侧：本月用量 3 行（AI 改写 18 次、PDF 导出 4 次、简历 3 份），每行细进度条（通行证不限量 → 显示满格 + 「不限」而不是假上限）；下方订单表格（日期、项目、金额、状态）。
- **数据与隐私**：导出我的数据（真实下载 JSON）；重置演示数据（确认弹窗）；注销账号（危险区，红字说明 + 二次确认 → `resetDemo()` 后 `location.href="/"`，toast 无需）；隐私政策链接 `/privacy`。
- 每个视图只允许一个保存模型：表单底部「保存更改」；开关即时保存并显示小字「已保存」。

### 6.6 编辑器 `/editor`（`components/editor/EditorScreen.tsx` 等）

**外壳（不同于工作台）：** 整屏，浅蓝灰 chrome 40px 高顶栏 + 三栏主体，无侧边导航。
- 顶栏：返回箭头（`/dashboard`）· 简历标题（可点击重命名，内联输入）· 保存状态「已保存 · 09:42」· 目标岗位 select（3 个岗位）·「匹配度 83」小 pill · 「预览」按钮（移动端切换）·「导出 PDF」主按钮（墨底）。
- 左侧 220px：内容段落导航（基本信息 / 求职总结 / 工作经历 / 教育经历 / 技能 / 照片），每项右侧 12px 完成度圆点（完成=蓝点，未完成=灰圈）；下方「模板」按钮（打开模板抽屉）与完成度细条「完成度 83%」。
- 中间：可滚动表单，宽约 560–640px，段落卡片（白底面板，标题 16/600 + 段落状态）：
  - 基本信息：姓名、手机、邮箱、城市 两列。
  - 求职总结：多行 textarea（120px）；右上「AI 润色」按钮（若未设目标岗位则禁用并说明）。
  - 工作经历：可增删排序的卡片；每项公司、职位、起止时间、描述 textarea；底部「AI 对照 JD 改写」按钮（打开改写弹窗）。删除需确认。
  - 教育经历：学校、学历、专业、起止时间。
  - 技能：tag 输入 + 回车添加 + x 删除；预置 chips；提示「点击 JD 里的缺失关键词可直接加进来」。
  - 照片：占位头像（首字母）+ 上传按钮（本地 FileReader 预览，不上传）；可移除。
- 右侧 420–480px：粘性预览区：工具栏（模板名、缩放 - / +、页数 1/1、关键词高亮开关、打印），白纸 A4 实时渲染；纸下小字「A4 · 210 × 297 mm」。缩放 60%–100%。
- **AI 改写弹窗**：标题「对照 JD 改写」；上方 JD 摘要（职位 + 匹配度）；原文（只读/可对比）；「改写结果」区域，点击生成后 900ms loading（骨架条），产出 1 段更量化的表达，并把命中的 JD 关键词用淡黄底色标出；底部按钮：重新生成（在 2 个 mock 版本间切换）/ 取消 / 应用替换。应用后更新经历描述、AI 次数 +1、toast「已应用 · 本次使用 1 次 AI 改写」。没有目标岗位或 JD 时给出明确提示。
- **模板抽屉**（左栏按钮打开 Modal）：3 个模板（经典单栏 / 双栏 / 紧凑），每个显示一个小 A4 缩略；主色 3 选 1（品牌蓝 / 墨黑 / 松绿）；应用后立即更新预览与 store。
- **保存**：任何编辑 600ms 防抖后 `updateResume`；顶栏状态在「保存中…」/「已保存 · HH:mm」之间切换。
- **桌面端增强**：三栏之间可拖拽调宽（键盘 ↑/↓ 方向键 + Home/End，双击复原）；左栏、右栏可收起/展开；每个内容卡片可折叠（「全部收起/展开」在左栏顶部）；关键词高亮支持 5 种底色。
- **打印预览**：点「导出 PDF」先弹出放大的 A4 打印预览，确认后再下载；服务端 Playwright 渲染（`POST /api/resumes/[resumeId]/pdf`，内容取当前草稿，含本地预览照片），与右侧预览共用同一套 A4 组件/CSS；导出的是简历文档本身，不受浏览器插件悬浮层影响。从 `/editor?id=..&print=1` 进入时加载完成后自动导出一次。
- **移动端（<1000px）**：预览改为全屏覆盖层（「预览」按钮切换，带关闭）；表单单列；左栏折叠为顶部的横向 section chips。
- **空/无效 id**：若 URL id 不存在，回退到最近更新的简历；无简历时显示创建引导。

### 6.7 落地页入口（Lead 负责）

- 顶部导航「登录」改为「进入工作台」→ `/dashboard`；原有 `/editor` CTA 保持（直接开始制作）。
- 不改落地页其他内容与样式。

---

## 7. 交互与状态清单（每个页面都要过一遍）

- 键盘：所有可点击元素可 Tab 到；`:focus-visible` 可见；Modal Esc 关闭；菜单方向键/Enter 可选（最低要求：Tab + Enter）。
- 空、零、加载、错误：列表空状态；搜索无结果；AI 分析/改写 loading；导出/保存 toast；删除确认；表单校验（姓名/邮箱必填，邮箱格式）。
- 数字：右对齐、tabular、千分位；金额 2 位小数；百分比整数；日期 `10-21` / `2026-10-21` / 「今天」三种按场景。
- 状态色只表达语义：面试中/Offer 用 positive，未通过用 negative，警告用 warning，其余 neutral/accent。
- 移动端 390px：无横向滚动；标题 20–24px；表格变两行列表（身份+关键数字一行，其余字段第二行灰字）；筛选横向滚动；触摸目标 ≥44px。
- reduced motion：只保留颜色/透明度过渡，不做位移动画。

## 8. 文件归属（避免并行写同一文件）

| 范围 | 负责 | 文件 |
|---|---|---|
| 基础 | Lead | `docs/dashboard/DESIGN.md`、`lib/mock/*`、`components/app/AppShell.tsx`、`app/app-ui.css`、`app/(product)/layout.tsx`、`app/(product)/dashboard/layout.tsx`、`components/dashboard/OverviewScreen.tsx`、落地页入口 |
| UI 组件 | teammate `ui-foundation` | `components/app/icons.tsx`、`components/app/ui.tsx`、`components/app/A4Page.tsx`（不写 CSS） |
| 编辑器 | teammate `editor` | `app/(product)/editor/page.tsx`、`app/(product)/editor/layout.tsx`、`components/editor/*`、`app/(product)/editor/editor.css` |
| 简历库 + 目标岗位 | teammate `library` | `app/(product)/dashboard/resumes/page.tsx`、`app/(product)/dashboard/jobs/page.tsx`、`components/resumes/*`、`components/jobs/*` |
| 投递 + 设置 | teammate `tracking` | `app/(product)/dashboard/applications/page.tsx`、`app/(product)/dashboard/settings/page.tsx`、`components/applications/*`、`components/settings/SettingsScreen.tsx` + `components/settings/settings.css`（如需） |

**任何人都不要修改：** `app/page.tsx`、`components/landing/*`、`app/globals.css`（Lead 除外）、`app/app-ui.css`（Lead 除外）、`lib/`（Lead 的 mock 目录除外）、`package.json`（不新增依赖）。
**禁止使用：** 外部 UI/图标库、图表库、动画库、emoji、图片占位服务。图标用 `Icon`；所有插图/纸页用真实 HTML/CSS 渲染。

## 9. 验收（Lead 最后跑）

```bash
npx tsc --noEmit
npm run build
node .agents/skills/design-taste-frontend/scripts/lint.mjs --app "app/(product)" components/app components/dashboard components/resumes components/jobs components/applications components/editor components/settings
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app http://localhost:3000/dashboard
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app http://localhost:3000/editor
```

逐页检查 1440 / 768 / 390 截图：无横向滚动、卡片同排底边对齐、无大块空白、标题 24px 左右、无渐变/玻璃/阴影面板、颜色 <3%、所有数字可对上、移动端导航折叠。
