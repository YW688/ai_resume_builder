# 品牌标记 v1 ·「起跳的勾」

> 2026-10-29 定稿。用户选定的方向：D（起跳的勾）——轻松成功、拿捏 offer。

## 概念

两条圆头线，32×32 网格：

| 元素 | 路径 | 含义 |
|---|---|---|
| 尾迹 | `M7.4 12.6c1.9-1.7 4.1-1.9 5.9-.6` | 轻轻挑起的一笔 =「轻松」 |
| 勾 | `M10.9 19.5l4.2 4.2L24 11.2` | 顺势起跳、落在高处 =「成功 / offer 到手」 |

- 线宽：≥20px 用 **2**；≤18px 用 **2.6**（光学补偿），自动计算。
- 圆头、圆角连接；不用尖角，保持松弛。
- `duo` 变体：尾迹用主题色（`--ui-accent`），勾用当前文字色；`mono` 变体整条线同色，随主题反白。

## 文件

| 路径 | 用途 |
|---|---|
| `components/brand/BrandMark.tsx` | React 组件（size / variant / title），侧栏、移动导航、认证页共用 |
| `public/brand/mark.svg` | 单色墨版（`#1c1733`） |
| `public/brand/mark-duo.svg` | 双色版（尾迹 `#6c4ce0`） |
| `public/brand/mark-inverse.svg` | 白色反白版 |
| `public/brand/mark-512.png` · `mark-duo-512.png` | 512 透明底 PNG |
| `public/brand/app-icon.svg` · `app-icon-512.png` · `app-icon-192.png` | App 图标（实心圆角方 + 反白 mark） |
| `app/icon.svg` | Next 文件约定：浏览器标签页 SVG 图标 |
| `app/apple-icon.png` | iOS 主屏图标（180） |
| `app/favicon.ico` | 16 / 32 / 48 多尺寸 ICO（由 app-icon 生成） |

## 用法

```tsx
import { BrandMark } from "@/components/brand/BrandMark";

<BrandMark size={30} variant="duo" />      // 彩色品牌位（侧栏、加载页）
<BrandMark size={22} />                     // 单色，走 currentColor
```

## 规则

- **最小尺寸**：mark 单独使用不低于 16px；字标组合时 mark 不低于 20px。
- **留白**：mark 外留白 ≥ 1/4 边长，不要贴边加方框。
- **颜色**：单色默认用 `currentColor`；双色只用「尾迹 = 主题色、勾 = 文字色」，不要给勾单独上色。
- **背景**：浅色底用墨版 / 彩色版；深色底用反白版；不要给 mark 加阴影、渐变、描边。
- **不要**旋转、拉宽、改变两笔比例或线宽（小尺寸加粗由组件自动处理）。
- 字标：「简历编辑器」600 字重，与 mark 同高居中；副标「AI 求职工作台」11.5–12px，字重 400。

## 已统一的品牌面（2026-10-29）

| 位置 | 形态 |
|---|---|
| 落地页 Hero 顶部胶囊导航 | 22px 深色圆角方 + 14px 反白 mark，替换原「简」字渐变圆点 |
| 落地页页脚 | 20px 反白 mark + 品牌名 |
| 认证页品牌位 | 22px 反白单色 mark |
| 服务条款 / 隐私政策页头 | 18px 反白 mark（原「AI」字方块） |
| 工作台侧栏 / 移动导航 | 30px / 26px 双色 mark（尾迹走主题色） |
| 浏览器标签 / iOS 主屏 | `app/icon.svg` / `app/favicon.ico` / `app/apple-icon.png` |
| 分享图 `public/og-hero.jpg` | 1200×630，深色 mark 方块 + 「把目标 JD，变成简历里的加分项」+ 能力 chips，基于 Hero poster 合成 |

## 交接

- OG 图的 `metadataBase` 仍是 Next 默认（`http://localhost:3000`），上线前在 `app/layout.tsx` 设置正式域名。
