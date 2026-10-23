"""Lê um PDF de currículo e monta o perfil mestre editável.

Porta de services/profileParser.ts. O texto do PDF é extraído com PyMuPDF,
agrupando os trechos que ficam na mesma linha como o pdf-parse (usado na
versão em Node) fazia, porque as heurísticas abaixo dependem desse formato
(por exemplo "EmailFulano@x.com" numa linha só).
"""
import re
from pathlib import Path
from typing import Optional

import pymupdf

from ..models import (
    ContactInfo,
    Education,
    Experience,
    Language,
    Project,
    ResumeProfile,
    SkillGroup,
)
from ..storage import now_utc, to_iso
from ..utils.text import compact, normalize_text, split_lines, truncate_at_word, unique

DateRange = dict  # {"start": str | None, "end": str | None}

SECTION_HEADINGS = [
    "Contact", "Contato", "Informações de Contato", "Dados Pessoais",
    "Education", "Formação", "Formação Acadêmica", "Escolaridade", "Educação",
    "Experience", "Experiência", "Experiência Profissional", "Experiências",
    "Projects", "Projetos", "Portfólio",
    "Skills", "Competências", "Habilidades", "Habilidades Técnicas", "Tecnologias",
    "Languages", "Idiomas",
    "Certifications", "Certificações", "Certificados", "Cursos",
    "Achievements", "Conquistas", "Prêmios",
    "Summary", "Resumo", "Sobre mim", "Objetivo"

]

SKILL_TERMS = [
    # Linguagens
    "JavaScript", "TypeScript", "Python", "PHP", "Java", "Kotlin", "Go", "Rust", "Ruby", "C#", "Swift",
    # Frontend
    "React", "Vue.js", "Angular", "Svelte", "Next.js", "Nuxt", "Remix", "Astro",
    "HTML5", "CSS3", "Tailwind CSS", "Sass", "SCSS", "Bootstrap", "Redux",
    "Webpack", "Vite", "Figma", "SEO", "WordPress",
    # Backend
    "Node.js", "NodeJs", "Express", "FastAPI", "Django", "Flask", "Rails",
    "Spring Boot", "Laravel", "NestJS",
    # Banco de dados
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "SQLite",
    "Prisma", "TypeORM", "Sequelize",
    # API / Integrações
    "APIs REST", "API REST", "GraphQL", "gRPC", "WebSocket", "Stripe",
    # Cloud
    "AWS", "GCP", "Azure", "Vercel", "Netlify",
    # DevOps
    "Docker", "Kubernetes", "CI/CD", "Terraform", "Nginx", "Git", "GitHub", "GitLab", "Linux", "Windows",
    # Testes
    "Jest", "Vitest", "Cypress", "Playwright",
    # Mensageria
    "Kafka", "RabbitMQ",
    # Metodologias
    "Scrum", "Kanban", "Agile",
    # IA
    "Claude", "ChatGPT", "Prompt Engineering", "PromptAI", "AI-assisted development", "Uso de IA para debugging",
    # Suporte / TI
    "Suporte remoto", "Atendimento ao cliente",
    "Instalação e configuração de sistemas operacionais", "Manutenção de computadores",
    "Manutenção de computadores (hardware e software)", "Backup e recuperação de dados",
    "Diagnóstico e solução de problemas", "Windows e Linux", "Redes TCP/IP",
    "Crimpagem de cabos de rede", "Configuração de ONT / ONU",
    "Cabeamento estruturado (UTP / RJ45)", "Testes de conectividade (Ping, Speed Test)",
    "Configuração de Wi-Fi",
    # Ferramentas
    "Postman", "Versionamento de código",
    "Deploy de aplicações", "Hospedagem de aplicações web",
    "Configuração de ambientes de desenvolvimento", "Desenvolvimento de sistemas web",
    "Chrome Extension API", "Chrome Extension API (Manifest v3)", "Manifest V3",
    "Web Speech API", "Chrome Storage", "DOM Manipulation",
    "API de pagamento do Stripe", "Deploy e hospedagem web",
    # Soft skills
    "Adaptabilidade", "Gestão de tempo", "Trabalho em equipe", "Foco em resultados",
    "Aprendizado contínuo", "Resolução de problemas", "Proatividade", "Colaboração",
    "Capacidade de aprendizado rápida", "Comunicação clara", "Organização",
    "Pensamento analítico", "Adaptabilidade sob pressão",
    "Comunicação com usuários e clientes", "Resolução de problemas técnicos"

]

