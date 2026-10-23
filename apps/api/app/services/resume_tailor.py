"""Gera a versão do currículo adaptada a uma vaga, sem inventar experiência.

Porta de services/resumeTailor.ts. Tudo aqui só reordena, reescreve e destaca
informações que já existem no perfil mestre; o que a vaga pede e o perfil não
tem vira "lacuna" (missing_keywords), nunca afirmação.
"""
import re
import uuid
from datetime import date, datetime, timezone

from ..models import (
    Experience,
    JobAnalysis,
    Project,
    ResumeProfile,
    SkillGroup,
    TailoredResume,
)
from ..utils.slug import slugify
from ..utils.text import compact, js_round, normalize_text, truncate_at_word, unique
from .job_analyzer import analyze_job_description

SENIORITY_LABELS = {
    "estagio": "estagiário(a)",
    "junior": "Júnior",
    "pleno": "Pleno",
    "senior": "Sênior",
    "nao_informado": "",
}

FOCUS_BOOST = {
    "frontend": ["frontend", "front-end", "interface", "react", "vue", "angular", "html", "css", "javascript", "typescript"],
    "backend": ["backend", "back-end", "node", "python", "api", "banco", "sql", "mysql", "postgres", "django", "fastapi"],
    "fullstack": ["desenvolvimento", "fullstack", "full stack", "apis", "web", "react", "node", "sql"],
    "suporte_ti": ["suporte", "usuario", "windows", "linux", "manutencao", "helpdesk"],
    "infra": ["linux", "windows", "redes", "infra", "docker", "kubernetes", "aws", "cloud"],
    "misto": [],
}


# ─── pontuação de texto ─────────────────────────────────────────────────────

def overlap_score(text: str, keywords: list[str]) -> int:
    """Soma 2 pontos por ocorrência de cada keyword no texto (no máximo 3 por keyword)."""
    normalized = normalize_text(text)
    score = 0
    for keyword in keywords:
        norm_kw = normalize_text(keyword)
        occurrences = normalized.count(norm_kw) if norm_kw else 0
        score += min(occurrences, 3) * 2
    return score


def text_has_keyword(text: str, keyword: str) -> bool:
    return normalize_text(keyword) in normalize_text(text)


def count_keyword_occurrences(text: str, keyword: str) -> int:
    norm_kw = normalize_text(keyword)
    return normalize_text(text).count(norm_kw) if norm_kw else 0


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [s for s in (compact(p) for p in parts) if s]


def ranked_sentences(description: str, analysis: JobAnalysis) -> list[str]:
    """Frases com mais keywords da vaga primeiro; empate mantém a ordem original
    (sorted do Python é estável)."""
    sentences = split_sentences(description)
    if len(sentences) <= 1:
        return sentences
    return sorted(sentences, key=lambda s: -overlap_score(s, analysis.matched_keywords))


def relevant_keywords_for_item(text: str, analysis: JobAnalysis, limit: int = 5) -> list[str]:
    return [k for k in analysis.matched_keywords if text_has_keyword(text, k)][:limit]


def seniority_label(seniority: str) -> str:
    return SENIORITY_LABELS.get(seniority, "")


# ─── textos ─────────────────────────────────────────────────────────────────

