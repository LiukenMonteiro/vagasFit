import fs from "node:fs/promises";
import pdfParse from "pdf-parse";
import { Education, Experience, Language, Project, ResumeProfile, SkillGroup } from "../models";
import { compact, normalizeText, splitLines, truncateAtWord, unique } from "../utils/text";

type DateRange = {
  start?: string;
  end?: string;
};

type ParsedSections = {
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
  languages: Language[];
};

const sectionHeadings = [
  "Contact", "Contato", "Informações de Contato", "Dados Pessoais",
  "Education", "Formação", "Formação Acadêmica", "Escolaridade", "Educação",
  "Experience", "Experiência", "Experiência Profissional", "Experiências",
  "Projects", "Projetos", "Portfólio",
  "Skills", "Competências", "Habilidades", "Habilidades Técnicas", "Tecnologias",
  "Languages", "Idiomas",
  "Certifications", "Certificações", "Certificados", "Cursos",
  "Achievements", "Conquistas", "Prêmios",
  "Summary", "Resumo", "Sobre mim", "Objetivo"
];

const skillTerms = [
  // Linguagens
  "JavaScript", "TypeScript", "Python", "PHP", "Java", "Kotlin", "Go", "Rust", "Ruby", "C#", "Swift",
  // Frontend
  "React", "Vue.js", "Angular", "Svelte", "Next.js", "Nuxt", "Remix", "Astro",
  "HTML5", "CSS3", "Tailwind CSS", "Sass", "SCSS", "Bootstrap", "Redux",
  "Webpack", "Vite", "Figma", "SEO", "WordPress",
  // Backend
  "Node.js", "NodeJs", "Express", "FastAPI", "Django", "Flask", "Rails",
  "Spring Boot", "Laravel", "NestJS",
  // Banco de dados
  "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "SQLite",
  "Prisma", "TypeORM", "Sequelize",
  // API / Integrações
  "APIs REST", "API REST", "GraphQL", "gRPC", "WebSocket", "Stripe",
  // Cloud
  "AWS", "GCP", "Azure", "Vercel", "Netlify",
  // DevOps
  "Docker", "Kubernetes", "CI/CD", "Terraform", "Nginx", "Git", "GitHub", "GitLab", "Linux", "Windows",
  // Testes
  "Jest", "Vitest", "Cypress", "Playwright",
  // Mensageria
  "Kafka", "RabbitMQ",
  // Metodologias
  "Scrum", "Kanban", "Agile",
  // IA
  "Claude", "ChatGPT", "Prompt Engineering", "PromptAI", "AI-assisted development", "Uso de IA para debugging",
  // Suporte / TI
  "Suporte remoto", "Atendimento ao cliente",
  "Instalação e configuração de sistemas operacionais", "Manutenção de computadores",
  "Manutenção de computadores (hardware e software)", "Backup e recuperação de dados",
  "Diagnóstico e solução de problemas", "Windows e Linux", "Redes TCP/IP",
  "Crimpagem de cabos de rede", "Configuração de ONT / ONU",
  "Cabeamento estruturado (UTP / RJ45)", "Testes de conectividade (Ping, Speed Test)",
  "Configuração de Wi-Fi",
  // Ferramentas
  "Postman", "Versionamento de código",
  "Deploy de aplicações", "Hospedagem de aplicações web",
  "Configuração de ambientes de desenvolvimento", "Desenvolvimento de sistemas web",
  "Chrome Extension API", "Chrome Extension API (Manifest v3)", "Manifest V3",
  "Web Speech API", "Chrome Storage", "DOM Manipulation",
  "API de pagamento do Stripe", "Deploy e hospedagem web",
  // Soft skills
  "Adaptabilidade", "Gestão de tempo", "Trabalho em equipe", "Foco em resultados",
  "Aprendizado contínuo", "Resolução de problemas", "Proatividade", "Colaboração",
  "Capacidade de aprendizado rápida", "Comunicação clara", "Organização",
  "Pensamento analítico", "Adaptabilidade sob pressão",
  "Comunicação com usuários e clientes", "Resolução de problemas técnicos"
];