SKILL_ALIASES = {
    "Javascript": "JavaScript",
    "nodeJS": "Node.js",
    "NodeJs": "Node.js",
    "Github": "GitHub",
    "Gitlab": "GitLab",
    "ClaudeAI": "Claude",
    "PromptAI": "Prompt Engineering",
    "Chrome Extension API (Manifest v3)": "Chrome Extension API",
    "API de pagamento do Stripe": "Stripe",
    "Deploy e hospedagem web": "Deploy de aplicações",
    "Vue": "Vue.js",
    "Vuejs": "Vue.js",
    "Nuxtjs": "Nuxt",
    "Nestjs": "NestJS",
    "Fastapi": "FastAPI",
    "Graphql": "GraphQL",
    "Mongodb": "MongoDB",
    "Postgresql": "PostgreSQL",
    "Typeorm": "TypeORM",
}

SKILL_GROUP_TITLES = [
    "Desenvolvimento Web", "Desenvolvimento Frontend", "Desenvolvimento Backend",
    "Ferramentas de Inteligência Artificial", "Inteligência Artificial",
    "Banco de Dados", "Bancos de Dados",
    "Ferramentas de Desenvolvimento", "Ferramentas",
    "Infraestrutura e Deploy", "Infraestrutura", "Cloud",
    "Sistemas Operacionais", "Suporte Técnico / TI", "Suporte Técnico",
    "Habilidades Técnicas", "Tecnologias", "Hard Skills",
    "SoftSkills", "Soft Skills", "Competências Interpessoais",
    "DevOps", "Testes", "Metodologias"

]

MONTHS_PT = {
    "jan": "Jan",
    "fev": "Fev",
    "mar": "Mar",
    "abr": "Abr",
    "mai": "Mai",
    "jun": "Jun",
    "jul": "Jul",
    "ago": "Ago",
    "set": "Set",
    "out": "Out",
    "nov": "Nov",
    "dez": "Dez",
    "janeiro": "Jan",
    "fevereiro": "Fev",
    "março": "Mar",
    "abril": "Abr",
    "maio": "Mai",
    "junho": "Jun",
    "julho": "Jul",
    "agosto": "Ago",
    "setembro": "Set",
    "outubro": "Out",
    "novembro": "Nov",
    "dezembro": "Dez",
}


# ─── extração de texto e limpeza ────────────────────────────────────────────

def extract_pdf_text(path: Path) -> str:
    """Texto do PDF, uma linha por posição vertical (mesma regra do pdf-parse)."""
    pages = []
    with pymupdf.open(path) as doc:
        for page in doc:
            text = ""
            last_y = None
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        y = round(span["origin"][1], 1)
                        text += span["text"] if last_y is None or y == last_y else "\n" + span["text"]
                        last_y = y
            pages.append(text)
    return "\n".join(pages)


def create_empty_profile() -> ResumeProfile:
    now = to_iso(now_utc())
    return ResumeProfile(id="default-profile", created_at=now, updated_at=now)


def normalize_pdf_text(value: str) -> str:
    value = value.replace("\u000b", "\n").replace("\r", "\n")
    value = re.sub(r"E-\s*\n\s*commerce", "E-commerce", value, flags=re.I)
    value = re.sub(r"([A-Za-zÀ-ÿ])-\s*\n\s*([a-zà-ÿ])", r"\1\2", value)  # palavra hifenizada na quebra de linha
    value = re.sub(r"(\d)-\s*\n\s*(\d)", r"\1-\2", value)
    value = re.sub(r"\s+—\s+", " — ", value)
    value = re.sub(r"Node\.\s*js", "Node.js", value, flags=re.I)
    value = re.sub(r"E-\s*commerce", "E-commerce", value, flags=re.I)
    value = re.sub(r"Wi-\s*Fi", "Wi-Fi", value, flags=re.I)
    value = re.sub(r"TCP/\s*IP", "TCP/IP", value, flags=re.I)
    value = re.sub(r"ONT\s*/\s*ONU", "ONT / ONU", value, flags=re.I)
    value = re.sub(r"UTP\s*/\s*RJ45", "UTP / RJ45", value, flags=re.I)
    value = re.sub(r"Suporte Técnico\s*N2", "Suporte Técnico N2", value, flags=re.I)
    value = re.sub(r"[ \t]+\n", "\n", value)
    return re.sub(r"\n{3,}", "\n\n", value)


