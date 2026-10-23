import { JobAnalysis, ResumeProfile } from "../models";
import { compact, normalizeText, splitLines, titleCase, unique } from "../utils/text";

const TECH_KEYWORDS: Record<string, string[]> = {
  // --- Linguagens ---
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

  // --- Frontend ---
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

  // --- Backend ---
  "Node.js": ["node", "nodejs", "node.js"],
  "Express": ["express", "expressjs"],
  "FastAPI": ["fastapi", "fast api"],
  "Django": ["django"],
  "Flask": ["flask"],
  "Rails": ["rails", "ruby on rails"],
  "Spring Boot": ["spring", "spring boot", "springboot"],
  "Laravel": ["laravel"],
  "NestJS": ["nestjs", "nest.js"],

  // --- Banco de Dados ---
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

  // --- API / Integrações ---
  "API REST": ["api", "apis", "rest", "api rest", "apis rest", "restful"],
  "GraphQL": ["graphql", "graph ql"],
  "gRPC": ["grpc"],
  "Stripe": ["stripe", "pagamento", "pagamentos"],
  "WebSocket": ["websocket", "websockets", "socket.io", "socketio"],

  // --- Cloud ---
  "AWS": ["aws", "amazon web services", "ec2", "s3", "lambda"],
  "GCP": ["gcp", "google cloud", "google cloud platform"],
  "Azure": ["azure", "microsoft azure"],
  "Vercel": ["vercel"],
  "Netlify": ["netlify"],

  // --- DevOps / Infra ---
  "Docker": ["docker"],
  "Kubernetes": ["kubernetes", "k8s"],
  "CI/CD": ["ci/cd", "cicd", "integracao continua", "integração contínua", "github actions", "gitlab ci", "jenkins"],
  "Terraform": ["terraform"],
  "Nginx": ["nginx"],
  "Git": ["git", "github", "gitlab"],
  "Linux": ["linux"],
  "Windows": ["windows", "win"],

  // --- Suporte / TI ---
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

  // --- Testes ---
  "Jest": ["jest"],
  "Vitest": ["vitest"],
  "Cypress": ["cypress"],
  "Playwright": ["playwright"],
  "Testes automatizados": ["testes automatizados", "testes unitarios", "testes unitários", "unit test", "unit testing", "tdd", "test driven"],

  // --- Mensageria ---
  "Kafka": ["kafka", "apache kafka"],
  "RabbitMQ": ["rabbitmq", "rabbit mq"],

  // --- Metodologias ---
  "Scrum": ["scrum"],
  "Kanban": ["kanban"],
  "Agile": ["agile", "agil", "ágil", "metodologia agil", "metodologia ágil"],

  // --- IA ---
  "IA": ["inteligencia artificial", "machine learning", "ml", "chatgpt", "claude", "prompt", "ai-assisted", "llm", "openai"],

  // --- Soft Skills e Outros ---
  "Documentação": ["documentar", "documentacao", "documentação", "registrar atendimentos", "acompanhar chamados", "chamados"],
  "Comunicação": ["comunicacao", "comunicação", "boa comunicacao", "boa comunicação"],
  "Organização": ["organizacao", "organização", "organizada", "organizado"],
  "Proatividade": ["proativa", "proativo", "proatividade"],
  "Inglês técnico": ["ingles", "ingles tecnico", "leitura em ingles", "english"],
  "Espanhol": ["espanhol", "spanish"]
};

const FRONTEND = ["JavaScript", "TypeScript", "React", "Vue.js", "Angular", "Svelte", "Next.js", "Nuxt", "Remix", "Astro", "HTML5", "CSS3", "Tailwind CSS", "Sass/SCSS", "Bootstrap", "Redux", "Webpack", "Vite", "Figma", "SEO", "WordPress"];
const BACKEND = ["Node.js", "Express", "Python", "FastAPI", "Django", "Flask", "PHP", "Laravel", "Rails", "Spring Boot", "NestJS", "Java", "Kotlin", "Go", "Rust", "C#", "MySQL", "PostgreSQL", "SQL", "MongoDB", "Redis", "Elasticsearch", "API REST", "GraphQL", "gRPC", "Prisma", "TypeORM", "Sequelize", "Stripe", "Kafka", "RabbitMQ"];
const INFRA = ["Linux", "Windows", "Docker", "Kubernetes", "CI/CD", "Terraform", "Nginx", "AWS", "GCP", "Azure", "Redes", "Active Directory", "Backup", "CFTV", "Firewall"];
const SUPPORT = ["Suporte técnico", "Manutenção de computadores", "Pacote Office", "Impressoras", "ERP", "WMS", "Inventário de TI", "Documentação", "Comunicação", "Organização", "Proatividade", "Windows", "Linux", "Redes"];

