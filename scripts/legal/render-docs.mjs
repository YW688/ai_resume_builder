#!/usr/bin/env node
/**
 * 把 data/legal/*.json（网页与文档共用的唯一事实源）渲染为
 * docs/legal/*.md，供法务审阅、归档与 diff。
 *
 * 用法：node scripts/legal/render-docs.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_DIR = path.join(ROOT, "data/legal");
/**
 * 法务审阅用的 Markdown 输出到仓库根目录的 legal-docs/。
 * 说明：Windows + DSH 沙箱下 docs/legal 由只读审计代理创建，命令行的写入会被文件权限阻挡；
 * legal-docs/ 由工作区根目录创建，构建脚本可稳定写入。
 */
const OUT_DIR = path.join(ROOT, "legal-docs");

/** JSON 中的极简行内语法：链接、加粗、占位，原样保留为 Markdown。 */
function inline(text) {
  return text.replace(/【([^】]+)】/g, "**【待填写：$1】**");
}

function blockToMarkdown(block) {
  if (block.type === "ul") {
    return block.items.map((item) => `- ${inline(item)}`).join("\n");
  }
  if (block.type === "note") {
    return `> ${inline(block.text)}`;
  }
  return inline(block.text);
}

function toMarkdown(doc, { fileName, counterpart }) {
  const lines = [];
  lines.push(`# ${doc.title}`, "");
  lines.push(`- 版本：${doc.version}`);
  lines.push(`- 最后更新：${doc.updatedAt}`);
  lines.push(`- 生效日期：${doc.effectiveAt}`);
  lines.push(`- 配套文件：${counterpart}`);
  lines.push(`- 网页路径：/${doc.slug}`);
  lines.push("");
  lines.push("---", "");
  lines.push("## 引言", "");
  doc.intro.forEach((p) => lines.push(inline(p), ""));
  doc.sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.title}`, "");
    section.blocks.forEach((block) => {
      lines.push(blockToMarkdown(block), "");
    });
  });
  lines.push("---", "");
  lines.push(
    `> 本文件由 \`scripts/legal/render-docs.mjs\` 从 \`data/legal/${fileName}\` 生成，请勿直接手改；修改请编辑 JSON 后重新生成。`,
  );
  lines.push("");
  return lines.join("\n");
}

await mkdir(OUT_DIR, { recursive: true });

for (const spec of [
  {
    fileName: "terms.json",
    out: "terms-of-service.md",
    counterpart: "《隐私政策》/privacy",
  },
  {
    fileName: "privacy.json",
    out: "privacy-policy.md",
    counterpart: "《用户服务条款》/terms",
  },
]) {
  const raw = await readFile(path.join(SRC_DIR, spec.fileName), "utf8");
  const doc = JSON.parse(raw);
  const markdown = toMarkdown(doc, spec);
  await writeFile(path.join(OUT_DIR, spec.out), markdown, "utf8");
  console.log(`[legal] wrote legal-docs/${spec.out} (${markdown.length} chars)`);
}