def get_lines(text: str) -> list[str]:
    return [compact(line) for line in split_lines(text)]


def is_heading(line: str, headings: list[str] = SECTION_HEADINGS) -> bool:
    normalized = normalize_text(line)
    return any(normalize_text(h) == normalized for h in headings)


def section_lines(lines: list[str], starts: list[str], ends: list[str]) -> list[str]:
    """Linhas entre um título de seção (starts) e o próximo título conhecido (ends)."""
    start_norms = {normalize_text(s) for s in starts}
    end_norms = {normalize_text(e) for e in ends}

    start_index = next((i for i, line in enumerate(lines) if normalize_text(line) in start_norms), -1)
    if start_index == -1:
        return []

    end_index = next(
        (i for i, line in enumerate(lines) if i > start_index and normalize_text(line) in end_norms), -1
    )
    return lines[start_index + 1:(len(lines) if end_index == -1 else end_index)]


def section_text(lines: list[str], starts: list[str], ends: list[str]) -> str:
    return "\n".join(section_lines(lines, starts, ends))


def clean_name(value: Optional[str]) -> str:
    return compact(re.sub(r",\s*\d+$", "", value or ""))


# ─── datas ──────────────────────────────────────────────────────────────────

SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
_WORD = r"[A-Za-záàâãéêíóôõúç]"
_END = rf"(?:{_WORD}{{3,}}\.?\s+\d{{4}}|\d{{1,2}}/\d{{4}}|Present|Atual|Presente|\d{{4}})"
_FULL_RANGE = re.compile(rf"({_WORD}{{3,}}\.?\s+\d{{4}}|\d{{1,2}}/\d{{4}})\s*[—–\-]\s*({_END})", re.I)
_YEAR_RANGE = re.compile(r"(\d{4})\s*[—–\-]\s*(\d{4}|Present|Atual|Presente)", re.I)
_ONGOING = re.compile(r"present|atual|presente", re.I)
_LINE_DATE_PATTERNS = [
    re.compile(rf"{_WORD}{{3,}}\.?\s+\d{{4}}\s*[—–\-]\s*(?:{_WORD}{{3,}}\.?\s+\d{{4}}|Present|Atual|Presente|\d{{4}})", re.I),
    re.compile(r"\d{1,2}/\d{4}\s*[—–\-]\s*(?:\d{1,2}/\d{4}|Present|Atual|Presente|\d{4})", re.I),
    re.compile(r"\d{4}\s*[—–\-]\s*(?:\d{4}|Present|Atual|Presente)", re.I),
]


def normalize_month_year(value: str) -> str:
    clean = value.strip().lower()

    numeric = re.fullmatch(r"(\d{1,2})/(\d{4})", clean)  # "01/2023" -> "Jan 2023"
    if numeric:
        month_idx = int(numeric.group(1))
        month = SHORT_MONTHS[month_idx - 1] if 1 <= month_idx <= 12 else "Jan"
        return f"{month} {numeric.group(2)}"

    word = re.fullmatch(r"([a-záàâãéêíóôõúç]+)\.?\s+(\d{4})", clean)  # "janeiro 2023" -> "Jan 2023"
    if word:
        return f"{MONTHS_PT.get(word.group(1), word.group(1))} {word.group(2)}"

    return value.strip()


def parse_date_range(raw: str) -> DateRange:
    cleaned = re.sub(r"\s+", " ", raw).strip()

    full = _FULL_RANGE.search(cleaned)  # "Jan 2023 — Dez 2024" / "Janeiro 2023 - Atual"
    if full:
        return {
            "start": normalize_month_year(full.group(1)),
            "end": "Atual" if _ONGOING.search(full.group(2)) else normalize_month_year(full.group(2)),
        }

    years = _YEAR_RANGE.search(cleaned)  # "2023 - 2024" / "2021 – Atual"
    if years:
        return {"start": years.group(1), "end": "Atual" if _ONGOING.search(years.group(2)) else years.group(2)}

    return {}


