import "server-only";
import { renderAtsHtml, type AtsResume } from "@/components/resume/ats-template";

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
.page {
  width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 15mm;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: #111; background: #fff; font-size: 12.5px;
}
.header { display: flex; justify-content: space-between; gap: 16px; }
.header h1 { font-size: 26px; font-weight: 800; margin: 0; }
.contact { font-size: 12px; color: #555; margin: 6px 0 0; }
.photo { width: 88px; height: 112px; object-fit: cover; border: 1px solid #e5e5e5; border-radius: 4px; }
section { margin-top: 20px; }
h2 { font-size: 15px; font-weight: 700; color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 0 0 12px; }
.muted { color: #555; }
.summary { line-height: 1.7; margin: 0; white-space: pre-wrap; }
.exp { margin-bottom: 14px; }
.exp-head { display: flex; justify-content: space-between; align-items: baseline; }
.exp-company { font-size: 14px; font-weight: 700; }
.date { font-size: 11px; }
.desc { font-size: 12px; line-height: 1.7; margin: 6px 0 0; white-space: pre-wrap; }
.edu { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; font-size: 13px; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { font-size: 11.5px; padding: 3px 10px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; }
`;

export async function renderResumePdf(resume: AtsResume): Promise<Buffer> {
  const body = renderAtsHtml(resume);
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>${body}</body>
</html>`;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