const skillAliases = new Map<string, string>([
  ["Javascript", "JavaScript"],
  ["nodeJS", "Node.js"],
  ["NodeJs", "Node.js"],
  ["Github", "GitHub"],
  ["Gitlab", "GitLab"],
  ["ClaudeAI", "Claude"],
  ["PromptAI", "Prompt Engineering"],
  ["Chrome Extension API (Manifest v3)", "Chrome Extension API"],
  ["API de pagamento do Stripe", "Stripe"],
  ["Deploy e hospedagem web", "Deploy de aplicações"],
  ["Vue", "Vue.js"],
  ["Vuejs", "Vue.js"],
  ["Nuxtjs", "Nuxt"],
  ["Nestjs", "NestJS"],
  ["Fastapi", "FastAPI"],
  ["Graphql", "GraphQL"],
  ["Mongodb", "MongoDB"],
  ["Postgresql", "PostgreSQL"],
  ["Typeorm", "TypeORM"]
]);

const skillGroupTitles = [
  "Desenvolvimento Web", "Desenvolvimento Frontend", "Desenvolvimento Backend",
  "Ferramentas de Inteligência Artificial", "Inteligência Artificial",
  "Banco de Dados", "Bancos de Dados",
  "Ferramentas de Desenvolvimento", "Ferramentas",
  "Infraestrutura e Deploy", "Infraestrutura", "Cloud",
  "Sistemas Operacionais", "Suporte Técnico / TI", "Suporte Técnico",
  "Habilidades Técnicas", "Tecnologias", "Hard Skills",
  "SoftSkills", "Soft Skills", "Competências Interpessoais",
  "DevOps", "Testes", "Metodologias"
];

