import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { AccentId, TemplateId } from "@/lib/mock/types";

/**
 * 服务端 PDF 渲染：与编辑器 A4 预览共用 `components/resume/a4.css`，
 * 并用与 `components/app/A4Page.tsx` 完全相同的 class 结构输出 HTML
 * （React 的 `react-dom/server` 在 App Router 里被禁用，所以这里手写模板；
 *  改 A4Page 的结构时，请同步本文件的 HTML 结构）。
 *
 * 走 Playwright（无浏览器扩展、无页面 chrome），因此导出的是简历文档本身，
 * 不会被浏览器插件悬浮球等页面元素污染。
 */

export type ResumePdfExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type ResumePdfEducation = {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type ResumePdfInput = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  /** 技能列表；兼容旧的换行分隔字符串。 */
  skills: string[] | string;
  experiences: ResumePdfExperience[];
  educations: ResumePdfEducation[];
  /** 目标岗位名，显示在姓名下方。 */
  jobTitle?: string;
  /** 真实照片（data URL 或公开 URL）。 */
  photoUrl?: string | null;
  /** 首字母头像；空字符串表示明确不要头像。 */
  photoInitials?: string;
  templateId?: TemplateId;
  accent?: AccentId;
};

const ACCENT_COLORS: Record<AccentId, string> = {
  blue: "#1a6bd6",
  ink: "#0e1b2a",
  green: "#247b50",
};

const CONTACT_ICONS = {
  phone:
    '<path d="M6.6 3.5H4.9A1.4 1.4 0 0 0 3.5 4.9C3.5 13.9 10.1 20.5 19.1 20.5a1.4 1.4 0 0 0 1.4-1.4v-1.7l-4.6-1.8-2 2.1a13.6 13.6 0 0 1-5.5-5.5l2.1-2L6.6 3.5Z" />',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.6 6.6 8.4 6.4 8.4-6.4" />',
  pin: '<path d="M12 21s6.4-5.6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.4 12 21 12 21Z" /><circle cx="12" cy="10.4" r="2.4" />',
} as const;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nonEmpty(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatRange(startDate: string, endDate: string): string {
  const start = nonEmpty(startDate);
  const end = nonEmpty(endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function toSkills(input: string[] | string): string[] {
  const list = Array.isArray(input) ? input : input.split(/\r?\n/);
  return list.map((item) => item.trim()).filter(Boolean);
}

function contactIcon(name: keyof typeof CONTACT_ICONS): string {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CONTACT_ICONS[name]}</svg>`;
}

function contactList(input: ResumePdfInput): string {
  const items: string[] = [];
  const phone = nonEmpty(input.phone);
  const email = nonEmpty(input.email);
  const city = nonEmpty(input.city);
  if (phone) items.push(`<span class="a4-contact-item">${contactIcon("phone")}${esc(phone)}</span>`);
  if (email) items.push(`<span class="a4-contact-item">${contactIcon("mail")}${esc(email)}</span>`);
  if (city) items.push(`<span class="a4-contact-item">${contactIcon("pin")}${esc(city)}</span>`);
  if (items.length === 0) return "";
  return `<div class="a4-contact">${items.join("")}</div>`;
}

function sectionTitle(title: string): string {
  return `<div class="a4-section-title">${title}</div>`;
}

function summarySection(input: ResumePdfInput): string {
  const summary = nonEmpty(input.summary);
  if (!summary) return "";
  return `<section class="a4-section">${sectionTitle("求职总结")}<div class="a4-summary">${esc(summary)}</div></section>`;
}

function experienceSection(input: ResumePdfInput): string {
  const visible = input.experiences.filter(
    (exp) => nonEmpty(exp.title) || nonEmpty(exp.company) || nonEmpty(exp.description),
  );
  if (visible.length === 0) return "";
  const items = visible
    .map((exp) => {
      const bullets = (exp.description ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${esc(line)}</li>`)
        .join("");
      const company = nonEmpty(exp.company)
        ? `<div class="a4-exp-company">${esc(exp.company)}</div>`
        : "";
      return `<div class="a4-exp">
  <div class="a4-exp-head">
    <div style="min-width:0">
      <div class="a4-exp-title">${esc(nonEmpty(exp.title) || "—")}</div>
      ${company}
    </div>
    <div class="a4-exp-date">${esc(formatRange(exp.startDate, exp.endDate))}</div>
  </div>
  ${bullets ? `<ul class="a4-bullets">${bullets}</ul>` : ""}
</div>`;
    })
    .join("");
  return `<section class="a4-section">${sectionTitle("工作经历")}${items}</section>`;
}

