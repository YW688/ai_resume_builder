import type { AccentId, TemplateId } from "./types";

export const TEMPLATES: {
  id: TemplateId;
  name: string;
  desc: string;
}[] = [
  {
    id: "classic",
    name: "经典单栏",
    desc: "单列阅读，适合经历线性的候选人",
  },
  {
    id: "split",
    name: "双栏",
    desc: "左侧信息栏，突出联系方式与技能",
  },
  {
    id: "compact",
    name: "紧凑",
    desc: "一页放下更多经历，适合资深候选人",
  },
];

export const ACCENTS: {
  id: AccentId;
  name: string;
  value: string;
}[] = [
  { id: "blue", name: "品牌蓝", value: "#1a6bd6" },
  { id: "ink", name: "墨黑", value: "#0e1b2a" },
  { id: "green", name: "松绿", value: "#247b50" },
];

export function templateName(id: TemplateId): string {
  return TEMPLATES.find((item) => item.id === id)?.name ?? "经典单栏";
}

export function accentValue(id: AccentId): string {
  return ACCENTS.find((item) => item.id === id)?.value ?? "#1a6bd6";
}