def line_has_date_range(line: str) -> bool:
    return any(p.search(line) for p in _LINE_DATE_PATTERNS)


# ─── skills ─────────────────────────────────────────────────────────────────

def canonical_skill(value: str) -> str:
    cleaned = compact(value)
    return SKILL_ALIASES.get(cleaned, cleaned)


def skill_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", normalize_text(value))


def extract_known_skills(raw: str) -> list[str]:
    raw_norm = normalize_text(raw)
    stripped_key = skill_key(raw)
    found = []
    for term in (canonical_skill(t) for t in SKILL_TERMS):
        term_norm = normalize_text(term)
        term_key = skill_key(term)
        if len(term_norm) < 2:
            continue
        if len(term_key) >= 3:
            if term_key in stripped_key:
                found.append(term)
        elif re.search(rf"(?<![a-z0-9]){re.escape(term_norm)}(?![a-z0-9])", raw_norm, re.I):
            # Termos curtos ou com símbolos (C#, Go): palavra inteira, para evitar falsos positivos.
            found.append(term)
    return unique(found)


def extract_skills(raw: str) -> list[str]:
    normalized = compact(raw)
    if not normalized:
        return []

    # Depois de compact() só "•" e ";" sobram como separadores (quebras de linha já viraram espaço).
    has_separator = re.search(r"\n|•|;|\s{2,}", normalized) is not None
    direct = []
    if has_separator:
        parts = (canonical_skill(item) for item in re.split(r"\n|•|;|\s{2,}", normalized))
        direct = [item for item in parts if 1 < len(item) < 80]

    matched = extract_known_skills(normalized)
    return [item for item in unique(direct + matched) if len(item) > 1][:60]


def looks_like_skill_line(line: str) -> bool:
    skills = extract_known_skills(line)
    return len(skills) >= 2 or (len(skills) == 1 and len(line) < 80 and not re.search(r"[.!?]", line))


def split_description_and_skills(lines: list[str]) -> tuple[str, list[str]]:
    skill_start = next((i for i, line in enumerate(lines) if i > 0 and looks_like_skill_line(line)), -1)
    description_lines = lines if skill_start == -1 else lines[:skill_start]
    skill_lines = [] if skill_start == -1 else lines[skill_start:]

    return (
        truncate_at_word(" ".join(description_lines), 900),
        extract_skills("\n".join(skill_lines))[:14],
    )


# ─── experiências ───────────────────────────────────────────────────────────

def split_header_at_company(line: str) -> Optional[tuple[str, str]]:
    """"Desenvolvedor Web at Empresa" -> ("Desenvolvedor Web", "Empresa")."""
    match = re.match(r"^(.+?)\s+at\s+(.+)$", line, re.I)
    if not match:
        return None
    role = re.sub(r"\s*/\s*", " / ", re.sub(r"\bTi\b", "TI", compact(match.group(1))))
    return role, compact(match.group(2))


def coalesce_experience_lines(lines: list[str]) -> list[str]:
    """Junta cabeçalhos que o PDF quebrou em duas linhas ("Cargo" + "at Empresa")."""
    result = []
    index = 0
    while index < len(lines):
        line = lines[index]
        nxt = lines[index + 1] if index + 1 < len(lines) else None

        if nxt and " at " not in line and not looks_like_skill_line(line) and split_header_at_company(f"{line} {nxt}"):
            result.append(compact(f"{line} {nxt}"))
            index += 2
            continue

        result.append(line)
        index += 1
    return result


