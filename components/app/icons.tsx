import type { ReactNode } from "react";

/**
 * 产品工作台唯一图标来源（DESIGN §4.1）。
 * 24×24 viewBox / fill=none / stroke=currentColor / 圆角线帽，默认 16px。
 * 自己绘制 path，不引入任何图标库。
 */
export type IconName =
  | "home"
  | "file"
  | "target"
  | "send"
  | "settings"
  | "plus"
  | "search"
  | "bell"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "arrowLeft"
  | "arrowRight"
  | "arrowUp"
  | "arrowDown"
  | "more"
  | "close"
  | "check"
  | "sparkle"
  | "download"
  | "printer"
  | "edit"
  | "copy"
  | "trash"
  | "clock"
  | "calendar"
  | "external"
  | "menu"
  | "zoomIn"
  | "zoomOut"
  | "filter"
  | "grid"
  | "list"
  | "undo"
  | "eye"
  | "link"
  | "logout"
  | "help"
  | "refresh"
  | "user"
  | "briefcase"
  | "chart"
  | "lock"
  | "warning"
  | "info"
  | "upload"
  | "mail"
  | "phone"
  | "pin"
  | "star"
  | "drag"
  | "checkCircle"
  | "sparkles"
  | "fileText"
  | "sliders"
  | "chevronUp";

export type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

const FILLED = "currentColor";

const ICON_PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 10.6 12 4l8 6.6V20H4v-9.4Z" />
      <path d="M9.6 20v-5.4h4.8V20" />
    </>
  ),
  file: (
    <>
      <path d="M6 3.5h7.5L18 8v12.5H6V3.5Z" />
      <path d="M13.5 3.5V8H18" />
    </>
  ),
  fileText: (
    <>
      <path d="M6 3.5h7.5L18 8v12.5H6V3.5Z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="12" cy="12" r="1" fill={FILLED} stroke="none" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 14.2 21l-3.7-7.5L3 9.8 21 3Z" />
      <path d="M21 3 10.5 13.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="6.4" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.2v2.4M12 18.4v2.4M3.2 12h2.4M18.4 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 5.2-2.2 6.8-2.2 6.8h16.4S18 14.2 18 9Z" />
      <path d="M10.2 19.2a2 2 0 0 0 3.6 0" />
    </>
  ),
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  arrowLeft: (
    <>
      <path d="M19.5 12h-15" />
      <path d="m10.5 6-6 6 6 6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19.5v-15" />
      <path d="m6 10.5 6-6 6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 4.5v15" />
      <path d="m6 13.5 6 6 6-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill={FILLED} stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill={FILLED} stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill={FILLED} stroke="none" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.8 4.8L19 6.5" />,
  sparkle: (
    <path d="M12 3.8c.9 4 2.5 5.6 6.5 6.5-4 .9-5.6 2.5-6.5 6.5-.9-4-2.5-5.6-6.5-6.5 4-.9 5.6-2.5 6.5-6.5Z" />
  ),
  sparkles: (
    <>
      <path d="M10 5.5c.7 3.2 2 4.5 5.2 5.2-3.2.7-4.5 2-5.2 5.2-.7-3.2-2-4.5-5.2-5.2 3.2-.7 4.5-2 5.2-5.2Z" />
      <path d="M18 3.2c.35 1.7 1.1 2.45 2.8 2.8-1.7.35-2.45 1.1-2.8 2.8-.35-1.7-1.1-2.45-2.8-2.8 1.7-.35 2.45-1.1 2.8-2.8Z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5V15" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V3.5h10V8" />
      <path d="M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 17h-2" />
      <path d="M7 13.5h10V20.5H7z" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h4L20 8l-4-4L4.5 15.5v4Z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="m6.5 7 .8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
      <path d="M10.2 11v6M13.8 11v6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.2V12l3.2 1.9" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11.5 12.5" />
      <path d="M19 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5h4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  zoomIn: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
      <path d="M10.8 8v5.6M8 10.8h5.6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
      <path d="M8 10.8h5.6" />
    </>
  ),
  filter: <path d="M4 5.5h16l-6.3 7.3V20L10.3 21.5v-8.7L4 5.5Z" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </>
  ),
  list: (
    <>
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" />
      <circle cx="4.6" cy="6.5" r="1" fill={FILLED} stroke="none" />
      <circle cx="4.6" cy="12" r="1" fill={FILLED} stroke="none" />
      <circle cx="4.6" cy="17.5" r="1" fill={FILLED} stroke="none" />
    </>
  ),
  undo: (
    <>
      <path d="M4.5 9.5h10a5.5 5.5 0 0 1 0 11H9.5" />
      <path d="m8.5 5.5-4 4 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  link: (
    <>
      <path d="M9.6 14.4 14.4 9.6" />
      <path d="m11 7.2 1.7-1.7a4.1 4.1 0 0 1 5.8 5.8L16.8 13" />
      <path d="m13 16.8-1.7 1.7a4.1 4.1 0 0 1-5.8-5.8L7.2 11" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h4" />
      <path d="m16 8 4 4-4 4" />
      <path d="M20 12h-9" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 3.9" />
      <path d="M12 17.2h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 12.5a8 8 0 0 0 13.7 5.2L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.8" />
      <path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
      <path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M3 12.5h18" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16.5v-4M12.5 16.5V7.5M17 16.5v-6.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.8" y="10.5" width="14.4" height="10" rx="2" />
      <path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 19.5H3L12 4Z" />
      <path d="M12 9.5v4.3" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5.4" />
      <path d="M12 7.6h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.6 6.6 8.4 6.4 8.4-6.4" />
    </>
  ),
  phone: (
    <path d="M6.6 3.5H4.9A1.4 1.4 0 0 0 3.5 4.9C3.5 13.9 10.1 20.5 19.1 20.5a1.4 1.4 0 0 0 1.4-1.4v-1.7l-4.6-1.8-2 2.1a13.6 13.6 0 0 1-5.5-5.5l2.1-2L6.6 3.5Z" />
  ),
  pin: (
    <>
      <path d="M12 21s6.4-5.6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </>
  ),
  star: (
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.7-5.2 2.7 1-5.9L3.5 9.8l5.9-.9L12 3.6Z" />
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1.3" fill={FILLED} stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill={FILLED} stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill={FILLED} stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill={FILLED} stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill={FILLED} stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill={FILLED} stroke="none" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.2 12.2 2.7 2.7 4.9-5.3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9.5M17.5 7H20M4 12h3M11 12h9M4 17h9.5M17.5 17H20" />
      <circle cx="15.5" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15.5" cy="17" r="2" />
    </>
  ),
};

export function Icon({ name, size = 16, strokeWidth = 1.6, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
