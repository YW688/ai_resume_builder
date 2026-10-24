import type { CSSProperties, ReactNode } from "react";
import type { AccentId, Experience, Resume, TemplateId } from "@/lib/mock/types";
import { Icon, type IconName } from "./icons";

/**
 * 真实渲染的 A4 简历纸（DESIGN §4.3）。签名元素：所有列表 / 卡片 / 编辑器预览
 * / 打印导出都用同一套 `.a4-page` 组件，而不是灰色占位条。
 */
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

const ACCENT_COLORS: Record<AccentId, string> = {
  blue: "#1a6bd6",
  ink: "#0e1b2a",
  green: "#247b50",
};

const NAME_PLACEHOLDER = "未命名";

type PageStyle = CSSProperties & {
  "--a4-accent": string;
  "--a4-kw"?: string;
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 纯文本安全的关键词高亮：命中词包成 `<mark class="a4-kw">`，忽略大小写。
 * 不解析 HTML，只按文本切分，因此不存在注入问题。
 */
export function highlightText(text: string, keywords?: string[]): ReactNode {
  if (!text) return text;
  const words = (keywords ?? []).map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);
  if (words.length === 0) return text;
  const pattern = words
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  if (parts.length <= 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="a4-kw">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function formatRange(startDate: string, endDate: string): string {
  const start = startDate.trim();
  const end = endDate.trim();
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function nonEmpty(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/* --------------------------------- 区块 ---------------------------------- */

function ContactList({ resume }: { resume: Resume }) {
  const items: Array<{ icon: IconName; value: string }> = [];
  const phone = nonEmpty(resume.phone);
  const email = nonEmpty(resume.email);
  const city = nonEmpty(resume.city);
  if (phone) items.push({ icon: "phone", value: phone });
  if (email) items.push({ icon: "mail", value: email });
  if (city) items.push({ icon: "pin", value: city });
  if (items.length === 0) return null;
  return (
    <div className="a4-contact">
      {items.map((item) => (
        <span key={item.icon} className="a4-contact-item">
          <Icon name={item.icon} size={11} />
          {item.value}
        </span>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="a4-section-title">{children}</div>;
}

function SummarySection({ text, keywords }: { text: string; keywords?: string[] }) {
  const summary = nonEmpty(text);
  if (!summary) return null;
  return (
    <section className="a4-section">
      <SectionTitle>求职总结</SectionTitle>
      <div className="a4-summary">{highlightText(summary, keywords)}</div>
    </section>
  );
}

function ExperienceSection({
  experiences,
  keywords,
}: {
  experiences: Experience[];
  keywords?: string[];
}) {
  const visible = experiences.filter(
    (exp) => nonEmpty(exp.title) || nonEmpty(exp.company) || nonEmpty(exp.description),
  );
  if (visible.length === 0) return null;
  return (
    <section className="a4-section">
      <SectionTitle>工作经历</SectionTitle>
      {visible.map((exp, index) => {
        const bullets = exp.description
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        return (
          <div className="a4-exp" key={nonEmpty(exp.id) || `exp-${index}`}>
            <div className="a4-exp-head">
              <div style={{ minWidth: 0 }}>
                <div className="a4-exp-title">{highlightText(nonEmpty(exp.title) || "—", keywords)}</div>
                {nonEmpty(exp.company) ? (
                  <div className="a4-exp-company">{highlightText(nonEmpty(exp.company), keywords)}</div>
                ) : null}
              </div>
              <div className="a4-exp-date">{formatRange(exp.startDate, exp.endDate)}</div>
            </div>
            {bullets.length > 0 ? (
              <ul className="a4-bullets">
                {bullets.map((bullet, bulletIndex) => (
                  <li key={`${index}-${bulletIndex}`}>{highlightText(bullet, keywords)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function EducationSection({
  educations,
  keywords,
}: {
  educations: Resume["educations"];
  keywords?: string[];
}) {
  const visible = educations.filter(
    (edu) => nonEmpty(edu.school) || nonEmpty(edu.degree) || nonEmpty(edu.major),
  );
  if (visible.length === 0) return null;
  return (
    <section className="a4-section">
      <SectionTitle>教育经历</SectionTitle>
      {visible.map((edu, index) => (
        <div className="a4-exp" key={nonEmpty(edu.id) || `edu-${index}`}>
          <div className="a4-exp-head">
            <div style={{ minWidth: 0 }}>
              <div className="a4-exp-title">{highlightText(nonEmpty(edu.school) || "—", keywords)}</div>
              <div className="a4-exp-company">
                {[nonEmpty(edu.degree), nonEmpty(edu.major)].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="a4-exp-date">{formatRange(edu.startDate, edu.endDate)}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

function SkillsSection({ skills, keywords }: { skills: string[]; keywords?: string[] }) {
  const visible = skills.map((skill) => nonEmpty(skill)).filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <section className="a4-section">
      <SectionTitle>技能</SectionTitle>
      <div className="a4-skills">
        {visible.map((skill, index) => (
          <span className="a4-skill" key={`${skill}-${index}`}>
            {highlightText(skill, keywords)}
          </span>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- A4 页 --------------------------------- */

export type A4PageProps = {
  resume: Resume;
  /** 默认使用 `resume.templateId`。 */
  variant?: TemplateId;
  /** 默认使用 `resume.accent`。 */
  accent?: AccentId;
  /** 需要高亮的关键词（命中词包成 `mark.a4-kw`，忽略大小写）。 */
  highlight?: string[];
  /** 目标岗位名，显示在姓名下方。 */
  job?: string;
  /** 真实照片地址（data URL 或存储 URL）；缺省时退回 `resume.photoUrl` / 首字母头像。 */
  photoUrl?: string | null;
  /** 关键词高亮底色（默认姜黄）。 */
  highlightColor?: string;
  className?: string;
};

export function A4Page({
  resume,
  variant,
  accent,
  highlight,
  job,
  photoUrl,
  highlightColor,
  className,
}: A4PageProps) {
  const template = variant ?? resume.templateId;
  const tone = accent ?? resume.accent;
  const style: PageStyle = {
    "--a4-accent": ACCENT_COLORS[tone] ?? ACCENT_COLORS.blue,
    ...(highlightColor ? { "--a4-kw": highlightColor } : {}),
  };
  const name = nonEmpty(resume.fullName) || NAME_PLACEHOLDER;
  const jobTitle = nonEmpty(job);
  const photoInitials = nonEmpty(resume.photoInitials);
  const photoSrc = nonEmpty(photoUrl) || nonEmpty(resume.photoUrl);
  const experiences = resume.experiences ?? [];
  const educations = resume.educations ?? [];
  const skills = resume.skills ?? [];
  const classes = cx(
    "a4-page",
    template === "split" && "a4-page--split",
    template === "compact" && "a4-page--compact",
    className,
  );

  const isSplit = template === "split";

  if (isSplit) {
    return (
      <article className={classes} style={style} aria-label="A4 简历预览">
        <aside className="a4-side">
          {photoSrc || photoInitials ? (
            <div className="a4-photo" style={{ marginBottom: 14 }}>
              {photoSrc ? <img className="a4-photo-img" src={photoSrc} alt="" /> : photoInitials}
            </div>
          ) : null}
          <div className="a4-name">{name}</div>
          {jobTitle ? <div className="a4-role">{jobTitle}</div> : null}
          <div className="a4-rule" />
          <ContactList resume={resume} />
          <SkillsSection skills={skills} keywords={highlight} />
          <EducationSection educations={educations} keywords={highlight} />
        </aside>
        <div className="a4-main">
          <SummarySection text={resume.summary} keywords={highlight} />
          <ExperienceSection experiences={experiences} keywords={highlight} />
        </div>
      </article>
    );
  }

  return (
    <article className={classes} style={style} aria-label="A4 简历预览">
      <header className="a4-head">
        <div style={{ minWidth: 0 }}>
          <div className="a4-name">{name}</div>
          {jobTitle ? <div className="a4-role">{jobTitle}</div> : null}
          <ContactList resume={resume} />
        </div>
        {photoSrc || photoInitials ? (
          <div className="a4-photo">
            {photoSrc ? <img className="a4-photo-img" src={photoSrc} alt="" /> : photoInitials}
          </div>
        ) : null}
      </header>
      <div className="a4-rule" />
      <SummarySection text={resume.summary} keywords={highlight} />
      <ExperienceSection experiences={experiences} keywords={highlight} />
      <EducationSection educations={educations} keywords={highlight} />
      <SkillsSection skills={skills} keywords={highlight} />
    </article>
  );
}

/* ------------------------------- A4 缩略图 -------------------------------- */

export type A4ThumbProps = {
  resume: Resume;
  variant?: TemplateId;
  accent?: AccentId;
  job?: string;
  highlight?: string[];
  /** 外框宽度（高度按 A4 比例 = width × 1.4142）。 */
  width?: number;
  className?: string;
};

/** 用 transform: scale 缩放真实 A4 页，不截图、不用 next/image。 */
export function A4Thumb({
  resume,
  variant,
  accent,
  job,
  highlight,
  width = 160,
  className,
}: A4ThumbProps) {
  const height = Math.round(width * 1.4142);
  // 外框有 1px 边线，按内容宽度缩放，避免右 / 下边缘被裁掉。
  const scale = Math.max(1, width - 2) / A4_WIDTH;
  const label = nonEmpty(resume.fullName) || NAME_PLACEHOLDER;
  return (
    <div
      className={cx("a4-thumb", className)}
      role="img"
      aria-label={`${label}的简历预览`}
      style={{ width, height }}
    >
      <div
        className="a4-thumb-inner"
        style={{ width: A4_WIDTH, height: A4_HEIGHT, transform: `scale(${scale})` }}
      >
        <A4Page resume={resume} variant={variant} accent={accent} job={job} highlight={highlight} />
      </div>
    </div>
  );
}