function createEmptyProfile(): ResumeProfile {
  const now = new Date().toISOString();
  return {
    id: "default-profile",
    fullName: "",
    targetTitle: "",
    summary: "",
    contact: {},
    education: [],
    experiences: [],
    projects: [],
    skillGroups: [],
    languages: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizePdfText(value: string): string {
  return value
    .replace(/\u000b/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/E-\s*\n\s*commerce/gi, "E-commerce")
    .replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([a-zà-ÿ])/g, "$1$2")
    .replace(/(\d)-\s*\n\s*(\d)/g, "$1-$2")
    .replace(/\s+—\s+/g, " — ")
    .replace(/Node\.\s*js/gi, "Node.js")
    .replace(/E-\s*commerce/gi, "E-commerce")
    .replace(/Wi-\s*Fi/gi, "Wi-Fi")
    .replace(/TCP\/\s*IP/gi, "TCP/IP")
    .replace(/ONT\s*\/\s*ONU/gi, "ONT / ONU")
    .replace(/UTP\s*\/\s*RJ45/gi, "UTP / RJ45")
    .replace(/Suporte Técnico\s*N2/gi, "Suporte Técnico N2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function getLines(text: string): string[] {
  return splitLines(text).map((line) => compact(line));
}

function isHeading(line: string, headings = sectionHeadings): boolean {
  const normalized = normalizeText(line);
  return headings.some((heading) => normalizeText(heading) === normalized);
}

function sectionLines(lines: string[], starts: string[], ends: string[]): string[] {
  const startIndex = lines.findIndex((line) =>
    starts.some((start) => normalizeText(line) === normalizeText(start))
  );
  if (startIndex === -1) return [];

  const endIndex = lines.findIndex((line, index) =>
    index > startIndex && ends.some((end) => normalizeText(line) === normalizeText(end))
  );
  return lines.slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex);
}

function sectionText(lines: string[], starts: string[], ends: string[]): string {
  return sectionLines(lines, starts, ends).join("\n");
}

function cleanName(value?: string): string {
  return compact(value?.replace(/,\s*\d+$/, "") || "");
}

const MONTHS_PT: Record<string, string> = {
  jan: "Jan", fev: "Fev", mar: "Mar", abr: "Abr", mai: "Mai", jun: "Jun",
  jul: "Jul", ago: "Ago", set: "Set", out: "Out", nov: "Nov", dez: "Dez",
  janeiro: "Jan", fevereiro: "Fev", março: "Mar", abril: "Abr", maio: "Mai",
  junho: "Jun", julho: "Jul", agosto: "Ago", setembro: "Set", outubro: "Out",
  novembro: "Nov", dezembro: "Dez"
};

function normalizeMonthYear(value: string): string {
  const clean = value.trim().toLowerCase();
  // "01/2023" → "Jan 2023"
  const numericMatch = clean.match(/^(\d{1,2})\/(\d{4})$/);
  if (numericMatch) {
    const monthIdx = parseInt(numericMatch[1], 10);
    const shortMonths = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${shortMonths[monthIdx - 1] ?? "Jan"} ${numericMatch[2]}`;
  }
  // "Janeiro 2023" or "jan 2023"
  const wordMatch = clean.match(/^([a-záàâãéêíóôõúç]+)\.?\s+(\d{4})$/);
  if (wordMatch) {
    const month = MONTHS_PT[wordMatch[1]] ?? wordMatch[1];
    return `${month} ${wordMatch[2]}`;
  }
  return value.trim();
}

function parseDateRange(raw: string): DateRange {
  const cleaned = raw.replace(/\s+/g, " ").trim();

  // "Jan 2023 — Dez 2024" or "Janeiro 2023 - Atual"
  const fullMatch = cleaned.match(
    /([A-Za-záàâãéêíóôõúç]{3,}\.?\s+\d{4}|\d{1,2}\/\d{4})\s*[—–\-]\s*([A-Za-záàâãéêíóôõúç]{3,}\.?\s+\d{4}|\d{1,2}\/\d{4}|Present|Atual|Presente|\d{4})/i
  );
  if (fullMatch) {
    return {
      start: normalizeMonthYear(fullMatch[1]),
      end: /present|atual|presente/i.test(fullMatch[2]) ? "Atual" : normalizeMonthYear(fullMatch[2])
    };
  }

  // "2023 - 2024" or "2021 – Atual"
  const yearOnly = cleaned.match(/(\d{4})\s*[—–\-]\s*(\d{4}|Present|Atual|Presente)/i);
  if (yearOnly) {
    return {
      start: yearOnly[1],
      end: /present|atual|presente/i.test(yearOnly[2]) ? "Atual" : yearOnly[2]
    };
  }

  return {};
}

function lineHasDateRange(line: string): boolean {
  return (
    /[A-Za-záàâãéêíóôõúç]{3,}\.?\s+\d{4}\s*[—–\-]\s*(?:[A-Za-záàâãéêíóôõúç]{3,}\.?\s+\d{4}|Present|Atual|Presente|\d{4})/i.test(line) ||
    /\d{1,2}\/\d{4}\s*[—–\-]\s*(?:\d{1,2}\/\d{4}|Present|Atual|Presente|\d{4})/i.test(line) ||
    /\d{4}\s*[—–\-]\s*(?:\d{4}|Present|Atual|Presente)/i.test(line)
  );
}

function canonicalSkill(value: string): string {
  const cleaned = compact(value);
  return skillAliases.get(cleaned) || cleaned;
}

function skillKey(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function extractKnownSkills(raw: string): string[] {
  const rawNorm = normalizeText(raw);
  const strippedKey = skillKey(raw);
  return unique(
    skillTerms
      .map((term) => canonicalSkill(term))
      .filter((term) => {
        const termNorm = normalizeText(term);
        const termKey = skillKey(term);
        if (termNorm.length < 2) return false;
        if (termKey.length >= 3) return strippedKey.includes(termKey);
        // Termos curtos ou com símbolos (C#, Go, IA): whole-word match para evitar falsos positivos
        const escaped = termNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(rawNorm);
      })
  );
}

function extractSkills(raw: string): string[] {
  const normalized = compact(raw);
  if (!normalized) return [];

  const hasListSeparator = /\n|•|;|\s{2,}/.test(normalized);
  const directParts = hasListSeparator
    ? normalized
        .split(/\n|•|;|\s{2,}/)
        .map((item) => canonicalSkill(item))
        .filter((item) => item.length > 1 && item.length < 80)
    : [];

  const matched = extractKnownSkills(normalized);

  return unique([...directParts, ...matched]).filter((item) => item.length > 1).slice(0, 60);
}

function looksLikeSkillLine(line: string): boolean {
  const skills = extractKnownSkills(line);
  return skills.length >= 2 || (skills.length === 1 && line.length < 80 && !/[.!?]/.test(line));
}

function splitDescriptionAndSkills(lines: string[]): { description: string; skills: string[] } {
  const skillStart = lines.findIndex((line, index) => index > 0 && looksLikeSkillLine(line));
  const descriptionLines = skillStart === -1 ? lines : lines.slice(0, skillStart);
  const skillLines = skillStart === -1 ? [] : lines.slice(skillStart);

  return {
    description: truncateAtWord(descriptionLines.join(" "), 900),
    skills: extractSkills(skillLines.join("\n")).slice(0, 14)
  };
}

function splitHeaderAtCompany(line: string): { role: string; company: string } | null {
  const match = line.match(/^(.+?)\s+at\s+(.+)$/i);
  if (!match) return null;

  return {
    role: compact(match[1]).replace(/\bTi\b/g, "TI").replace(/\s*\/\s*/g, " / "),
    company: compact(match[2])
  };
}

function coalesceExperienceLines(lines: string[]): string[] {
  const result: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];

    if (next && !line.includes(" at ") && !looksLikeSkillLine(line) && splitHeaderAtCompany(`${line} ${next}`)) {
      result.push(compact(`${line} ${next}`));
      index += 1;
      continue;
    }

    result.push(line);
  }

  return result;
}

function extractExperiences(lines: string[]): Experience[] {
  const cleanLines = coalesceExperienceLines(lines.filter((line) => !isHeading(line)));
  const headerIndexes = cleanLines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => splitHeaderAtCompany(line) && (lineHasDateRange(cleanLines[index + 1] || "") || lineHasDateRange(line)))
    .map(({ index }) => index);

  return headerIndexes
    .map((startIndex, position): Experience | null => {
      const endIndex = headerIndexes[position + 1] ?? cleanLines.length;
      const block = cleanLines.slice(startIndex, endIndex);
      const header = splitHeaderAtCompany(block[0]);
      if (!header) return null;

      const dateLineIndex = block.findIndex((line) => lineHasDateRange(line));
      const dates = parseDateRange(dateLineIndex >= 0 ? block[dateLineIndex] : "");
      const bodyLines = block.filter((_, index) => index !== 0 && index !== dateLineIndex);
      const { description, skills } = splitDescriptionAndSkills(bodyLines);

      if (!description) return null;
      return {
        role: header.role,
        company: header.company,
        start: dates.start,
        end: dates.end,
        description,
        skills
      };
    })
    .filter((experience): experience is Experience => Boolean(experience));
}

function extractEducation(lines: string[]): Education[] {
  if (lines.length === 0) return [];

  const firstLine = lines.find((line) => !lineHasDateRange(line));
  const dateLine = lines.find((line) => lineHasDateRange(line));
  if (!firstLine) return [];

  const header = firstLine.match(/^(?:Associate Degree in\s+)?(.+?)(?:\.?\s+at\s+(.+))$/i);
  const degree = compact(header?.[1] || firstLine.replace(/^Associate Degree in\s+/i, "")).replace(/\.$/, "");
  const institution = compact(header?.[2] || lines.find((line) => /^at\s+/i.test(line))?.replace(/^at\s+/i, "") || "");
  const dates = parseDateRange(dateLine || "");
  const description = compact(lines.filter((line) => line !== firstLine && line !== dateLine && !/^at\s+/i.test(line)).join(" ")).slice(0, 500);

  if (!degree && !institution) return [];

  return [{
    degree: degree || "Formação informada no currículo",
    institution: institution || "Instituição não identificada",
    start: dates.start,
    end: dates.end,
    description
  }];
}

function looksLikeProjectTitle(line: string, previousLine?: string): boolean {
  if (!line || lineHasDateRange(line) || looksLikeSkillLine(line) || /[.!?]$/.test(line)) return false;
  if (line.length > 95) return false;
  if (/^(o|a|os|as|projeto|sistema|solução)\b/i.test(line)) return false;
  if (previousLine && !looksLikeSkillLine(previousLine) && !/[.!?]$/.test(previousLine)) return false;
  return /^[A-ZÁ-Ú0-9]/.test(line);
}

function extractProjects(lines: string[]): Project[] {
  const titleIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => looksLikeProjectTitle(line, lines[index - 1]))
    .map(({ index }) => index);

  return titleIndexes
    .map((startIndex, position) => {
      const endIndex = titleIndexes[position + 1] ?? lines.length;
      const block = lines.slice(startIndex, endIndex);
      const name = block[0];
      const { description, skills } = splitDescriptionAndSkills(block.slice(1));

      if (!name || !description) return null;
      return {
        name,
        description,
        skills
      };
    })
    .filter((project): project is Project => Boolean(project));
}

function isSkillGroupTitle(line: string): boolean {
  return skillGroupTitles.some((title) => normalizeText(title) === normalizeText(line));
}

function extractSkillGroups(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  let currentTitle = "";
  let currentItems: string[] = [];

  function flush() {
    if (currentTitle && currentItems.length > 0) {
      groups.push({
        title: currentTitle === "SoftSkills" ? "Soft Skills" : currentTitle,
        items: unique(currentItems)
      });
    }
    currentItems = [];
  }

  for (const line of lines) {
    if (isSkillGroupTitle(line)) {
      flush();
      currentTitle = line;
      continue;
    }

    if (currentTitle) {
      currentItems.push(...extractSkills(line));
    }
  }

  flush();
  return groups;
}

function extractLanguages(raw: string): Language[] {
  const result: Language[] = [];

  const langPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /ingl[eê]s|english/i, name: "Inglês" },
    { pattern: /espanhol|spanish|castellano/i, name: "Espanhol" },
    { pattern: /franc[eê]s|french|français/i, name: "Francês" },
    { pattern: /portugu[eê]s|portuguese/i, name: "Português" },
    { pattern: /alem[aã]o|german|deutsch/i, name: "Alemão" },
    { pattern: /italiano|italian/i, name: "Italiano" }
  ];

  const levelPatterns: Array<{ pattern: RegExp; level: string }> = [
    { pattern: /nativo|native|fluente|fluent|avan[cç]ado/i, level: "Avançado / Fluente" },
    { pattern: /intermediate|intermedi[aá]rio/i, level: "Intermediário" },
    { pattern: /b[aá]sico|basic|elementar|iniciante|a1|a2/i, level: "Básico" },
    { pattern: /b1|b2/i, level: "Intermediário" },
    { pattern: /c1|c2/i, level: "Avançado / Fluente" }
  ];

  for (const lang of langPatterns) {
    if (!lang.pattern.test(raw)) continue;

    // Encontra o nível mais próximo ao nome do idioma
    const matchedLevel = levelPatterns.find((l) => l.pattern.test(raw))?.level ?? "Informado no currículo";
    result.push({ name: lang.name, level: matchedLevel });
  }

  return result;
}

function detectTitle(lines: string[], name: string): string {
  const ignored = new Set([normalizeText(name)]);
  const title = lines.find((line) => {
    const normalized = normalizeText(line);
    return line.length > 3 && line.length < 80 && !ignored.has(normalized) && !isHeading(line) && !/@|\d{4}/.test(line);
  });

  return title || "";
}

function detectSummary(lines: string[], title: string): string {
  const contactIndex = lines.findIndex((line) => /^contact$|^contato$|^informa[cç][oõ]es de contato$|^dados pessoais$/i.test(line));
  const titleIndex = lines.findIndex((line) => line === title);
  if (contactIndex === -1) return "";

  const startIndex = titleIndex >= 0 ? titleIndex + 1 : 1;
  return compact(lines.slice(startIndex, contactIndex).join(" ")).slice(0, 900);
}

function extractContact(text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.replace(/^Email/i, "");
  const phoneFromLabel = text.match(/Phone\s*([+\d][\d\s()–-]{8,20})/i)?.[1];
  const phoneCandidate = compact(phoneFromLabel || text.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4,5}\s*[-–]?\s*\d{4,5}/)?.[0] || "");
  const phone = phoneCandidate || undefined;
  const linkedinUrl = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Z0-9_.-]+\/?/i)?.[0]?.replace(/^https?:\/\//i, "");
  const linkedinLabel = text.match(/LinkedIn\s*([A-Z0-9_.-]{3,})/i)?.[1];
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Z0-9_.-]+\/?/i)?.[0]?.replace(/^https?:\/\//i, "");
  const portfolio = text.match(/(?:https?:\/\/)?(?:www\.)?(?!linkedin|github)[A-Z0-9_.-]+\.[A-Z]{2,}\/[A-Z0-9_.-]*/i)?.[0];

  return {
    email,
    phone,
    linkedin: linkedinUrl || linkedinLabel,
    github,
    portfolio
  };
}

function mergeProfile(parsed: ResumeProfile, existing?: ResumeProfile): ResumeProfile {
  if (!existing) return parsed;

  return {
    ...existing,
    fullName: parsed.fullName || existing.fullName,
    targetTitle: parsed.targetTitle || existing.targetTitle,
    summary: parsed.summary || existing.summary,
    contact: {
      ...existing.contact,
      ...Object.fromEntries(Object.entries(parsed.contact).filter(([, value]) => Boolean(value)))
    },
    education: parsed.education.length > 0 ? parsed.education : existing.education,
    experiences: parsed.experiences.length > 0 ? parsed.experiences : existing.experiences,
    projects: parsed.projects.length > 0 ? parsed.projects : existing.projects,
    skillGroups: parsed.skillGroups.length > 0 ? parsed.skillGroups : existing.skillGroups,
    languages: parsed.languages.length > 0 ? parsed.languages : existing.languages,
    createdAt: existing.createdAt,
    updatedAt: parsed.updatedAt
  };
}

function addSectionWarnings(warnings: string[], parsed: ParsedSections, existing?: ResumeProfile) {
  const sections = [
    { label: "formação", parsedCount: parsed.education.length, existingCount: existing?.education.length || 0 },
    { label: "experiências", parsedCount: parsed.experiences.length, existingCount: existing?.experiences.length || 0 },
    { label: "projetos", parsedCount: parsed.projects.length, existingCount: existing?.projects.length || 0 },
    { label: "grupos de skills", parsedCount: parsed.skillGroups.length, existingCount: existing?.skillGroups.length || 0 },
    { label: "idiomas", parsedCount: parsed.languages.length, existingCount: existing?.languages.length || 0 }
  ];

  for (const section of sections) {
    if (section.parsedCount > 0) {
      warnings.push(`Importei ${section.parsedCount} item(ns) de ${section.label} do PDF.`);
    } else if (section.existingCount > 0) {
      warnings.push(`Não consegui separar ${section.label} no PDF; preservei os dados existentes.`);
    } else {
      warnings.push(`Não consegui identificar ${section.label} no PDF. Revise o perfil antes de gerar currículos.`);
    }
  }
}

const EXPERIENCE_SECTIONS = ["Experience", "Experiência", "Experiência Profissional", "Experiências"];
const PROJECT_SECTIONS = ["Projects", "Projetos", "Portfólio"];
const SKILL_SECTIONS = ["Skills", "Competências", "Habilidades", "Habilidades Técnicas", "Tecnologias"];
const EDUCATION_SECTIONS = ["Education", "Formação", "Formação Acadêmica", "Escolaridade", "Educação"];
const LANGUAGE_SECTIONS = ["Languages", "Idiomas"];
const CONTACT_SECTIONS = ["Contact", "Contato", "Informações de Contato", "Dados Pessoais"];

export async function parseProfileFromPdf(filePath: string, existingProfile?: ResumeProfile): Promise<{ profile: ResumeProfile; rawText: string; warnings: string[] }> {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  const rawText = parsed.text;
  const normalizedText = normalizePdfText(rawText);
  const lines = getLines(normalizedText);
  const warnings: string[] = [];

  const emptyProfile = createEmptyProfile();
  const nameCandidate = cleanName(lines.find((line) => !isHeading(line)));
  const titleCandidate = detectTitle(lines.slice(1, 12), nameCandidate);
  const summaryCandidate = detectSummary(lines, titleCandidate);
  const contact = extractContact(normalizedText);

  const education = extractEducation(sectionLines(lines, EDUCATION_SECTIONS, [...EXPERIENCE_SECTIONS, ...PROJECT_SECTIONS, ...SKILL_SECTIONS]));
  const experiences = extractExperiences(sectionLines(lines, EXPERIENCE_SECTIONS, [...PROJECT_SECTIONS, ...SKILL_SECTIONS, ...LANGUAGE_SECTIONS]));
  const projects = extractProjects(sectionLines(lines, PROJECT_SECTIONS, [...SKILL_SECTIONS, ...LANGUAGE_SECTIONS, ...CONTACT_SECTIONS]));
  const skillGroups = extractSkillGroups(sectionLines(lines, SKILL_SECTIONS, [...LANGUAGE_SECTIONS, ...CONTACT_SECTIONS]));
  const languages = extractLanguages(sectionText(lines, LANGUAGE_SECTIONS, []));

  if (!nameCandidate) warnings.push("Não consegui identificar o nome no PDF. Revise o perfil antes de gerar currículos.");
  if (!contact.email) warnings.push("Não consegui identificar e-mail no PDF. Revise o perfil antes de gerar currículos.");
  if (!summaryCandidate) warnings.push("Não consegui identificar um resumo claro no PDF. Complete o resumo manualmente.");

  addSectionWarnings(warnings, { education, experiences, projects, skillGroups, languages }, existingProfile);

  const parsedProfile: ResumeProfile = {
    ...emptyProfile,
    id: existingProfile?.id || "default-profile",
    fullName: nameCandidate,
    targetTitle: titleCandidate,
    summary: summaryCandidate,
    contact,
    education,
    experiences,
    projects,
    skillGroups,
    languages,
    createdAt: existingProfile?.createdAt || emptyProfile.createdAt,
    updatedAt: new Date().toISOString()
  };

  return { profile: mergeProfile(parsedProfile, existingProfile), rawText, warnings };
}
