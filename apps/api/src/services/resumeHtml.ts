import { TailoredResume } from "../models";
import { escapeHtml, normalizeText } from "../utils/text";

function chips(items: string[], matchedKeywords?: string[]) {
  return items.map((item) => {
    const isMatch = matchedKeywords?.some((kw) => normalizeText(item).includes(normalizeText(kw)));
    const cls = isMatch ? "chip chip-match" : "chip";
    return `<span class="${cls}">${escapeHtml(item)}</span>`;
  }).join(" ");
}

function section(title: string, body: string) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function cleanEmail(value?: string): string | undefined {
  const withoutLabel = cleanContactLabel(value);
  const email = withoutLabel?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return email?.toLowerCase();
}

function cleanContactLabel(value?: string): string | undefined {
  const cleaned = value
    ?.replace(/^(e-?mail|email|telefone|phone|celular|linkedin|github|portfolio|portfólio|localização|localizacao|location)\s*:?\s*/i, "")
    .trim();
  return cleaned || undefined;
}

function profileUrl(kind: "linkedin" | "github", value?: string): string | undefined {
  const cleaned = cleanContactLabel(value)?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  if (!cleaned) return undefined;
  if (cleaned.includes(`${kind}.com/`)) return `https://${cleaned}`;
  return kind === "linkedin" ? `https://www.linkedin.com/in/${cleaned}` : `https://github.com/${cleaned}`;
}

function contactLink(label: string, href?: string): string {
  return href ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label);
}

export function renderResumeHtml(resume: TailoredResume): string {
  const matchedKeywords = resume.analysis?.matchedKeywords ?? [];
  const email = cleanEmail(resume.contact.email) || resume.contact.email;
  const phone = cleanContactLabel(resume.contact.phone);
  const linkedin = cleanContactLabel(resume.contact.linkedin);
  const github = cleanContactLabel(resume.contact.github);
  const portfolio = cleanContactLabel(resume.contact.portfolio);
  const location = cleanContactLabel(resume.contact.location);
  const contactParts = [
    email ? contactLink(email, `mailto:${email}`) : undefined,
    phone ? escapeHtml(phone) : undefined,
    linkedin ? contactLink("LinkedIn", profileUrl("linkedin", linkedin)) : undefined,
    github ? contactLink("GitHub", profileUrl("github", github)) : undefined,
    portfolio ? contactLink("Portfólio", portfolio.startsWith("http") ? portfolio : `https://${portfolio}`) : undefined,
    location ? escapeHtml(location) : undefined
  ].filter(Boolean) as string[];

  const experiences = resume.experiences
    .map(
      (exp) => `
        <div class="item">
          <div class="row">
            <h3>${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</h3>
            <span>${escapeHtml([exp.start, exp.end].filter(Boolean).join(" — "))}</span>
          </div>
          <p>${escapeHtml(exp.description)}</p>
          <div class="chips">${chips(exp.skills, matchedKeywords)}</div>
        </div>
      `
    )
    .join("");

  const projects = resume.projects
    .map(
      (project) => `
        <div class="item">
          <h3>${escapeHtml(project.name)}</h3>
          <p>${escapeHtml(project.description)}</p>
          <div class="chips">${chips(project.skills, matchedKeywords)}</div>
        </div>
      `
    )
    .join("");

  const education = resume.education
    .map(
      (edu) => `
        <div class="item">
          <div class="row">
            <h3>${escapeHtml(edu.degree)} — ${escapeHtml(edu.institution)}</h3>
            <span>${escapeHtml([edu.start, edu.end].filter(Boolean).join(" — "))}</span>
          </div>
          ${edu.description ? `<p>${escapeHtml(edu.description)}</p>` : ""}
        </div>
      `
    )
    .join("");

  const skills = resume.skillGroups
    .map(
      (group) => `
        <div class="skill-group">
          <h3>${escapeHtml(group.title)}</h3>
          <div class="chips">${chips(group.items, matchedKeywords)}</div>
        </div>
      `
    )
    .join("");

  const languages = resume.languages.map((lang) => `<span class="chip">${escapeHtml(lang.name)} — ${escapeHtml(lang.level)}</span>`).join(" ");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(resume.fileName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 28px 32px;
      font-size: 13px;
      line-height: 1.55;
      background: #fff;
    }
    header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
    h1 { font-size: 26px; margin: 0 0 3px; letter-spacing: -0.02em; color: #111827; }
    .title { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #2563eb; }
    .contact { font-size: 11.5px; color: #374151; }
    .contact a { color: #2563eb; text-decoration: none; }
    h2 {
      font-size: 13px;
      font-weight: 700;
      margin: 14px 0 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e5e7eb;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #374151;
    }
    h3 { font-size: 13px; font-weight: 700; margin: 0 0 2px; color: #111827; }
    p { margin: 0 0 5px; color: #374151; }
    p, h1, h2, h3, span, a { overflow-wrap: anywhere; word-break: normal; }
    .item { margin-bottom: 12px; break-inside: avoid; }
    .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .row span { white-space: nowrap; color: #6b7280; font-size: 11.5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .chip {
      display: inline-block;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 2px 7px;
      font-size: 11px;
      color: #1d4ed8;
      font-weight: 500;
    }
    .chip-match {
      background: #dbeafe;
      border-color: #93c5fd;
      color: #1e40af;
    }
    .skill-group { margin-bottom: 10px; break-inside: avoid; }
    .skill-group h3 { font-size: 12px; color: #4b5563; font-weight: 600; margin-bottom: 4px; }
    section { margin-bottom: 4px; }
    @page { size: A4; margin: 14mm 16mm; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(resume.fullName)}</h1>
    <div class="title">${escapeHtml(resume.headerTitle)}</div>
    <div class="contact">${contactParts.join(" • ")}</div>
  </header>

  ${section("Resumo", `<p>${escapeHtml(resume.summary)}</p>`)}
  ${section("Experiência", experiences)}
  ${section("Projetos", projects)}
  ${section("Competências", skills)}
  ${section("Formação", education)}
  ${languages ? section("Idiomas", `<div class="chips">${languages}</div>`) : ""}
</body>
</html>`;
}
