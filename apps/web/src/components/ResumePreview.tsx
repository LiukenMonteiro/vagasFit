import { useState } from "react";
import { pdfUrl } from "../api";
import { TailoredResume } from "../types";

type Props = {
  resume: TailoredResume | null;
};

function cleanEmail(value?: string) {
  const withoutLabel = cleanContactLabel(value);
  return withoutLabel?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase();
}

function cleanContactLabel(value?: string) {
  return value
    ?.replace(/^(e-?mail|email|telefone|phone|celular|linkedin|github|portfolio|portfólio|localização|localizacao|location)\s*:?\s*/i, "")
    .trim();
}

function profileUrl(kind: "linkedin" | "github", value?: string) {
  const cleaned = cleanContactLabel(value)?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  if (!cleaned) return undefined;
  if (cleaned.includes(`${kind}.com/`)) return `https://${cleaned}`;
  return kind === "linkedin" ? `https://www.linkedin.com/in/${cleaned}` : `https://github.com/${cleaned}`;
}

export function ResumePreview({ resume }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!resume) {
    return (
      <section className="card empty-state preview-empty">
        <div>
          <span className="eyebrow">03</span>
          <h2>Prévia do currículo</h2>
          <p>Cole uma vaga e gere uma versão adaptada para revisar, comparar as mudanças e baixar em PDF.</p>
        </div>
      </section>
    );
  }

  const scoreLabel = resume.analysis.baselineAtsScore !== undefined
    ? `${resume.analysis.baselineAtsScore}% → ${resume.analysis.atsScore}%`
    : `${resume.analysis.atsScore}% ATS`;
  const email = cleanEmail(resume.contact.email) || resume.contact.email;
  const phone = cleanContactLabel(resume.contact.phone);
  const linkedin = cleanContactLabel(resume.contact.linkedin);
  const github = cleanContactLabel(resume.contact.github);
  const location = cleanContactLabel(resume.contact.location);
  const contactItems = [
    email ? <a href={`mailto:${email}`} key="email">{email}</a> : undefined,
    phone ? <span key="phone">{phone}</span> : undefined,
    linkedin ? <a href={profileUrl("linkedin", linkedin)} target="_blank" rel="noreferrer" key="linkedin">LinkedIn</a> : undefined,
    github ? <a href={profileUrl("github", github)} target="_blank" rel="noreferrer" key="github">GitHub</a> : undefined,
    location ? <span key="location">{location}</span> : undefined
  ].filter(Boolean);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="eyebrow">03</span>
          <h2>Currículo gerado</h2>
          <p className="muted">{resume.sourceJobTitle} · {scoreLabel}</p>
        </div>
        <div className="actions compact-actions">
          <button className="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Ver 1 página" : "Expandir prévia"}
          </button>
          <a className="button" href={pdfUrl(resume.id)} target="_blank" rel="noreferrer">
            Baixar PDF
          </a>
        </div>
      </div>

      <div className="preview-pages">
        <div className="preview-page-label">Página 1</div>
        <div className="resume-paper">
          <h1>{resume.fullName}</h1>
          <h2>{resume.headerTitle}</h2>
          <p className="contact-line">
            {contactItems.map((item, index) => (
              <span className="contact-item" key={index}>
                {index > 0 && <span className="contact-separator">•</span>}
                {item}
              </span>
            ))}
          </p>

          <section>
            <h3>Resumo</h3>
            <p>{resume.summary}</p>
          </section>

          <section>
            <h3>Experiência</h3>
            {resume.experiences.map((exp) => (
              <div className="preview-item" key={`${exp.role}-${exp.company}`}>
                <strong>{exp.role} — {exp.company}</strong>
                <p>{exp.description}</p>
                <div className="chips">{exp.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
              </div>
            ))}
          </section>
        </div>

        {expanded && (
          <>
            <div className="preview-page-label">Página 2</div>
            <div className="resume-paper">
              <section>
                <h3>Projetos</h3>
                {resume.projects.length === 0 && <p className="muted">Nenhum projeto selecionado para esta versão.</p>}
                {resume.projects.map((project) => (
                  <div className="preview-item" key={project.name}>
                    <strong>{project.name}</strong>
                    <p>{project.description}</p>
                    <div className="chips">{project.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
                  </div>
                ))}
              </section>

              <section>
                <h3>Skills</h3>
                <div className="preview-skill-groups">
                  {resume.skillGroups.map((group) => (
                    <div className="preview-skill-group" key={group.title}>
                      <strong>{group.title}</strong>
                      <div className="chips">{group.items.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {resume.education.length > 0 && (
                <section>
                  <h3>Formação</h3>
                  {resume.education.map((edu) => (
                    <div className="preview-item" key={`${edu.degree}-${edu.institution}`}>
                      <strong>{edu.degree} — {edu.institution}</strong>
                      <p>{[edu.start, edu.end].filter(Boolean).join(" — ")}</p>
                      {edu.description && <p>{edu.description}</p>}
                    </div>
                  ))}
                </section>
              )}

              {resume.languages.length > 0 && (
                <section>
                  <h3>Idiomas</h3>
                  <div className="chips">{resume.languages.map((lang) => <span className="chip" key={lang.name}>{lang.name} — {lang.level}</span>)}</div>
                </section>
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid two">
        <div className="panel">
          <h3>O que foi alterado</h3>
          <ul>{resume.changeLog.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className="panel">
          <h3>Avisos ATS/verdade</h3>
          <ul>{resume.atsWarnings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