const NEGATION_PATTERNS = /\b(nao|não|sem|evite|evitar|dispensavel|dispensável|nenhum|nenhuma|exceto|excluindo|desconsidere)\b.{0,60}$/i;

function hasNegationBefore(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 80), matchIndex);
  return NEGATION_PATTERNS.test(before);
}

function aliasMatchIndex(normalized: string, aliasNorm: string): number {
  const stripped = aliasNorm.replace(/[^a-z0-9]/g, "");
  if (stripped.length < 3) {
    // Aliases curtos (go, ml, ts, c#...): whole-word match para evitar falsos positivos
    const escaped = aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = normalized.match(new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i"));
    return match?.index ?? -1;
  }
  return normalized.indexOf(aliasNorm);
}

function detectKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const found = Object.entries(TECH_KEYWORDS)
    .filter(([, aliases]) =>
      aliases.some((alias) => {
        const aliasNormalized = normalizeText(alias);
        const idx = aliasMatchIndex(normalized, aliasNormalized);
        if (idx === -1) return false;
        return !hasNegationBefore(normalized, idx);
      })
    )
    .map(([label]) => label);

  return unique(found);
}

function detectJobTitle(text: string): string {
  const lines = splitLines(text);
  const firstMeaningfulLine = lines.find((line) => line.length > 3 && line.length < 90);
  return firstMeaningfulLine ? compact(firstMeaningfulLine.replace(/^vaga:?\s*/i, "")) : "Vaga de TI";
}

function detectCompany(text: string): string | undefined {
  const companyPatterns = [
    /na\s+([A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40})\s+(será|sera|buscamos|estamos|como)/i,
    /empresa:?\s*([A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40})/i,
    /cliente:?\s*([A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40})/i,
    /trabalhar(?:emos|á)?\s+(?:com|na|em|para)\s+([A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40})/i,
    /oportunidade\s+(?:na|em|para)\s+([A-ZÁ-Úa-zá-ú0-9][A-ZÁ-Úa-zá-ú0-9 .&-]{2,40})/i
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return compact(match[1]).replace(/[.,;:]$/, "");
  }

  return undefined;
}

function detectSeniority(text: string): JobAnalysis["seniority"] {
  const normalized = normalizeText(text);

  if (/(estagio|estagiario|trainee|aprendiz|programa de capacitacao|entrada de carreira|primeiro emprego)/.test(normalized)) return "estagio";
  if (/(junior|jr\b|jr\.|\bjunior)/.test(normalized)) return "junior";
  if (/(pleno|mid-level|mid level|nivel medio|nível médio)/.test(normalized)) return "pleno";
  if (/(senior|sr\b|sr\.|\bsenior|especialista|lead\b|tech lead|principal)/.test(normalized)) return "senior";

  // Inferência por anos de experiência
  const yearsMatch = normalized.match(/(\d+)\s*\+?\s*anos?\s+(?:de\s+)?experi[eê]ncia/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    if (years <= 1) return "junior";
    if (years <= 3) return "pleno";
    return "senior";
  }

  return "nao_informado";
}

function countMatches(source: string[], targets: string[]) {
  return targets.filter((item) => source.includes(item)).length;
}

function detectFocus(text: string, keywords: string[]): JobAnalysis["focus"] {
  const normalized = normalizeText(text);

  const frontendCount = countMatches(keywords, FRONTEND);
  const backendCount = countMatches(keywords, BACKEND);
  const infraCount = countMatches(keywords, INFRA);
  const supportCount = countMatches(keywords, SUPPORT);

  // Boost baseado em palavras-chave explícitas no texto
  const frontendBoost = (/(front|frontend|front-end|interface|ui|ux|tela|visual|componentes)/.test(normalized) ? 2 : 0);
  const backendBoost = (/(back|backend|back-end|servidor|api|banco|base de dados)/.test(normalized) ? 2 : 0);
  const infraBoost = (/(infra|linux|redes|n2|ambiente|servidor|cloud|nuvem)/.test(normalized) ? 2 : 0);
  const supportBoost = (/(suporte|usuario|usuário|helpdesk|help desk|atendimento|manutencao|manutenção|chamados|impressoras)/.test(normalized) ? 2 : 0);

  const frontendScore = frontendCount + frontendBoost;
  const backendScore = backendCount + backendBoost;
  const infraScore = infraCount + infraBoost;
  const supportScore = supportCount + supportBoost;

  const totalRelevant = frontendCount + backendCount;

  // Fullstack: ambos com contribuição proporcional relevante
  if (totalRelevant >= 4 && frontendCount >= 2 && backendCount >= 2) {
    const ratio = Math.min(frontendCount, backendCount) / Math.max(frontendCount, backendCount);
    if (ratio >= 0.4) return "fullstack";
  }

  const scores = [
    ["frontend", frontendScore],
    ["backend", backendScore],
    ["infra", infraScore],
    ["suporte_ti", supportScore]
  ] as const;

  const sorted = [...scores].sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] === 0) return "misto";
  return sorted[0][0];
}