def extract_experiences(lines: list[str]) -> list[Experience]:
    clean = coalesce_experience_lines([line for line in lines if not is_heading(line)])
    header_indexes = [
        i for i, line in enumerate(clean)
        if split_header_at_company(line)
        and (line_has_date_range(clean[i + 1] if i + 1 < len(clean) else "") or line_has_date_range(line))
    ]

    experiences = []
    for position, start_index in enumerate(header_indexes):
        end_index = header_indexes[position + 1] if position + 1 < len(header_indexes) else len(clean)
        block = clean[start_index:end_index]
        header = split_header_at_company(block[0])
        if not header:
            continue

        date_line_index = next((i for i, line in enumerate(block) if line_has_date_range(line)), -1)
        dates = parse_date_range(block[date_line_index] if date_line_index >= 0 else "")
        body_lines = [line for i, line in enumerate(block) if i != 0 and i != date_line_index]
        description, skills = split_description_and_skills(body_lines)

        if not description:
            continue
        experiences.append(Experience(
            role=header[0], company=header[1], start=dates.get("start"), end=dates.get("end"),
            description=description, skills=skills,
        ))
    return experiences


# ─── formação ───────────────────────────────────────────────────────────────

def extract_education(lines: list[str]) -> list[Education]:
    if not lines:
        return []

    first_line = next((line for line in lines if not line_has_date_range(line)), None)
    date_line = next((line for line in lines if line_has_date_range(line)), None)
    if first_line is None:
        return []

    header = re.match(r"^(?:Associate Degree in\s+)?(.+?)(?:\.?\s+at\s+(.+))$", first_line, re.I)
    fallback_degree = re.sub(r"^Associate Degree in\s+", "", first_line, flags=re.I)
    degree = re.sub(r"\.$", "", compact((header.group(1) if header else None) or fallback_degree))

    at_line = next((line for line in lines if re.match(r"^at\s+", line, re.I)), None)
    at_institution = re.sub(r"^at\s+", "", at_line, flags=re.I) if at_line else ""
    institution = compact((header.group(2) if header else None) or at_institution)

    dates = parse_date_range(date_line or "")
    description = compact(" ".join(
        line for line in lines if line != first_line and line != date_line and not re.match(r"^at\s+", line, re.I)
    ))[:500]

    if not degree and not institution:
        return []

    return [Education(
        degree=degree or "Formação informada no currículo",
        institution=institution or "Instituição não identificada",
        start=dates.get("start"),
        end=dates.get("end"),
        description=description,
    )]


# ─── projetos ───────────────────────────────────────────────────────────────

def looks_like_project_title(line: str, previous_line: Optional[str] = None) -> bool:
    if not line or line_has_date_range(line) or looks_like_skill_line(line) or re.search(r"[.!?]$", line):
        return False
    if len(line) > 95:
        return False
    if re.match(r"^(o|a|os|as|projeto|sistema|solução)\b", line, re.I):
        return False
    if previous_line and not looks_like_skill_line(previous_line) and not re.search(r"[.!?]$", previous_line):
        return False
    return re.match(r"^[A-ZÁ-Ú0-9]", line) is not None


def extract_projects(lines: list[str]) -> list[Project]:
    title_indexes = [
        i for i, line in enumerate(lines)
        if looks_like_project_title(line, lines[i - 1] if i > 0 else None)
    ]

    projects = []
    for position, start_index in enumerate(title_indexes):
        end_index = title_indexes[position + 1] if position + 1 < len(title_indexes) else len(lines)
        block = lines[start_index:end_index]
        description, skills = split_description_and_skills(block[1:])
        if block[0] and description:
            projects.append(Project(name=block[0], description=description, skills=skills))
    return projects


# ─── grupos de skills ───────────────────────────────────────────────────────

def is_skill_group_title(line: str) -> bool:
    return any(normalize_text(title) == normalize_text(line) for title in SKILL_GROUP_TITLES)


def extract_skill_groups(lines: list[str]) -> list[SkillGroup]:
    groups: list[SkillGroup] = []
    current_title = ""
    current_items: list[str] = []

    def flush() -> None:
        nonlocal current_items
        if current_title and current_items:
            title = "Soft Skills" if current_title == "SoftSkills" else current_title
            groups.append(SkillGroup(title=title, items=unique(current_items)))
        current_items = []

    for line in lines:
        if is_skill_group_title(line):
            flush()
            current_title = line
            continue
        if current_title:
            current_items.extend(extract_skills(line))

    flush()
    return groups


# ─── idiomas ────────────────────────────────────────────────────────────────