def focus_phrase(analysis: JobAnalysis, keywords: list[str]) -> str:
    tech_text = f" com {', '.join(keywords[:3])}" if keywords else ""
    is_senior = analysis.seniority == "senior"
    is_junior = analysis.seniority in ("junior", "estagio")
    focus = analysis.focus

    if focus == "frontend":
        if is_senior:
            return f"Atuação{tech_text} em arquitetura de interfaces, performance, acessibilidade e entrega de experiências web de alto padrão."
        if is_junior:
            return f"Desenvolvimento de interfaces responsivas e acessíveis{tech_text}, com foco em boas práticas e evolução técnica contínua."
        return f"Criação de interfaces responsivas e experiências web{tech_text}, com atenção a UX, SEO e integração com APIs."

    if focus == "backend":
        if is_senior:
            return f"Arquitetura e desenvolvimento de APIs, microsserviços e sistemas escaláveis{tech_text}, com foco em segurança, performance e qualidade."
        if is_junior:
            return f"Desenvolvimento de APIs e integrações backend{tech_text}, com foco em aprendizado e crescimento técnico."
        return f"Desenvolvimento de APIs, integrações e soluções backend{tech_text}, com foco em robustez e manutenibilidade."

    if focus == "fullstack":
        if is_senior:
            return f"Desenvolvimento ponta a ponta — interfaces, APIs, banco de dados e deploy — com liderança técnica{tech_text}."
        return f"Desenvolvimento full stack{tech_text}: interfaces responsivas, APIs e banco de dados, com visão de produto e entrega em produção."

    if focus == "suporte_ti":
        if is_senior:
            return f"Gestão e resolução de incidentes técnicos, liderança de equipe de suporte e melhoria de processos de TI{tech_text}."
        return f"Suporte técnico a usuários, diagnóstico de problemas e manutenção de ambientes{tech_text} com foco em agilidade e satisfação."

    if focus == "infra":
        if is_senior:
            return f"Arquitetura de infraestrutura, segurança e confiabilidade de ambientes{tech_text}."
        return f"Administração de infraestrutura, redes e ambientes{tech_text}, com foco em estabilidade e desempenho."

    return f"Experiência alinhada aos requisitos reais da vaga{tech_text}."


def adapted_description(original: str, item_text: str, analysis: JobAnalysis, max_length: int) -> str:
    keywords = relevant_keywords_for_item(item_text, analysis)
    sentences = ranked_sentences(original, analysis)
    reordered = " ".join(sentences) if sentences else original

    if not keywords:
        return truncate_at_word(reordered, max_length)
    return truncate_at_word(f"{focus_phrase(analysis, keywords)} {reordered}", max_length)


def profile_fingerprint(profile: ResumeProfile) -> str:
    parts = [profile.full_name, profile.contact.email, profile.contact.phone]
    return normalize_text("|".join(p for p in parts if p))


# ─── ordenação e seleção ────────────────────────────────────────────────────

def _experience_text(exp: Experience) -> str:
    return " ".join([exp.role, exp.company, exp.description, *exp.skills])


def _project_text(project: Project) -> str:
    return " ".join([project.name, project.description, *project.skills])


def rank_experiences(experiences: list[Experience], analysis: JobAnalysis) -> list[Experience]:
    boost = FOCUS_BOOST.get(analysis.focus, [])

    def score(exp: Experience) -> int:
        text = _experience_text(exp)
        return overlap_score(text, analysis.keywords) + overlap_score(text, boost)

    return sorted(experiences, key=lambda e: -score(e))


def rank_projects(projects: list[Project], analysis: JobAnalysis) -> list[Project]:
    return sorted(projects, key=lambda p: -overlap_score(_project_text(p), analysis.keywords))


def select_projects(projects: list[Project], analysis: JobAnalysis) -> list[Project]:
    """Projetos relevantes primeiro (>= 25% da maior pontuação), depois os demais; no máximo 5."""
    if not projects:
        return []

    scored = [(p, overlap_score(_project_text(p), analysis.keywords)) for p in projects]
    max_score = max(score for _, score in scored)
    threshold = max_score * 0.25 if max_score > 0 else 0

    relevant = [p for p, score in scored if score >= threshold]
    remaining = [p for p, score in scored if score < threshold]
    selected = (relevant + remaining)[:5]
    return selected or projects[:3]


# ─── cabeçalho e resumo ─────────────────────────────────────────────────────

