export type AtsExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type AtsEducation = {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
};

export type AtsResume = {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  skills: string;
  photoUrl: string | null;
  experiences: AtsExperience[];
  educations: AtsEducation[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dateRange(start: string, end: string): string {
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

/**
 * 返回简历正文的 HTML（内联 class，配合 lib/pdf.ts 里的 <style> 使用）。
 * 纯字符串输出，避免在 Next 16 里依赖 react-dom/server。
 */
export function renderAtsHtml(resume: AtsResume): string {
  const skills = resume.skills
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const contact = [resume.phone, resume.email, resume.city]
    .filter(Boolean)
    .join(" · ");

  const experiences = resume.experiences
    .map(
      (exp) => `
    <div class="exp">
      <div class="exp-head">
        <span class="exp-company">${esc(exp.company || "公司")}${
          exp.title ? ` <span class="muted">· ${esc(exp.title)}</span>` : ""
        }</span>
        <span class="muted date">${esc(dateRange(exp.startDate, exp.endDate))}</span>
      </div>
      ${exp.description ? `<p class="desc">${esc(exp.description)}</p>` : ""}
    </div>`,
    )
    .join("");

  const educations = resume.educations
    .map(
      (edu) => `
    <div class="edu">
      <span>${esc(edu.school || "学校")}${
        edu.degree ? ` <span class="muted">· ${esc(edu.degree)}</span>` : ""
      }${edu.major ? ` <span class="muted">· ${esc(edu.major)}</span>` : ""}</span>
      <span class="muted date">${esc(dateRange(edu.startDate, edu.endDate))}</span>
    </div>`,
    )
    .join("");

  const skillsHtml = skills
    .map((s) => `<span class="skill">${esc(s)}</span>`)
    .join("");

  return `
<div class="page">
  <div class="header">
    <div>
      <h1>${esc(resume.fullName || "姓名")}</h1>
      ${contact ? `<p class="contact">${esc(contact)}</p>` : ""}
    </div>
    ${resume.photoUrl ? `<img src="${esc(resume.photoUrl)}" class="photo" alt="照片" />` : ""}
  </div>
  ${
    resume.summary
      ? `<section><h2>个人总结</h2><p class="summary">${esc(resume.summary)}</p></section>`
      : ""
  }
  ${
    resume.experiences.length
      ? `<section><h2>工作经历</h2>${experiences}</section>`
      : ""
  }
  ${
    resume.educations.length
      ? `<section><h2>教育背景</h2>${educations}</section>`
      : ""
  }
  ${
    skills.length
      ? `<section><h2>专业技能</h2><div class="skills">${skillsHtml}</div></section>`
      : ""
  }
</div>`;
}
