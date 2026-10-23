"""Análise de descrição de vaga: palavras-chave, foco, senioridade e aderência ao perfil.

Porta de services/jobAnalyzer.ts. As heurísticas foram mantidas de propósito
para que o resultado seja idêntico ao da versão em Node.
"""
import re
from typing import Optional

from ..models import JobAnalysis, ResumeProfile
from ..utils.text import compact, js_round, normalize_text, split_lines, title_case, unique

# Dicionário: rótulo exibido -> variações (aliases) que aparecem nas vagas.
TECH_KEYWORDS: dict[str, list[str]] = {
    # --- Linguagens ---
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "Python": ["python"],
    "PHP": ["php"],
    "Java": ["java"],
    "Kotlin": ["kotlin"],
    "Go": ["golang", "go lang"],
    "Rust": ["rust", "rustlang"],
    "Ruby": ["ruby"],
    "C#": ["c#", "csharp", "dotnet"],
    "Swift": ["swift"],

    # --- Frontend ---
    "React": ["react", "reactjs", "react.js"],
    "Vue.js": ["vue", "vuejs", "vue.js", "vue 3", "vue3"],
    "Angular": ["angular", "angularjs", "angular.js"],
    "Svelte": ["svelte", "sveltekit"],
    "Next.js": ["next", "nextjs", "next.js"],
    "Nuxt": ["nuxt", "nuxtjs", "nuxt.js"],
    "Remix": ["remix"],
    "Astro": ["astro"],
    "HTML5": ["html", "html5"],
    "CSS3": ["css", "css3"],
    "Tailwind CSS": ["tailwind", "tailwindcss", "tailwind css"],
    "Sass/SCSS": ["sass", "scss"],
    "Bootstrap": ["bootstrap"],
    "Redux": ["redux", "redux toolkit", "zustand", "jotai", "recoil"],
    "Webpack": ["webpack"],
    "Vite": ["vite"],
    "Figma": ["figma"],
    "SEO": ["seo", "otimizacao para mecanismos", "mecanismos de busca"],
    "WordPress": ["wordpress", "wp"],

    # --- Backend ---
    "Node.js": ["node", "nodejs", "node.js"],
    "Express": ["express", "expressjs"],
    "FastAPI": ["fastapi", "fast api"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Rails": ["rails", "ruby on rails"],
    "Spring Boot": ["spring", "spring boot", "springboot"],
    "Laravel": ["laravel"],
    "NestJS": ["nestjs", "nest.js"],

    # --- Banco de Dados ---
    "MySQL": ["mysql"],
    "PostgreSQL": ["postgres", "postgresql"],
    "SQL": ["sql", "banco de dados relacional"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "Elasticsearch": ["elasticsearch", "elastic search", "opensearch"],
    "SQLite": ["sqlite"],
    "Prisma": ["prisma"],
    "TypeORM": ["typeorm", "type orm"],
    "Sequelize": ["sequelize"],

    # --- API / Integrações ---
    "API REST": ["api", "apis", "rest", "api rest", "apis rest", "restful"],
    "GraphQL": ["graphql", "graph ql"],
    "gRPC": ["grpc"],
    "Stripe": ["stripe", "pagamento", "pagamentos"],
    "WebSocket": ["websocket", "websockets", "socket.io", "socketio"],

    # --- Cloud ---
    "AWS": ["aws", "amazon web services", "ec2", "s3", "lambda"],
    "GCP": ["gcp", "google cloud", "google cloud platform"],
    "Azure": ["azure", "microsoft azure"],
    "Vercel": ["vercel"],
    "Netlify": ["netlify"],

    # --- DevOps / Infra ---
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "CI/CD": ["ci/cd", "cicd", "integracao continua", "integração contínua", "github actions", "gitlab ci", "jenkins"],
    "Terraform": ["terraform"],
    "Nginx": ["nginx"],
    "Git": ["git", "github", "gitlab"],
    "Linux": ["linux"],
    "Windows": ["windows", "win"],

    # --- Suporte / TI ---
    "Redes": ["redes", "rede cabeada", "tcp/ip", "tcp ip", "roteadores", "wi-fi", "wifi", "cabo de rede", "compartilhamento de pastas", "seguranca de rede", "segurança de rede"],
    "Suporte técnico": ["suporte", "suporte de ti", "suporte tecnico", "suporte técnico", "suporte presencial", "suporte remoto", "suporte aos usuarios", "suporte aos usuários", "help desk", "helpdesk", "atendimento remoto", "atendimentos remotos"],
    "Manutenção de computadores": ["manutencao de computadores", "manutenção de computadores", "manutencao de equipamentos", "manutenção de equipamentos", "hardware", "perifericos", "periféricos"],
    "Pacote Office": ["pacote office", "office", "microsoft office", "excel", "word", "powerpoint"],
    "Impressoras": ["impressoras", "impressora", "scanners", "scanner", "impressoras de rede"],
    "ERP": ["erp", "sistema erp", "sistemas internos", "sistemas corporativos", "sistemas integrados"],
    "WMS": ["wms"],
    "Active Directory": ["active directory", "dominio de rede", "domínio de rede"],
    "Backup": ["backup", "backups"],
    "CFTV": ["cftv", "camera ip", "câmera ip", "cameras ip", "câmeras ip"],
    "Firewall": ["firewall"],
    "Inventário de TI": ["inventario", "inventário", "controle de equipamentos", "organizacao de equipamentos"],

    # --- Testes ---
    "Jest": ["jest"],
    "Vitest": ["vitest"],
    "Cypress": ["cypress"],
    "Playwright": ["playwright"],
    "Testes automatizados": ["testes automatizados", "testes unitarios", "testes unitários", "unit test", "unit testing", "tdd", "test driven"],

    # --- Mensageria ---
    "Kafka": ["kafka", "apache kafka"],
    "RabbitMQ": ["rabbitmq", "rabbit mq"],

    # --- Metodologias ---
    "Scrum": ["scrum"],
    "Kanban": ["kanban"],
    "Agile": ["agile", "agil", "ágil", "metodologia agil", "metodologia ágil"],

    # --- IA ---
    "IA": ["inteligencia artificial", "machine learning", "ml", "chatgpt", "claude", "prompt", "ai-assisted", "llm", "openai"],

    # --- Soft Skills e Outros ---
    "Documentação": ["documentar", "documentacao", "documentação", "registrar atendimentos", "acompanhar chamados", "chamados"],
    "Comunicação": ["comunicacao", "comunicação", "boa comunicacao", "boa comunicação"],
    "Organização": ["organizacao", "organização", "organizada", "organizado"],
    "Proatividade": ["proativa", "proativo", "proatividade"],
    "Inglês técnico": ["ingles", "ingles tecnico", "leitura em ingles", "english"],
    "Espanhol": ["espanhol", "spanish"],

}

FRONTEND = ["JavaScript", "TypeScript", "React", "Vue.js", "Angular", "Svelte", "Next.js", "Nuxt", "Remix", "Astro", "HTML5", "CSS3", "Tailwind CSS", "Sass/SCSS", "Bootstrap", "Redux", "Webpack", "Vite", "Figma", "SEO", "WordPress"]

BACKEND = ["Node.js", "Express", "Python", "FastAPI", "Django", "Flask", "PHP", "Laravel", "Rails", "Spring Boot", "NestJS", "Java", "Kotlin", "Go", "Rust", "C#", "MySQL", "PostgreSQL", "SQL", "MongoDB", "Redis", "Elasticsearch", "API REST", "GraphQL", "gRPC", "Prisma", "TypeORM", "Sequelize", "Stripe", "Kafka", "RabbitMQ"]

INFRA = ["Linux", "Windows", "Docker", "Kubernetes", "CI/CD", "Terraform", "Nginx", "AWS", "GCP", "Azure", "Redes", "Active Directory", "Backup", "CFTV", "Firewall"]

SUPPORT = ["Suporte técnico", "Manutenção de computadores", "Pacote Office", "Impressoras", "ERP", "WMS", "Inventário de TI", "Documentação", "Comunicação", "Organização", "Proatividade", "Windows", "Linux", "Redes"]


_NEGATION = re.compile(
    r"\b(nao|não|sem|evite|evitar|dispensavel|dispensável|nenhum|nenhuma|exceto|excluindo|desconsidere)\b.{0,60}$",
    re.I,
)


def has_negation_before(text: str, match_index: int) -> bool:
    """Há uma negação ("sem experiência com X") nos 80 caracteres antes do termo?"""
    before = text[max(0, match_index - 80):match_index]
    return _NEGATION.search(before) is not None


def alias_match_index(normalized: str, alias_norm: str) -> int:
    stripped = re.sub(r"[^a-z0-9]", "", alias_norm)
    if len(stripped) < 3:
        # Aliases curtos (go, ml, ts, c#...): palavra inteira, para evitar falsos positivos.
        match = re.search(rf"(?<![a-z0-9]){re.escape(alias_norm)}(?![a-z0-9])", normalized, re.I)
        return match.start() if match else -1
    return normalized.find(alias_norm)


def detect_keywords(text: str) -> list[str]:
    normalized = normalize_text(text)
    found = []
    for label, aliases in TECH_KEYWORDS.items():
        for alias in aliases:
            idx = alias_match_index(normalized, normalize_text(alias))
            if idx != -1 and not has_negation_before(normalized, idx):
                found.append(label)
                break
    return unique(found)


def detect_job_title(text: str) -> str:
    first = next((line for line in split_lines(text) if 3 < len(line) < 90), None)
    return compact(re.sub(r"^vaga:?\s*", "", first, flags=re.I)) if first else "Vaga de TI"


_NAME = r"[A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40}"
_COMPANY_PATTERNS = [
    re.compile(rf"na\s+({_NAME})\s+(será|sera|buscamos|estamos|como)", re.I),
    re.compile(rf"empresa:?\s*({_NAME})", re.I),
    re.compile(rf"cliente:?\s*({_NAME})", re.I),
    re.compile(rf"trabalhar(?:emos|á)?\s+(?:com|na|em|para)\s+({_NAME})", re.I),
    re.compile(rf"oportunidade\s+(?:na|em|para)\s+({_NAME})", re.I),
]


def detect_company(text: str) -> Optional[str]:
    for pattern in _COMPANY_PATTERNS:
        match = pattern.search(text)
        if match and match.group(1):
            return re.sub(r"[.,;:]$", "", compact(match.group(1)))
    return None


def detect_seniority(text: str) -> str:
    normalized = normalize_text(text)

    if re.search(r"(estagio|estagiario|trainee|aprendiz|programa de capacitacao|entrada de carreira|primeiro emprego)", normalized):
        return "estagio"
    if re.search(r"(junior|jr\b|jr\.|\bjunior)", normalized):
        return "junior"
    if re.search(r"(pleno|mid-level|mid level|nivel medio|nível médio)", normalized):
        return "pleno"
    if re.search(r"(senior|sr\b|sr\.|\bsenior|especialista|lead\b|tech lead|principal)", normalized):
        return "senior"

    # Inferência por anos de experiência pedidos.
    years_match = re.search(r"(\d+)\s*\+?\s*anos?\s+(?:de\s+)?experi[eê]ncia", normalized)
    if years_match:
        years = int(years_match.group(1))
        if years <= 1:
            return "junior"
        if years <= 3:
            return "pleno"
        return "senior"

    return "nao_informado"


def count_matches(source: list[str], targets: list[str]) -> int:
    return sum(1 for item in targets if item in source)


def detect_focus(text: str, keywords: list[str]) -> str:
    normalized = normalize_text(text)

    frontend_count = count_matches(keywords, FRONTEND)
    backend_count = count_matches(keywords, BACKEND)
    infra_count = count_matches(keywords, INFRA)
    support_count = count_matches(keywords, SUPPORT)

    # Reforço quando o texto cita explicitamente a área.
    frontend_boost = 2 if re.search(r"(front|frontend|front-end|interface|ui|ux|tela|visual|componentes)", normalized) else 0
    backend_boost = 2 if re.search(r"(back|backend|back-end|servidor|api|banco|base de dados)", normalized) else 0
    infra_boost = 2 if re.search(r"(infra|linux|redes|n2|ambiente|servidor|cloud|nuvem)", normalized) else 0
    support_boost = 2 if re.search(r"(suporte|usuario|usuário|helpdesk|help desk|atendimento|manutencao|manutenção|chamados|impressoras)", normalized) else 0

    # Full stack: front e back com contribuição relevante e proporcional.
    if frontend_count + backend_count >= 4 and frontend_count >= 2 and backend_count >= 2:
        if min(frontend_count, backend_count) / max(frontend_count, backend_count) >= 0.4:
            return "fullstack"

    scores = [
        ("frontend", frontend_count + frontend_boost),
        ("backend", backend_count + backend_boost),
        ("infra", infra_count + infra_boost),
        ("suporte_ti", support_count + support_boost),
    ]
    best_name, best_score = sorted(scores, key=lambda item: -item[1])[0]  # sorted é estável
    return "misto" if best_score == 0 else best_name


def profile_search_text(profile: ResumeProfile) -> str:
    parts = [profile.target_title, profile.summary]
    for exp in profile.experiences:
        parts += [exp.role, exp.company, exp.description, *exp.skills]
    for project in profile.projects:
        parts += [project.name, project.description, *project.skills]
    for group in profile.skill_groups:
        parts += [group.title, *group.items]
    for lang in profile.languages:
        parts += [lang.name, lang.level]
    return normalize_text(" ".join(parts))


def _aliases(keyword: str) -> list[str]:
    return TECH_KEYWORDS.get(keyword, [keyword])


def detect_must_have(text: str, keywords: list[str]) -> list[str]:
    normalized = normalize_text(text)
    triggers = "experiencia|conhecimento|dominio|obrigatorio|requisito|esperamos|buscando|imprescindivel|essencial|necessario|precisa ter|deve ter|e necessario|e obrigatorio"
    after = "experiencia|conhecimento|dominio|obrigatorio|requisito|imprescindivel|essencial"
    result = []
    for keyword in keywords:
        for alias in _aliases(keyword):
            safe = re.escape(normalize_text(alias))
            pattern = rf"({triggers})[^.!?]{{0,120}}{safe}|{safe}[^.!?]{{0,120}}({after})"
            if re.search(pattern, normalized, re.I):
                result.append(keyword)
                break
    return result


def detect_nice_to_have(text: str, keywords: list[str], must_have: list[str]) -> list[str]:
    normalized = normalize_text(text)
    triggers = "diferencial|desejavel|desejável|seria otimo|sera otimo|plus|bonus|bônus|agradavel|agradável|bem-vindo|adicional"
    after = "diferencial|desejavel|desejável|seria otimo|sera otimo|plus|bonus"
    result = []
    for keyword in keywords:
        if keyword in must_have:
            continue
        for alias in _aliases(keyword):
            safe = re.escape(normalize_text(alias))
            pattern = rf"({triggers})[^.!?]{{0,120}}{safe}|{safe}[^.!?]{{0,120}}({after})"
            if re.search(pattern, normalized, re.I):
                result.append(keyword)
                break
    return result


def profile_has_keyword(profile_text: str, keyword: str) -> bool:
    return any(normalize_text(alias) in profile_text for alias in _aliases(keyword))


def analyze_job_description(job_description: str, profile: ResumeProfile) -> JobAnalysis:
    keywords = detect_keywords(job_description)
    profile_text = profile_search_text(profile)
    matched = [k for k in keywords if profile_has_keyword(profile_text, k)]
    missing = [k for k in keywords if k not in matched]
    must_have = detect_must_have(job_description, keywords)
    nice_to_have = detect_nice_to_have(job_description, keywords, must_have)
    ats_score = 0 if not keywords else js_round(len(matched) / len(keywords) * 100)
    job_title = detect_job_title(job_description)
    focus = detect_focus(job_description, keywords)
    seniority = detect_seniority(job_description)
    notes: list[str] = []

    if focus == "fullstack":
        notes.append("A descrição mistura requisitos de front-end e back-end; o currículo deve priorizar projetos web completos e integração com APIs.")

    if missing:
        notes.append(f"Não incluir como experiência o que não existe no perfil: {', '.join(missing)}.")

    if re.search(r"front", job_title, re.I) and any(k in keywords for k in ("PHP", "Laravel", "Python", "Django")):
        notes.append("O título parece front-end, mas a descrição contém requisitos fortes de back-end. Tratar como vaga mista.")

    if seniority == "senior" and len(matched) < len(keywords) * 0.5:
        notes.append("Vaga de nível sênior com menos de 50% de aderência de keywords. Avalie se o perfil está pronto para essa senioridade.")

    return JobAnalysis(
        job_title=title_case(job_title),
        company=detect_company(job_description),
        seniority=seniority,
        focus=focus,
        keywords=keywords,
        must_have=must_have,
        nice_to_have=nice_to_have,
        matched_keywords=matched,
        missing_keywords=missing,
        ats_score=ats_score,
        notes=notes,
    )