LANGUAGE_PATTERNS = [
    (re.compile(r"ingl[eê]s|english", re.I), "Inglês"),
    (re.compile(r"espanhol|spanish|castellano", re.I), "Espanhol"),
    (re.compile(r"franc[eê]s|french|français", re.I), "Francês"),
    (re.compile(r"portugu[eê]s|portuguese", re.I), "Português"),
    (re.compile(r"alem[aã]o|german|deutsch", re.I), "Alemão"),
    (re.compile(r"italiano|italian", re.I), "Italiano"),
]

LEVEL_PATTERNS = [
    (re.compile(r"nativo|native|fluente|fluent|avan[cç]ado", re.I), "Avançado / Fluente"),
    (re.compile(r"intermediate|intermedi[aá]rio", re.I), "Intermediário"),
    (re.compile(r"b[aá]sico|basic|elementar|iniciante|a1|a2", re.I), "Básico"),
    (re.compile(r"b1|b2", re.I), "Intermediário"),
    (re.compile(r"c1|c2", re.I), "Avançado / Fluente"),
]


def extract_languages(raw: str) -> list[Language]:
    languages = []
    for pattern, name in LANGUAGE_PATTERNS:
        if not pattern.search(raw):
            continue
        level = next((lv for p, lv in LEVEL_PATTERNS if p.search(raw)), "Informado no currículo")
        languages.append(Language(name=name, level=level))
    return languages


# ─── título, resumo e contato ───────────────────────────────────────────────

def detect_title(lines: list[str], name: str) -> str:
    ignored = normalize_text(name)
    for line in lines:
        if 3 < len(line) < 80 and normalize_text(line) != ignored and not is_heading(line) and not re.search(r"@|\d{4}", line):
            return line
    return ""


def detect_summary(lines: list[str], title: str) -> str:
    contact_index = next(
        (i for i, line in enumerate(lines)
         if re.match(r"^contact$|^contato$|^informa[cç][oõ]es de contato$|^dados pessoais$", line, re.I)),
        -1,
    )
    if contact_index == -1:
        return ""

    title_index = next((i for i, line in enumerate(lines) if line == title), -1)
    start = title_index + 1 if title_index >= 0 else 1
    return compact(" ".join(lines[start:contact_index]))[:900]


def extract_contact(text: str) -> ContactInfo:
    email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
    email = re.sub(r"^Email", "", email_match.group(0), flags=re.I) if email_match else None

    phone_label = re.search(r"Phone\s*([+\d][\d\s()–-]{8,20})", text, re.I)
    phone_plain = re.search(r"(?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4,5}\s*[-–]?\s*\d{4,5}", text)
    phone = compact((phone_label.group(1) if phone_label else None) or (phone_plain.group(0) if phone_plain else "")) or None

    linkedin_url = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Z0-9_.-]+/?", text, re.I)
    linkedin_label = re.search(r"LinkedIn\s*([A-Z0-9_.-]{3,})", text, re.I)
    github = re.search(r"(?:https?://)?(?:www\.)?github\.com/[A-Z0-9_.-]+/?", text, re.I)
    portfolio = re.search(r"(?:https?://)?(?:www\.)?(?!linkedin|github)[A-Z0-9_.-]+\.[A-Z]{2,}/[A-Z0-9_.-]*", text, re.I)

    strip_scheme = lambda m: re.sub(r"^https?://", "", m.group(0), flags=re.I) if m else None
    return ContactInfo(
        email=email,
        phone=phone,
        linkedin=strip_scheme(linkedin_url) or (linkedin_label.group(1) if linkedin_label else None),
        github=strip_scheme(github),
        portfolio=portfolio.group(0) if portfolio else None,
    )


# ─── mesclagem com o perfil existente ───────────────────────────────────────

def merge_profile(parsed: ResumeProfile, existing: Optional[ResumeProfile]) -> ResumeProfile:
    """Dados lidos do PDF têm prioridade; o que o PDF não trouxe é preservado do perfil atual."""
    if existing is None:
        return parsed

    contact = {**existing.contact.model_dump(), **{k: v for k, v in parsed.contact.model_dump().items() if v}}
    return existing.model_copy(update={
        "full_name": parsed.full_name or existing.full_name,
        "target_title": parsed.target_title or existing.target_title,
        "summary": parsed.summary or existing.summary,
        "contact": ContactInfo(**contact),
        "education": parsed.education or existing.education,
        "experiences": parsed.experiences or existing.experiences,
        "projects": parsed.projects or existing.projects,
        "skill_groups": parsed.skill_groups or existing.skill_groups,
        "languages": parsed.languages or existing.languages,
        "created_at": existing.created_at,
        "updated_at": parsed.updated_at,
    })


