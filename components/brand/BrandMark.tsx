/**
 * 品牌标记：「起跳的勾」（logo v1 · 2026-10-29）
 *
 * 32×32 网格，两道圆头线：
 *  - 尾迹：轻轻挑起的一笔，代表「轻松」
 *  - 勾：从前一笔顺势起跳、落在高处，代表「成功 / offer 到手」
 *
 * 单色时整条线走 currentColor，随主题反白；duo 变体只把尾迹换成主题色，
 * 用于允许彩色的品牌位（顶栏 / 登录页 / 加载页）。16–18px 自动加粗描边。
 */
export function BrandMark({
  size = 28,
  variant = "mono",
  title,
  className,
}: {
  size?: number;
  variant?: "mono" | "duo";
  title?: string;
  className?: string;
}) {
  const strokeWidth = size <= 18 ? 2.6 : 2;
  const a11y = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      {...a11y}
    >
      <path
        d="M7.4 12.6c1.9-1.7 4.1-1.9 5.9-.6"
        stroke={variant === "duo" ? "var(--ui-accent)" : "currentColor"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.9 19.5l4.2 4.2L24 11.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
