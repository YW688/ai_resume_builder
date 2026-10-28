"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeId = "mist" | "ember" | "midnight";

export const THEME_STORAGE_KEY = "app.theme.v1";

export const THEMES: {
  id: ThemeId;
  name: string;
  tagline: string;
  swatches: string[];
  dark: boolean;
}[] = [
  {
    id: "mist",
    name: "晴岚",
    tagline: "淡紫雾面玻璃",
    swatches: ["#ece9f7", "#b7a8ff", "#ffb4d4", "#6c4ce0", "#1c1733"],
    dark: false,
  },
  {
    id: "ember",
    name: "绯雾",
    tagline: "暖白纸面绯红",
    swatches: ["#f7eeee", "#fe2e4b", "#ffcf9e", "#161316", "#ffffff"],
    dark: false,
  },
  {
    id: "midnight",
    name: "子夜",
    tagline: "深靛电光紫",
    swatches: ["#0b0920", "#2631ad", "#7f24e7", "#2affcc", "#f2f0ff"],
    dark: true,
  },
];

const THEME_IDS = THEMES.map((item) => item.id);
const THEME_EVENT = "app:themechange";

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

function readTheme(): ThemeId {
  if (typeof document === "undefined") return "mist";
  const value = document.documentElement.dataset.theme;
  return isThemeId(value) ? value : "mist";
}

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "midnight" ? "dark" : "light";
}

function persistTheme(theme: ThemeId) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* 隐私模式 / 存储被禁用时忽略 */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (isThemeId(event.newValue)) applyTheme(event.newValue);
    onChange();
  }
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 首帧由 app/layout.tsx 的内联脚本写 <html data-theme>；
  // 这里用 useSyncExternalStore 订阅 DOM，服务端/水合快照固定为 mist。
  const theme = useSyncExternalStore(subscribe, readTheme, () => "mist" as ThemeId);

  const setTheme = useCallback((next: ThemeId) => {
    persistTheme(next);
  }, []);

  const cycleTheme = useCallback(() => {
    const next = THEME_IDS[(THEME_IDS.indexOf(readTheme()) + 1) % THEME_IDS.length];
    persistTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, cycleTheme }),
    [theme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}