function educationSection(input: ResumePdfInput): string {
  const visible = input.educations.filter(
    (edu) => nonEmpty(edu.school) || nonEmpty(edu.degree) || nonEmpty(edu.major),
  );
  if (visible.length === 0) return "";
  const items = visible
    .map((edu) => {
      const detail = [nonEmpty(edu.degree), nonEmpty(edu.major)]
        .filter(Boolean)
        .join(" · ");
      return `<div class="a4-exp">
  <div class="a4-exp-head">
    <div style="min-width:0">
      <div class="a4-exp-title">${esc(nonEmpty(edu.school) || "—")}</div>
      <div class="a4-exp-company">${esc(detail)}</div>
    </div>
    <div class="a4-exp-date">${esc(formatRange(edu.startDate, edu.endDate))}</div>
  </div>
</div>`;
    })
    .join("");
  return `<section class="a4-section">${sectionTitle("教育经历")}${items}</section>`;
}

function skillsSection(input: ResumePdfInput): string {
  const skills = toSkills(input.skills);
  if (skills.length === 0) return "";
  return `<section class="a4-section">${sectionTitle("技能")}<div class="a4-skills">${skills
    .map((skill) => `<span class="a4-skill">${esc(skill)}</span>`)
    .join("")}</div></section>`;
}

function photoHtml(input: ResumePdfInput, style = ""): string {
  if (nonEmpty(input.photoUrl)) {
    return `<div class="a4-photo"${style}><img class="a4-photo-img" src="${esc(
      nonEmpty(input.photoUrl),
    )}" alt="" /></div>`;
  }
  const initials =
    input.photoInitials !== undefined
      ? nonEmpty(input.photoInitials)
      : nonEmpty(input.fullName).slice(0, 1);
  if (!initials) return "";
  return `<div class="a4-photo"${style}>${esc(initials)}</div>`;
}

/** 把简历数据渲染成 A4Page 等价的 HTML（class 与 A4Page.tsx 一致）。 */
export function renderResumeHtml(input: ResumePdfInput): string {
  const template = input.templateId ?? "classic";
  const accent = input.accent ?? "blue";
  const name = nonEmpty(input.fullName) || "未命名";
  const jobTitle = nonEmpty(input.jobTitle);
  const photo = photoHtml(input);
  const role = jobTitle ? `<div class="a4-role">${esc(jobTitle)}</div>` : "";
  const classes = [
    "a4-page",
    template === "split" ? "a4-page--split" : "",
    template === "compact" ? "a4-page--compact" : "",
    "a4-page--pdf",
  ]
    .filter(Boolean)
    .join(" ");
  const style = ` style="--a4-accent:${ACCENT_COLORS[accent] ?? ACCENT_COLORS.blue}"`;

  if (template === "split") {
    return `<article class="${classes}"${style} aria-label="简历">
  <aside class="a4-side">
    ${photoHtml(input, ' style="margin-bottom:14px"')}
    <div class="a4-name">${esc(name)}</div>
    ${role}
    <div class="a4-rule"></div>
    ${contactList(input)}
    ${skillsSection(input)}
    ${educationSection(input)}
  </aside>
  <div class="a4-main">
    ${summarySection(input)}
    ${experienceSection(input)}
  </div>
</article>`;
  }

  return `<article class="${classes}"${style} aria-label="简历">
  <header class="a4-head">
    <div style="min-width:0">
      <div class="a4-name">${esc(name)}</div>
      ${role}
      ${contactList(input)}
    </div>
    ${photo}
  </header>
  <div class="a4-rule"></div>
  ${summarySection(input)}
  ${experienceSection(input)}
  ${educationSection(input)}
  ${skillsSection(input)}
</article>`;
}

const BASE_CSS = `
:root {
  --ui-font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, -apple-system, sans-serif;
  --ui-sun: #ffe9b0;
}
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.a4-page--pdf { box-shadow: none; border: 0; }
`;

/** 每次请求读取共享 CSS，保证预览与 PDF 永远同源。 */
function readA4Css(): string {
  return readFileSync(path.join(process.cwd(), "components/resume/a4.css"), "utf8");
}

/** 把简历渲染成 A4 PDF（Buffer）。 */
export async function renderResumePdf(input: ResumePdfInput): Promise<Buffer> {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(nonEmpty(input.fullName) || "简历")}</title>
<style>${BASE_CSS}${readA4Css()}</style>
</head>
<body>${renderResumeHtml(input)}</body>
</html>`;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
