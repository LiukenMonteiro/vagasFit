"""HTML do currículo (layout simples, sem foto, texto selecionável) usado para gerar o PDF."""
import html
import re
from pathlib import Path
from typing import Optional

from ..models import TailoredResume
from ..storage import clean_contact_label, clean_email
from ..utils.text import normalize_text

STYLE = (Path(__file__).with_name("resume.css")).read_text(encoding="utf-8")


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def chips(items: list[str], matched_keywords: list[str]) -> str:
    """Skills que casam com a vaga ganham a classe chip-match (destaque no PDF)."""
    parts = []
    for item in items:
        is_match = any(normalize_text(kw) in normalize_text(item) for kw in matched_keywords)
        parts.append(f'<span class="{"chip chip-match" if is_match else "chip"}">{esc(item)}</span>')
    return " ".join(parts)


def section(title: str, body: str) -> str:
    return f"<section><h2>{esc(title)}</h2>{body}</section>"


def profile_url(kind: str, value: Optional[str]) -> Optional[str]:
    cleaned = clean_contact_label(value)
    if not cleaned:
        return None
    cleaned = re.sub(r"/$", "", re.sub(r"^www\.", "", re.sub(r"^https?://", "", cleaned, flags=re.I), flags=re.I))
    if f"{kind}.com/" in cleaned:
        return f"https://{cleaned}"
    return f"https://www.linkedin.com/in/{cleaned}" if kind == "linkedin" else f"https://github.com/{cleaned}"


def contact_link(label: str, href: Optional[str]) -> str:
    return f'<a href="{esc(href)}">{esc(label)}</a>' if href else esc(label)


def date_range(start: Optional[str], end: Optional[str]) -> str:
    return " — ".join(part for part in (start, end) if part)


def render_resume_html(resume: TailoredResume) -> str:
    matched = resume.analysis.matched_keywords if resume.analysis else []
    contact = resume.contact
    email = clean_email(contact.email) or contact.email
    phone = clean_contact_label(contact.phone)
    linkedin = clean_contact_label(contact.linkedin)
    github = clean_contact_label(contact.github)
    portfolio = clean_contact_label(contact.portfolio)
    location = clean_contact_label(contact.location)

    contact_parts = [
        contact_link(email, f"mailto:{email}") if email else None,
        esc(phone) if phone else None,
        contact_link("LinkedIn", profile_url("linkedin", linkedin)) if linkedin else None,
        contact_link("GitHub", profile_url("github", github)) if github else None,
        contact_link("Portfólio", portfolio if portfolio.startswith("http") else f"https://{portfolio}") if portfolio else None,
        esc(location) if location else None,
    ]

    experiences = "".join(f"""
        <div class="item">
          <div class="row">
            <h3>{esc(exp.role)} — {esc(exp.company)}</h3>
            <span>{esc(date_range(exp.start, exp.end))}</span>
          </div>
          <p>{esc(exp.description)}</p>
          <div class="chips">{chips(exp.skills, matched)}</div>
        </div>
      """ for exp in resume.experiences)

    projects = "".join(f"""
        <div class="item">
          <h3>{esc(project.name)}</h3>
          <p>{esc(project.description)}</p>
          <div class="chips">{chips(project.skills, matched)}</div>
        </div>
      """ for project in resume.projects)

    education = "".join(f"""
        <div class="item">
          <div class="row">
            <h3>{esc(edu.degree)} — {esc(edu.institution)}</h3>
            <span>{esc(date_range(edu.start, edu.end))}</span>
          </div>
          {f"<p>{esc(edu.description)}</p>" if edu.description else ""}
        </div>
      """ for edu in resume.education)

    skills = "".join(f"""
        <div class="skill-group">
          <h3>{esc(group.title)}</h3>
          <div class="chips">{chips(group.items, matched)}</div>
        </div>
      """ for group in resume.skill_groups)

    languages = " ".join(f'<span class="chip">{esc(lang.name)} — {esc(lang.level)}</span>' for lang in resume.languages)

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>{esc(resume.file_name)}</title>
  <style>
{STYLE}
  </style>
</head>
<body>
  <header>
    <h1>{esc(resume.full_name)}</h1>
    <div class="title">{esc(resume.header_title)}</div>
    <div class="contact">{" • ".join(part for part in contact_parts if part)}</div>
  </header>

  {section("Resumo", f"<p>{esc(resume.summary)}</p>")}
  {section("Experiência", experiences)}
  {section("Projetos", projects)}
  {section("Competências", skills)}
  {section("Formação", education)}
  {section("Idiomas", f'<div class="chips">{languages}</div>') if languages else ""}
</body>
</html>"""