def build_header_title(profile: ResumeProfile, analysis: JobAnalysis) -> str:
    if not analysis.matched_keywords:
        return profile.target_title

    title = normalize_text(analysis.job_title)
    level = f" {seniority_label(analysis.seniority)}" if analysis.seniority != "nao_informado" else ""

    if "front" in title:
        return f"Desenvolvedor Front-end{level}"
    if "back" in title:
        return f"Desenvolvedor Back-end{level}"
    if "full" in title:
        return f"Desenvolvedor Full Stack{level}"
    if "react" in title:
        return f"Desenvolvedor React{level}"
    if "node" in title:
        return f"Desenvolvedor Node.js{level}"
    if "python" in title:
        return f"Desenvolvedor Python{level}"
    if "java" in title and "javascript" not in title:
        return f"Desenvolvedor Java{level}"
    if "mobile" in title or "android" in title or "ios" in title:
        return f"Desenvolvedor Mobile{level}"
    if "dados" in title or "data" in title:
        return f"Engenheiro de Dados{level}"
    if analysis.focus == "suporte_ti":
        return f"Técnico de Suporte / TI{level}"
    if analysis.focus == "infra":
        return f"Técnico em Infraestrutura / TI{level}"
    if analysis.focus == "backend":
        return f"Desenvolvedor Back-end{level}"
    if analysis.focus == "frontend":
        return f"Desenvolvedor Front-end{level}"
    if analysis.focus == "fullstack":
        return f"Desenvolvedor Full Stack{level}"

    return profile.target_title


def extract_years_from_experiences(profile: ResumeProfile) -> int:
    total = 0
    for exp in profile.experiences:
        start = re.search(r"\d{4}", exp.start or "")
        end = re.search(r"\d{4}", exp.end or "")
        if not start:
            continue
        end_year = int(end.group(0)) if end else date.today().year
        total += end_year - int(start.group(0))
    return max(0, total)


def build_summary(profile: ResumeProfile, analysis: JobAnalysis) -> str:
    matched = analysis.matched_keywords[:6]
    if not matched:
        return profile.summary

    skill_text = ", ".join(matched)
    years_total = extract_years_from_experiences(profile)
    years_text = f"{years_total}+ anos de experiência" if years_total >= 1 else "experiência"
    level = seniority_label(analysis.seniority)
    level_text = f" {level}" if level else ""

    original = (profile.summary or "").strip()
    has_good_original = len(original) > 100

    if analysis.focus in ("frontend", "backend", "fullstack") and has_good_original:
        return truncate_at_word(f"{original} Habilidades destacadas para a vaga: {skill_text}.", 700)

    if analysis.focus == "frontend":
        return f"Desenvolvedor Front-end{level_text} com {years_text} em criação de interfaces responsivas e aplicações web utilizando {skill_text}. Foco em UX, performance e integração com APIs."
    if analysis.focus == "backend":
        return f"Desenvolvedor Back-end{level_text} com {years_text} em construção de APIs, integrações e sistemas utilizando {skill_text}. Foco em robustez, organização e resolução de problemas."
    if analysis.focus == "fullstack":
        return f"Desenvolvedor Full Stack{level_text} com {years_text} em soluções completas — interfaces, APIs e banco de dados — utilizando {skill_text}. Projetos entregues em produção com foco em qualidade e resultado."
    if analysis.focus in ("suporte_ti", "infra"):
        return f"Profissional de TI{level_text} com {years_text} em suporte técnico, manutenção de sistemas e ambientes {skill_text}. Foco em atendimento ágil e resolução definitiva de problemas."

    return profile.summary


# ─── competências ───────────────────────────────────────────────────────────

def priority_for_group(title: str, analysis: JobAnalysis) -> int:
    normalized = normalize_text(title)
    focus = analysis.focus

    if focus == "frontend" and ("desenvolvimento" in normalized or "frontend" in normalized):
        return 1
    if focus == "backend" and ("banco" in normalized or "backend" in normalized or "api" in normalized):
        return 1
    if focus == "fullstack" and "desenvolvimento" in normalized:
        return 1
    if focus == "suporte_ti" and "suporte" in normalized:
        return 1
    if focus == "infra" and ("infra" in normalized or "sistemas" in normalized):
        return 1
    if "soft" in normalized:
        return 9
    return 5


