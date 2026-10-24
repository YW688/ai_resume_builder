"use client";

import { useId } from "react";

/**
 * AI 点数（额度点）图标 —— 「星券 / Spark Token」。
 *
 * 设计概念（只取方法，见 design/icon-design 参考）：
 * - 外形不画通用金币，而是「圆角票券 + 右侧半圆撕口」：一眼是「券」而不是「钱」，
 *   也呼应产品里 8–16px 的柔和圆角与玻璃拟态卡片；
 * - 券面中央是品牌同源的四角星（AI 火花），星心挖掉一个小圆点 ——
 *   「星火 + 点」＝「点数」，同时也是 16px 下仍能辨识的核心字形；
 * - 描边用品牌蓝，券面用同色 14% 淡染（tone 明确时用品牌浅色底），
 *   单色 currentColor 也能着色（不传 tone 时）。
 *
 * 尺寸策略：
 * - < 20px 进入 compact 模式：去掉票券撕口与细节，加粗描边、放大星体，
 *   保证 16px 下仍然是一枚「带星点的券」而不是一团噪点；
 * - 20/24/32px 显示完整票券轮廓（撕口 + 星心圆点）。
 */
export type CreditIconTone = "default" | "free" | "low" | "member";

type TonePalette = { ink: string; tint: string };

/** 与 app-ui.css 的 --ui-* 同源：蓝 / 暖黄 / 粉红 / 墨蓝+暖黄。 */
const TONE_PALETTE: Record<CreditIconTone, TonePalette> = {
  default: { ink: "#1A6BD6", tint: "#E9F1FC" },
  free: { ink: "#B45309", tint: "#FFF1C9" },
  low: { ink: "#C4242A", tint: "#FDECEB" },
  member: { ink: "#0E1B2A", tint: "#FFE9B0" },
};

export type CreditIconProps = {
  /** 渲染尺寸（px），默认 24；16/18 走紧凑字形。 */
  size?: number;
  /** 状态配色：默认蓝 / 免费额度暖黄 / 余额不足粉红 / 会员墨蓝。不传则跟随 currentColor。 */
  tone?: CreditIconTone;
  /** 可访问名称。默认「AI 点数」。 */
  title?: string;
  /** 纯装饰场景（旁边已有文字说明）：aria-hidden，不重复朗读。 */
  decorative?: boolean;
  className?: string;
};

/** 星心圆点半径（完整字形）。 */
const STAR = "M12 5.9c.85 3.8 2.35 5.3 6.15 6.15-3.8.85-5.3 2.35-6.15 6.15-.85-3.8-2.35-5.3-6.15-6.15 3.8-.85 5.3-2.35 6.15-6.15Z";

export function CreditIcon({
  size = 24,
  tone,
  title,
  decorative = false,
  className,
}: CreditIconProps) {
  // SVG 里的 mask id 必须全局唯一；useId 含冒号，去掉后作为安全 id。
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const notchId = `credit-notch-${uid}`;
  const holeId = `credit-hole-${uid}`;
  const compact = size < 20;

  const palette = tone ? TONE_PALETTE[tone] : null;
  const ink = palette?.ink ?? "currentColor";
  const tint = palette?.tint ?? "currentColor";
  const tintOpacity = palette ? 1 : 0.14;
  const label = title ?? "AI 点数";

  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": label };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className ? `credit-icon ${className}` : "credit-icon"}
      focusable="false"
      {...a11y}
    >
      {decorative ? null : <title>{label}</title>}

      {compact ? (
        <>
          {/* 紧凑字形：加粗券面 + 星心圆点，去掉撕口细节。 */}
          <rect
            x="2.6"
            y="3.1"
            width="18.8"
            height="17.8"
            rx="6.4"
            fill={tint}
            fillOpacity={tintOpacity}
            stroke={ink}
            strokeWidth="2"
          />
          <mask
            id={holeId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="24"
            height="24"
          >
            <rect width="24" height="24" fill="#fff" />
            <circle cx="12" cy="12.05" r="1.7" fill="#000" />
          </mask>
          <path d={STAR} fill={ink} mask={`url(#${holeId})`} />
        </>
      ) : (
        <>
          {/* 完整字形：右侧撕口由 mask 挖出，票券轮廓不被破坏。 */}
          <mask
            id={notchId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="24"
            height="24"
          >
            <rect width="24" height="24" fill="#fff" />
            <circle cx="21.8" cy="12" r="2.4" fill="#000" />
          </mask>
          <g mask={`url(#${notchId})`}>
            <rect
              x="2.7"
              y="3.2"
              width="18.6"
              height="17.6"
              rx="6.1"
              fill={tint}
              fillOpacity={tintOpacity}
              stroke={ink}
              strokeWidth="1.7"
            />
          </g>

          <mask
            id={holeId}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="24"
            height="24"
          >
            <rect width="24" height="24" fill="#fff" />
            <circle cx="12" cy="12.05" r="1.4" fill="#000" />
          </mask>
          <path d={STAR} fill={ink} mask={`url(#${holeId})`} />
        </>
      )}
    </svg>
  );
}

export default CreditIcon;