function profileSearchText(profile: ResumeProfile): string {
  return normalizeText(
    [
      profile.targetTitle,
      profile.summary,
      ...profile.experiences.flatMap((item) => [item.role, item.company, item.description, ...item.skills]),
      ...profile.projects.flatMap((item) => [item.name, item.description, ...item.skills]),
      ...profile.skillGroups.flatMap((item) => [item.title, ...item.items]),
      ...profile.languages.flatMap((item) => [item.name, item.level])
    ].join(" ")
  );
}

function detectMustHave(text: string, keywords: string[]): string[] {
  const normalized = normalizeText(text);
  return keywords.filter((keyword) => {
    const aliases = TECH_KEYWORDS[keyword] || [keyword];
    return aliases.some((alias) => {
      const safeAlias = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(experiencia|conhecimento|dominio|obrigatorio|requisito|esperamos|buscando|imprescindivel|essencial|necessario|precisa ter|deve ter|e necessario|e obrigatorio)[^.!?]{0,120}${safeAlias}|${safeAlias}[^.!?]{0,120}(experiencia|conhecimento|dominio|obrigatorio|requisito|imprescindivel|essencial)`,
        "i"
      );
      return pattern.test(normalized);
    });
  });
}

function detectNiceToHave(text: string, keywords: string[], mustHave: string[]): string[] {
  const normalized = normalizeText(text);
  return keywords.filter((keyword) => {
    if (mustHave.includes(keyword)) return false;
    const aliases = TECH_KEYWORDS[keyword] || [keyword];
    return aliases.some((alias) => {
      const safeAlias = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `(diferencial|desejavel|desejável|seria otimo|sera otimo|plus|bonus|bônus|agradavel|agradável|bem-vindo|adicional)[^.!?]{0,120}${safeAlias}|${safeAlias}[^.!?]{0,120}(diferencial|desejavel|desejável|seria otimo|sera otimo|plus|bonus)`,
        "i"
      );
      return pattern.test(normalized);
    });
  });
}

function profileHasKeyword(profileText: string, keyword: string): boolean {
  const aliases = TECH_KEYWORDS[keyword] || [keyword];
  return aliases.some((alias) => profileText.includes(normalizeText(alias)));
}

export function analyzeJobDescription(jobDescription: string, profile: ResumeProfile): JobAnalysis {
  const keywords = detectKeywords(jobDescription);
  const profileText = profileSearchText(profile);
  const matchedKeywords = keywords.filter((keyword) => profileHasKeyword(profileText, keyword));
  const missingKeywords = keywords.filter((keyword) => !matchedKeywords.includes(keyword));
  const mustHave = detectMustHave(jobDescription, keywords);
  const niceToHave = detectNiceToHave(jobDescription, keywords, mustHave);
  const atsScore = keywords.length === 0 ? 0 : Math.round((matchedKeywords.length / keywords.length) * 100);
  const jobTitle = detectJobTitle(jobDescription);
  const focus = detectFocus(jobDescription, keywords);
  const seniority = detectSeniority(jobDescription);
  const notes: string[] = [];

  if (focus === "fullstack") {
    notes.push("A descrição mistura requisitos de front-end e back-end; o currículo deve priorizar projetos web completos e integração com APIs.");
  }

  if (missingKeywords.length > 0) {
    notes.push(`Não incluir como experiência o que não existe no perfil: ${missingKeywords.join(", ")}.`);
  }

  if (/front/i.test(jobTitle) && (keywords.includes("PHP") || keywords.includes("Laravel") || keywords.includes("Python") || keywords.includes("Django"))) {
    notes.push("O título parece front-end, mas a descrição contém requisitos fortes de back-end. Tratar como vaga mista.");
  }

  if (seniority === "senior" && matchedKeywords.length < keywords.length * 0.5) {
    notes.push("Vaga de nível sênior com menos de 50% de aderência de keywords. Avalie se o perfil está pronto para essa senioridade.");
  }

  return {
    jobTitle: titleCase(jobTitle),
    company: detectCompany(jobDescription),
    seniority,
    focus,
    keywords,
    mustHave,
    niceToHave,
    matchedKeywords,
    missingKeywords,
    atsScore,
    notes
  };
}