def _matches_any_keyword(item: str, analysis: JobAnalysis) -> bool:
    return any(normalize_text(k) in normalize_text(item) for k in analysis.matched_keywords)


def tailor_skill_groups(skill_groups: list[SkillGroup], analysis: JobAnalysis) -> list[SkillGroup]:
    groups = []
    for group in skill_groups:
        matched_items = [i for i in group.items if _matches_any_keyword(i, analysis)]
        remaining = [i for i in group.items if i not in matched_items]
        groups.append(group.model_copy(update={"items": unique(matched_items + remaining)}))

    skill_items = {normalize_text(item) for group in skill_groups for item in group.items}
    aligned = [k for k in analysis.matched_keywords if normalize_text(k) in skill_items][:10]
    aligned_group = [SkillGroup(title="Aderência à vaga", items=aligned)] if aligned else []

    groups.sort(key=lambda g: priority_for_group(g.title, analysis))
    return aligned_group + groups


def emphasize_descriptions(items: list[Experience], analysis: JobAnalysis) -> list[Experience]:
    result = []
    for item in items:
        skills = unique(
            [s for s in item.skills if _matches_any_keyword(s, analysis)] + item.skills
        )[:10]
        result.append(item.model_copy(update={
            "description": adapted_description(item.description, _experience_text(item), analysis, 800),
            "skills": skills,
        }))
    return result


def emphasize_projects(projects: list[Project], analysis: JobAnalysis) -> list[Project]:
    result = []
    for project in projects:
        skills = unique(
            [s for s in project.skills if any(text_has_keyword(s, k) for k in analysis.matched_keywords)]
            + project.skills
        )[:10]
        result.append(project.model_copy(update={
            "description": adapted_description(project.description, _project_text(project), analysis, 800),
            "skills": skills,
        }))
    return result


# ─── pontuação ATS ──────────────────────────────────────────────────────────

def optimized_ats_score(analysis: JobAnalysis, header_title: str, summary: str,
                        experiences: list[Experience], projects: list[Project],
                        skill_groups: list[SkillGroup]) -> int:
    """Estima a aderência depois da otimização.

    70% vem da verdade (keywords que o perfil realmente tem) e 30% de quão
    visíveis elas ficam no documento (cabeçalho, skills, experiências...).
    O ganho é limitado a +15 pontos sobre o ATS bruto, para não inflar o número.
    """
    if not analysis.keywords:
        return 0

    header_summary = " ".join([header_title, summary])
    experience_text = " ".join(t for e in experiences for t in [e.role, e.company, e.description, *e.skills])
    project_text = " ".join(t for p in projects for t in [p.name, p.description, *p.skills])
    skills_text = " ".join(t for g in skill_groups for t in [g.title, *g.items])
    full_text = " ".join([header_summary, experience_text, project_text, skills_text])

    truth_score = len(analysis.matched_keywords) / len(analysis.keywords) * 70

    if not analysis.matched_keywords:
        presentation_score = 0.0
    else:
        total = 0.0
        for keyword in analysis.matched_keywords:
            visibility = 0.0
            if text_has_keyword(header_summary, keyword):
                visibility += 0.35
            if text_has_keyword(skills_text, keyword):
                visibility += 0.25
            if text_has_keyword(experience_text, keyword):
                visibility += 0.25
            if text_has_keyword(project_text, keyword):
                visibility += 0.1
            if count_keyword_occurrences(full_text, keyword) >= 3:
                visibility += 0.05
            total += min(1.0, visibility)
        presentation_score = total / len(analysis.matched_keywords) * 30

    matched_must = sum(1 for k in analysis.must_have if k in analysis.matched_keywords)
    must_boost = 0 if not analysis.must_have else js_round(matched_must / len(analysis.must_have) * 8)

    raw = analysis.ats_score
    computed = min(98, js_round(truth_score + presentation_score + must_boost))
    return max(raw, min(computed, raw + 15))


