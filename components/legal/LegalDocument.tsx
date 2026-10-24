import Link from "next/link";
import type { ReactNode } from "react";

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "note"; text: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocumentData = {
  slug: string;
  title: string;
  shortTitle: string;
  version: string;
  updatedAt: string;
  effectiveAt: string;
  intro: string[];
  sections: LegalSection[];
};

const INLINE_PATTERN = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|【([^】]+)】/g;

/** 渲染极简行内语法：链接、加粗、待填写占位。内容为静态可信文本。 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, linkLabel, href, bold, placeholder] = match;
    if (linkLabel && href) {
      if (href.startsWith("/")) {
        nodes.push(
          <Link
            key={`${match.index}-link`}
            href={href}
            className="font-medium text-[#1A6BD6] underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>,
        );
      } else {
        nodes.push(
          <a
            key={`${match.index}-link`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#1A6BD6] underline-offset-2 hover:underline"
          >
            {linkLabel}
          </a>,
        );
      }
    } else if (bold) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-semibold text-[#0E1B2A]">
          {bold}
        </strong>,
      );
    } else if (placeholder) {
      nodes.push(
        <span
          key={`${match.index}-placeholder`}
          className="rounded-[4px] border-b border-dashed border-[#C08A2E] bg-[#FFF6E3] px-1 text-[#7A5418]"
          title="待运营主体确认"
        >
          {placeholder}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "ul") {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[#3C4C60] marker:text-[#8E9AA4]">
        {block.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "note") {
    return (
      <div className="mt-4 rounded-xl border border-[#E8D9B8] bg-[#FFF9EC] px-4 py-3 text-[14px] leading-6 text-[#6B5125]">
        {renderInline(block.text)}
      </div>
    );
  }

  return (
    <p className="mt-3 text-[15px] leading-7 text-[#3C4C60]">{renderInline(block.text)}</p>
  );
}

const PRINT_CSS = `
@media print {
  .legal-no-print { display: none !important; }
  .legal-shell { background: #fff !important; }
  .legal-main { max-width: none !important; padding: 0 !important; }
  .legal-section { break-inside: avoid-page; }
  .legal-placeholder { background: none !important; }
  a { color: #000 !important; text-decoration: none !important; }
  @page { margin: 18mm 16mm; }
}
`;

export function LegalDocument({ doc }: { doc: LegalDocumentData }) {
  return (
    <div className="legal-shell min-h-screen bg-[#F4F8FC] text-[#0E1B2A]">
      <style>{PRINT_CSS}</style>

      <header className="legal-no-print border-b border-[#DCE6F0] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0E1B2A] text-[13px] font-bold text-white">
              AI
            </span>
            <span>AI 简历编辑器</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[#58657A]">
            <Link href="/terms" className="hover:text-[#1A6BD6]">
              服务条款
            </Link>
            <Link href="/privacy" className="hover:text-[#1A6BD6]">
              隐私政策
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#D5DFE9] bg-white px-3 py-1.5 font-medium text-[#0E1B2A] hover:border-[#1A6BD6] hover:text-[#1A6BD6]"
            >
              返回首页
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-[#DCE6F0] bg-[linear-gradient(180deg,#F4F8FC_0%,#ECF3FB_100%)]">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1A6BD6]">
            Legal · {doc.shortTitle}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0E1B2A] sm:text-4xl">
            {doc.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#58657A]">
            <span>最后更新：{doc.updatedAt}</span>
            <span>生效日期：{renderInline(doc.effectiveAt)}</span>
            <span>版本：{doc.version}</span>
          </div>
          <div className="mt-6 max-w-3xl space-y-3">
            {doc.intro.map((paragraph, index) => (
              <p key={index} className="text-[15px] leading-7 text-[#3C4C60]">
                {renderInline(paragraph)}
              </p>
            ))}
          </div>
        </div>
      </section>

      <main className="legal-main mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <aside className="legal-no-print lg:sticky lg:top-6">
            <nav
              aria-label="目录"
              className="rounded-2xl border border-[#DCE6F0] bg-white/85 p-4 shadow-[0_8px_30px_rgba(14,27,42,0.04)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E9AA4]">
                目录
              </p>
              <ol className="mt-3 max-h-[65vh] space-y-1.5 overflow-auto pr-1 text-[13px] leading-5">
                {doc.sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-md px-2 py-1 text-[#58657A] transition hover:bg-[#F1F6FB] hover:text-[#1A6BD6]"
                    >
                      <span className="w-4 shrink-0 tabular-nums text-[#8E9AA4]">
                        {index + 1}
                      </span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0">
            <div className="space-y-9">
              {doc.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="legal-section scroll-mt-24 rounded-2xl border border-[#DCE6F0] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(14,27,42,0.035)] sm:px-7 sm:py-7"
                >
                  <h2 className="flex gap-2 text-[19px] font-semibold tracking-tight text-[#0E1B2A]">
                    <span className="tabular-nums text-[#1A6BD6]">{index + 1}.</span>
                    <span>{section.title}</span>
                  </h2>
                  <div className="mt-2">
                    {section.blocks.map((block, blockIndex) => (
                      <Block key={blockIndex} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <footer className="legal-no-print mt-10 rounded-2xl border border-[#DCE6F0] bg-[#0E1B2A] px-5 py-6 text-[13px] leading-6 text-white/70 sm:px-7">
              <p className="text-sm font-semibold text-white">需要帮助？</p>
              <p className="mt-1">
                如对本{doc.shortTitle}有疑问，可通过页面中的联系邮箱与我们联系。
              </p>
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/" className="text-white/85 underline-offset-2 hover:underline">
                  返回首页
                </Link>
                <Link
                  href={doc.slug === "terms" ? "/privacy" : "/terms"}
                  className="text-white/85 underline-offset-2 hover:underline"
                >
                  查看{doc.slug === "terms" ? "隐私政策" : "用户服务条款"}
                </Link>
                <span>© 2026 AI 简历编辑器</span>
              </p>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