def add_section_warnings(warnings: list[str], parsed: dict[str, int], existing: Optional[ResumeProfile]) -> None:
    existing_counts = {
        "formação": len(existing.education) if existing else 0,
        "experiências": len(existing.experiences) if existing else 0,
        "projetos": len(existing.projects) if existing else 0,
        "grupos de skills": len(existing.skill_groups) if existing else 0,
        "idiomas": len(existing.languages) if existing else 0,
    }
    for label, parsed_count in parsed.items():
        if parsed_count > 0:
            warnings.append(f"Importei {parsed_count} item(ns) de {label} do PDF.")
        elif existing_counts[label] > 0:
            warnings.append(f"Não consegui separar {label} no PDF; preservei os dados existentes.")
        else:
            warnings.append(f"Não consegui identificar {label} no PDF. Revise o perfil antes de gerar currículos.")


EXPERIENCE_SECTIONS = ["Experience", "Experiência", "Experiência Profissional", "Experiências"]
PROJECT_SECTIONS = ["Projects", "Projetos", "Portfólio"]
SKILL_SECTIONS = ["Skills", "Competências", "Habilidades", "Habilidades Técnicas", "Tecnologias"]
EDUCATION_SECTIONS = ["Education", "Formação", "Formação Acadêmica", "Escolaridade", "Educação"]
LANGUAGE_SECTIONS = ["Languages", "Idiomas"]
CONTACT_SECTIONS = ["Contact", "Contato", "Informações de Contato", "Dados Pessoais"]


def parse_profile_from_pdf(file_path: Path, existing: Optional[ResumeProfile] = None):
    """Retorna (perfil, texto_bruto, avisos)."""
    raw_text = extract_pdf_text(file_path)
    normalized_text = normalize_pdf_text(raw_text)
    lines = get_lines(normalized_text)
    warnings: list[str] = []

    empty = create_empty_profile()
    name = clean_name(next((line for line in lines if not is_heading(line)), None))
    title = detect_title(lines[1:12], name)
    summary = detect_summary(lines, title)
    contact = extract_contact(normalized_text)

    education = extract_education(section_lines(lines, EDUCATION_SECTIONS, EXPERIENCE_SECTIONS + PROJECT_SECTIONS + SKILL_SECTIONS))
    experiences = extract_experiences(section_lines(lines, EXPERIENCE_SECTIONS, PROJECT_SECTIONS + SKILL_SECTIONS + LANGUAGE_SECTIONS))
    projects = extract_projects(section_lines(lines, PROJECT_SECTIONS, SKILL_SECTIONS + LANGUAGE_SECTIONS + CONTACT_SECTIONS))
    skill_groups = extract_skill_groups(section_lines(lines, SKILL_SECTIONS, LANGUAGE_SECTIONS + CONTACT_SECTIONS))
    languages = extract_languages(section_text(lines, LANGUAGE_SECTIONS, []))

    if not name:
        warnings.append("Não consegui identificar o nome no PDF. Revise o perfil antes de gerar currículos.")
    if not contact.email:
        warnings.append("Não consegui identificar e-mail no PDF. Revise o perfil antes de gerar currículos.")
    if not summary:
        warnings.append("Não consegui identificar um resumo claro no PDF. Complete o resumo manualmente.")

    add_section_warnings(warnings, {
        "formação": len(education),
        "experiências": len(experiences),
        "projetos": len(projects),
        "grupos de skills": len(skill_groups),
        "idiomas": len(languages),
    }, existing)

    parsed = empty.model_copy(update={
        "id": existing.id if existing else "default-profile",
        "full_name": name,
        "target_title": title,
        "summary": summary,
        "contact": contact,
        "education": education,
        "experiences": experiences,
        "projects": projects,
        "skill_groups": skill_groups,
        "languages": languages,
        "created_at": existing.created_at if existing else empty.created_at,
        "updated_at": to_iso(now_utc()),
    })
    return merge_profile(parsed, existing), raw_text, warnings