def build_ats_warnings(analysis: JobAnalysis) -> list[str]:
    warnings = []
    if analysis.missing_keywords:
        warnings.append(f"Lacunas detectadas na vaga e não afirmadas no currículo: {', '.join(analysis.missing_keywords)}.")
    if analysis.ats_score < 50:
        warnings.append("A compatibilidade inicial está abaixo de 50%. Recomenda-se candidatura apenas se a vaga aceitar aprendizado ou requisitos flexíveis.")
    if analysis.seniority == "senior" and analysis.ats_score < 65:
        warnings.append("Vaga sênior com aderência abaixo de 65%. Considere fortalecer as experiências listadas no perfil antes de candidatar.")
    warnings.append("PDF gerado em layout simples, sem foto, sem ícones obrigatórios e com texto selecionável para favorecer leitura por ATS.")
    return warnings


def build_change_log(analysis: JobAnalysis) -> list[str]:
    if not analysis.matched_keywords:
        log = [
            "Nenhuma palavra-chave real do perfil foi encontrada para adaptação segura.",
            "Resumo e título do perfil foram preservados para evitar afirmar experiência inexistente.",
            "Termos da vaga que não existem no currículo mestre foram tratados como lacunas.",
        ]
    else:
        log = [
            f"Resumo profissional adaptado para foco em {analysis.focus.replace('_', ' ', 1)} (nível: {analysis.seniority}).",
            f"Skills com maior aderência movidas para o começo: {', '.join(analysis.matched_keywords[:6])}.",
            "Todos os grupos de competências do currículo mestre foram preservados, incluindo Soft Skills.",
            "Descrições de experiências e projetos reorganizadas para evidenciar requisitos reais da vaga.",
            "Projetos selecionados por relevância para a vaga (máximo 5, mínimo 1).",
            "Termos não existentes no currículo mestre foram tratados como lacunas, não como experiência.",
        ]

    if analysis.baseline_ats_score is not None and (analysis.optimization_lift or 0) > 0:
        log.insert(0, f"Aderência estimada evoluiu de {analysis.baseline_ats_score}% para {analysis.ats_score}% após a transformação.")

    log.extend(analysis.notes)
    return log


# ─── ponto de entrada ───────────────────────────────────────────────────────

def generate_tailored_resume(profile: ResumeProfile, job_description: str) -> TailoredResume:
    analysis = analyze_job_description(job_description, profile)
    header_title = build_header_title(profile, analysis)
    experiences = emphasize_descriptions(rank_experiences(profile.experiences, analysis), analysis)
    projects = emphasize_projects(select_projects(rank_projects(profile.projects, analysis), analysis), analysis)
    skill_groups = tailor_skill_groups(profile.skill_groups, analysis)
    summary = build_summary(profile, analysis)

    score = optimized_ats_score(analysis, header_title, summary, experiences, projects, skill_groups)
    optimized = analysis.model_copy(update={
        "baseline_ats_score": analysis.ats_score,
        "optimization_lift": max(0, score - analysis.ats_score),
        "ats_score": score,
    })

    company_part = f"-{slugify(analysis.company)}" if analysis.company else ""
    file_name = f"curriculo-{slugify(profile.full_name)}-{slugify(analysis.job_title)}{company_part}.pdf"
    created = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    return TailoredResume(
        id=str(uuid.uuid4()),
        file_name=file_name,
        profile_fingerprint=profile_fingerprint(profile),
        profile_full_name=profile.full_name,
        profile_email=profile.contact.email,
        source_job_title=analysis.job_title,
        company=analysis.company,
        created_at=created,
        full_name=profile.full_name,
        header_title=header_title,
        summary=summary,
        contact=profile.contact,
        education=profile.education,
        experiences=experiences,
        projects=projects,
        skill_groups=skill_groups,
        languages=profile.languages,
        analysis=optimized,
        change_log=build_change_log(optimized),
        ats_warnings=build_ats_warnings(optimized),
    )
