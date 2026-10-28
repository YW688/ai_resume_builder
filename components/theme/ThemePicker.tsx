"use client";

import { THEMES, useTheme, type ThemeId } from "./ThemeProvider";
import "./theme-picker.css";

export function ThemePicker({
  layout = "cards",
  label = "主题外观",
}: {
  layout?: "cards" | "rows";
  label?: string;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`theme-picker theme-picker-${layout}`}
      role="radiogroup"
      aria-label={label}
    >
      {THEMES.map((item) => {
        const active = item.id === theme;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`theme-option${active ? " is-active" : ""}`}
            onClick={() => setTheme(item.id as ThemeId)}
          >
            <span
              className="theme-option-preview"
              aria-hidden="true"
              style={
                {
                  "--tp-ground": item.swatches[0],
                  "--tp-glow": item.swatches[1],
                  "--tp-glow-2": item.swatches[2],
                  "--tp-accent": item.swatches[3],
                  "--tp-ink": item.swatches[4],
                  "--tp-dark": item.dark ? "1" : "0",
                } as React.CSSProperties
              }
            >
              <span className="theme-option-rail" />
              <span className="theme-option-sheet">
                <span className="theme-option-line" />
                <span className="theme-option-line is-short" />
                <span className="theme-option-chip" />
              </span>
              <span className="theme-option-dot" />
            </span>
            <span className="theme-option-meta">
              <span className="theme-option-name">
                {item.name}
                {active ? <span className="theme-option-check">当前</span> : null}
              </span>
              <span className="theme-option-tagline">{item.tagline}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
