/** 关键词高亮色板：浅底 + 深色正文，保证 4.5:1 以上的阅读对比度。 */
export type HighlightColor = {
  id: string;
  label: string;
  value: string;
};

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { id: "sun", label: "姜黄", value: "#ffe9b0" },
  { id: "sky", label: "天蓝", value: "#cfe4ff" },
  { id: "mint", label: "薄荷", value: "#cff0dc" },
  { id: "lilac", label: "丁香", value: "#e9ddff" },
  { id: "peach", label: "蜜桃", value: "#ffdcd1" },
];

export const DEFAULT_HIGHLIGHT_COLOR_ID = "sun";

export function highlightColorValue(id: string): string {
  return (
    HIGHLIGHT_COLORS.find((color) => color.id === id)?.value ??
    HIGHLIGHT_COLORS[0].value
  );
}
