import crypto from "node:crypto";
import { Experience, JobAnalysis, Project, ResumeProfile, SkillGroup, TailoredResume } from "../models";
import { analyzeJobDescription } from "./jobAnalyzer";
import { compact, normalizeText, truncateAtWord, unique } from "../utils/text";
import { slugify } from "../utils/slug";

function overlapScore(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    const occurrences = normalizedKeyword ? normalized.split(normalizedKeyword).length - 1 : 0;
    return score + Math.min(occurrences, 3) * 2;
  }, 0);
}

function textHasKeyword(text: string, keyword: string): boolean {
  return normalizeText(text).includes(normalizeText(keyword));
}

function countKeywordOccurrences(text: string, keyword: string): number {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return 0;
  return normalizedText.split(normalizedKeyword).length - 1;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => compact(sentence))
    .filter(Boolean);
}

function rankedSentences(description: string, analysis: JobAnalysis): string[] {
  const sentences = splitSentences(description);
  if (sentences.length <= 1) return sentences;

  return sentences.sort((a, b) => {
    const scoreA = overlapScore(a, analysis.matchedKeywords);
    const scoreB = overlapScore(b, analysis.matchedKeywords);
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Mantém ordem original como critério de desempate (estabilidade)
    return sentences.indexOf(a) - sentences.indexOf(b);
  });
}

function relevantKeywordsForItem(text: string, analysis: JobAnalysis, limit = 5): string[] {
  return analysis.matchedKeywords
    .filter((keyword) => textHasKeyword(text, keyword))
    .slice(0, limit);
}

function seniorityLabel(seniority: JobAnalysis["seniority"]): string {
  const labels: Record<string, string> = {
    estagio: "estagiário(a)",
    junior: "Júnior",
    pleno: "Pleno",
    senior: "Sênior",
    nao_informado: ""
  };
  return labels[seniority] || "";
}

function focusPhrase(analysis: JobAnalysis, keywords: string[]): string {
  const topTechs = keywords.slice(0, 3);
  const techText = topTechs.length ? ` com ${topTechs.join(", ")}` : "";
  const level = seniorityLabel(analysis.seniority);
  const isSenior = analysis.seniority === "senior";
  const isJunior = analysis.seniority === "junior" || analysis.seniority === "estagio";

  if (analysis.focus === "frontend") {
    if (isSenior) return `Atuação${techText} em arquitetura de interfaces, performance, acessibilidade e entrega de experiências web de alto padrão.`;
    if (isJunior) return `Desenvolvimento de interfaces responsivas e acessíveis${techText}, com foco em boas práticas e evolução técnica contínua.`;
    return `Criação de interfaces responsivas e experiências web${techText}, com atenção a UX, SEO e integração com APIs.`;
  }

  if (analysis.focus === "backend") {
    if (isSenior) return `Arquitetura e desenvolvimento de APIs, microsserviços e sistemas escaláveis${techText}, com foco em segurança, performance e qualidade.`;
    if (isJunior) return `Desenvolvimento de APIs e integrações backend${techText}, com foco em aprendizado e crescimento técnico.`;
    return `Desenvolvimento de APIs, integrações e soluções backend${techText}, com foco em robustez e manutenibilidade.`;
  }

  if (analysis.focus === "fullstack") {
    if (isSenior) return `Desenvolvimento ponta a ponta — interfaces, APIs, banco de dados e deploy — com liderança técnica${techText}.`;
    return `Desenvolvimento full stack${techText}: interfaces responsivas, APIs e banco de dados, com visão de produto e entrega em produção.`;
  }

  if (analysis.focus === "suporte_ti") {
    if (isSenior) return `Gestão e resolução de incidentes técnicos, liderança de equipe de suporte e melhoria de processos de TI${techText}.`;
    return `Suporte técnico a usuários, diagnóstico de problemas e manutenção de ambientes${techText} com foco em agilidade e satisfação.`;
  }

  if (analysis.focus === "infra") {
    if (isSenior) return `Arquitetura de infraestrutura, segurança e confiabilidade de ambientes${techText}.`;
    return `Administração de infraestrutura, redes e ambientes${techText}, com foco em estabilidade e desempenho.`;
  }

  return `Experiência alinhada aos requisitos reais da vaga${techText}.`;
}

function adaptedDescription(original: string, itemText: string, analysis: JobAnalysis, maxLength: number): string {
  const keywords = relevantKeywordsForItem(itemText, analysis);
  const sentences = rankedSentences(original, analysis);
  const reordered = sentences.length ? sentences.join(" ") : original;

  if (keywords.length === 0) return truncateAtWord(reordered, maxLength);

  const candidate = `${focusPhrase(analysis, keywords)} ${reordered}`;
  return truncateAtWord(candidate, maxLength);
}

function profileFingerprint(profile: ResumeProfile): string {
  return normalizeText([profile.fullName, profile.contact.email, profile.contact.phone].filter(Boolean).join("|"));
}

function rankExperiences(experiences: Experience[], analysis: JobAnalysis): Experience[] {
  const focusBoost: Record<string, string[]> = {
    frontend: ["frontend", "front-end", "interface", "react", "vue", "angular", "html", "css", "javascript", "typescript"],
    backend: ["backend", "back-end", "node", "python", "api", "banco", "sql", "mysql", "postgres", "django", "fastapi"],
    fullstack: ["desenvolvimento", "fullstack", "full stack", "apis", "web", "react", "node", "sql"],
    suporte_ti: ["suporte", "usuario", "windows", "linux", "manutencao", "helpdesk"],
    infra: ["linux", "windows", "redes", "infra", "docker", "kubernetes", "aws", "cloud"],
    misto: []
  };

  return [...experiences].sort((a, b) => {
    const textA = [a.role, a.company, a.description, ...a.skills].join(" ");
    const textB = [b.role, b.company, b.description, ...b.skills].join(" ");
    const scoreA = overlapScore(textA, analysis.keywords) + overlapScore(textA, focusBoost[analysis.focus] || []);
    const scoreB = overlapScore(textB, analysis.keywords) + overlapScore(textB, focusBoost[analysis.focus] || []);
    return scoreB - scoreA;
  });
}

function rankProjects(projects: Project[], analysis: JobAnalysis): Project[] {
  return [...projects].sort((a, b) => {
    const textA = [a.name, a.description, ...a.skills].join(" ");
    const textB = [b.name, b.description, ...b.skills].join(" ");
    return overlapScore(textB, analysis.keywords) - overlapScore(textA, analysis.keywords);
  });
}

function selectProjects(projects: Project[], analysis: JobAnalysis): Project[] {
  if (projects.length === 0) return [];

  const scored = projects.map((project) => {
    const text = [project.name, project.description, ...project.skills].join(" ");
    return { project, score: overlapScore(text, analysis.keywords) };
  });

  const maxScore = Math.max(...scored.map((p) => p.score));
  const threshold = maxScore > 0 ? maxScore * 0.25 : 0;

  // Inclui projetos com score relevante ou os top-3 mínimos
  const relevant = scored.filter((p) => p.score >= threshold).map((p) => p.project);
  const remaining = scored.filter((p) => p.score < threshold).map((p) => p.project);

  const selected = [...relevant, ...remaining].slice(0, 5);
  return selected.length > 0 ? selected : projects.slice(0, 3);
}

function buildHeaderTitle(profile: ResumeProfile, analysis: JobAnalysis): string {
  if (analysis.matchedKeywords.length === 0) return profile.targetTitle;

  const title = normalizeText(analysis.jobTitle);
  const level = analysis.seniority !== "nao_informado" ? ` ${seniorityLabel(analysis.seniority)}` : "";

  if (title.includes("front")) return `Desenvolvedor Front-end${level}`;
  if (title.includes("back")) return `Desenvolvedor Back-end${level}`;
  if (title.includes("full")) return `Desenvolvedor Full Stack${level}`;
  if (title.includes("react")) return `Desenvolvedor React${level}`;
  if (title.includes("node")) return `Desenvolvedor Node.js${level}`;
  if (title.includes("python")) return `Desenvolvedor Python${level}`;
  if (title.includes("java") && !title.includes("javascript")) return `Desenvolvedor Java${level}`;
  if (title.includes("mobile") || title.includes("android") || title.includes("ios")) return `Desenvolvedor Mobile${level}`;
  if (title.includes("dados") || title.includes("data")) return `Engenheiro de Dados${level}`;
  if (analysis.focus === "suporte_ti") return `Técnico de Suporte / TI${level}`;
  if (analysis.focus === "infra") return `Técnico em Infraestrutura / TI${level}`;
  if (analysis.focus === "backend") return `Desenvolvedor Back-end${level}`;
  if (analysis.focus === "frontend") return `Desenvolvedor Front-end${level}`;
  if (analysis.focus === "fullstack") return `Desenvolvedor Full Stack${level}`;

  return profile.targetTitle;
}

function extractYearsFromExperiences(profile: ResumeProfile): number {
  const years = profile.experiences.reduce((total, exp) => {
    const startYear = exp.start?.match(/\d{4}/)?.[0];
    const endYear = exp.end?.match(/\d{4}/)
      ? exp.end.match(/\d{4}/)?.[0]
      : String(new Date().getFullYear());

    if (!startYear || !endYear) return total;
    return total + (parseInt(endYear, 10) - parseInt(startYear, 10));
  }, 0);
  return Math.max(0, years);
}

function buildSummary(profile: ResumeProfile, analysis: JobAnalysis): string {
  const matched = analysis.matchedKeywords.slice(0, 6);
  if (matched.length === 0) return profile.summary;

  const skillText = matched.join(", ");
  const yearsTotal = extractYearsFromExperiences(profile);
  const yearsText = yearsTotal >= 1 ? `${yearsTotal}+ anos de experiência` : "experiência";
  const level = seniorityLabel(analysis.seniority);
  const levelText = level ? ` ${level}` : "";

  const originalSummary = profile.summary?.trim();
  const hasGoodOriginal = originalSummary && originalSummary.length > 100;

  if (analysis.focus === "frontend") {
    if (hasGoodOriginal) {
      return truncateAtWord(`${originalSummary} Habilidades destacadas para a vaga: ${skillText}.`, 700);
    }
    return `Desenvolvedor Front-end${levelText} com ${yearsText} em criação de interfaces responsivas e aplicações web utilizando ${skillText}. Foco em UX, performance e integração com APIs.`;
  }

  if (analysis.focus === "backend") {
    if (hasGoodOriginal) {
      return truncateAtWord(`${originalSummary} Habilidades destacadas para a vaga: ${skillText}.`, 700);
    }
    return `Desenvolvedor Back-end${levelText} com ${yearsText} em construção de APIs, integrações e sistemas utilizando ${skillText}. Foco em robustez, organização e resolução de problemas.`;
  }

  if (analysis.focus === "fullstack") {
    if (hasGoodOriginal) {
      return truncateAtWord(`${originalSummary} Habilidades destacadas para a vaga: ${skillText}.`, 700);
    }
    return `Desenvolvedor Full Stack${levelText} com ${yearsText} em soluções completas — interfaces, APIs e banco de dados — utilizando ${skillText}. Projetos entregues em produção com foco em qualidade e resultado.`;
  }

  if (analysis.focus === "suporte_ti" || analysis.focus === "infra") {
    return `Profissional de TI${levelText} com ${yearsText} em suporte técnico, manutenção de sistemas e ambientes ${skillText}. Foco em atendimento ágil e resolução definitiva de problemas.`;
  }

  return profile.summary;
}

function priorityForGroup(title: string, analysis: JobAnalysis): number {
  const normalized = normalizeText(title);
  const focus = analysis.focus;

  if (focus === "frontend" && (normalized.includes("desenvolvimento") || normalized.includes("frontend"))) return 1;
  if (focus === "backend" && (normalized.includes("banco") || normalized.includes("backend") || normalized.includes("api"))) return 1;
  if (focus === "fullstack" && normalized.includes("desenvolvimento")) return 1;
  if (focus === "suporte_ti" && normalized.includes("suporte")) return 1;
  if (focus === "infra" && (normalized.includes("infra") || normalized.includes("sistemas"))) return 1;
  if (normalized.includes("soft")) return 9;
  return 5;
}

function tailorSkillGroups(skillGroups: SkillGroup[], analysis: JobAnalysis): SkillGroup[] {
  const groups = skillGroups.map((group) => {
    const matchedItems = group.items.filter((item) => analysis.matchedKeywords.some((keyword) => normalizeText(item).includes(normalizeText(keyword))));
    const remainingItems = group.items.filter((item) => !matchedItems.includes(item));

    return {
      ...group,
      items: unique([...matchedItems, ...remainingItems])
    };
  });

  const skillItems = new Set(skillGroups.flatMap((group) => group.items.map(normalizeText)));
  const alignedKeywords = analysis.matchedKeywords
    .filter((keyword) => skillItems.has(normalizeText(keyword)))
    .slice(0, 10);
  const alignedGroup: SkillGroup[] = alignedKeywords.length
    ? [{ title: "Aderência à vaga", items: alignedKeywords }]
    : [];

  return [...alignedGroup, ...groups.sort((a, b) => priorityForGroup(a.title, analysis) - priorityForGroup(b.title, analysis))];
}

function emphasizeDescriptions(items: Experience[], analysis: JobAnalysis): Experience[] {
  return items.map((item) => {
    const itemText = [item.role, item.company, item.description, ...item.skills].join(" ");
    const skills = unique([
      ...item.skills.filter((skill) => analysis.matchedKeywords.some((keyword) => normalizeText(skill).includes(normalizeText(keyword)))),
      ...item.skills
    ]).slice(0, 10);

    return {
      ...item,
      description: adaptedDescription(item.description, itemText, analysis, 800),
      skills
    };
  });
}

function emphasizeProjects(projects: Project[], analysis: JobAnalysis): Project[] {
  return projects.map((project) => {
    const projectText = [project.name, project.description, ...project.skills].join(" ");

    return {
      ...project,
      description: adaptedDescription(project.description, projectText, analysis, 800),
      skills: unique([
        ...project.skills.filter((skill) => analysis.matchedKeywords.some((keyword) => textHasKeyword(skill, keyword))),
        ...project.skills
      ]).slice(0, 10)
    };
  });
}

function optimizedAtsScore(params: {
  analysis: JobAnalysis;
  headerTitle: string;
  summary: string;
  experiences: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
}): number {
  const { analysis, headerTitle, summary, experiences, projects, skillGroups } = params;
  if (analysis.keywords.length === 0) return 0;

  const headerSummaryText = [headerTitle, summary].join(" ");
  const experienceText = experiences.flatMap((item) => [item.role, item.company, item.description, ...item.skills]).join(" ");
  const projectText = projects.flatMap((item) => [item.name, item.description, ...item.skills]).join(" ");
  const skillsText = skillGroups.flatMap((item) => [item.title, ...item.items]).join(" ");
  const fullText = [headerSummaryText, experienceText, projectText, skillsText].join(" ");

  const truthScore = (analysis.matchedKeywords.length / analysis.keywords.length) * 70;
  const presentationScore = analysis.matchedKeywords.length === 0
    ? 0
    : analysis.matchedKeywords.reduce((total, keyword) => {
      let visibility = 0;
      if (textHasKeyword(headerSummaryText, keyword)) visibility += 0.35;
      if (textHasKeyword(skillsText, keyword)) visibility += 0.25;
      if (textHasKeyword(experienceText, keyword)) visibility += 0.25;
      if (textHasKeyword(projectText, keyword)) visibility += 0.1;
      if (countKeywordOccurrences(fullText, keyword) >= 3) visibility += 0.05;
      return total + Math.min(1, visibility);
    }, 0) / analysis.matchedKeywords.length * 30;

  const matchedMustHave = analysis.mustHave.filter((keyword) => analysis.matchedKeywords.includes(keyword)).length;
  const mustHaveBoost = analysis.mustHave.length === 0 ? 0 : Math.round((matchedMustHave / analysis.mustHave.length) * 8);

  // Penalização realista: score não pode ser mais de 15pts acima do ats bruto quando match é baixo
  const rawAts = analysis.atsScore;
  const computed = Math.min(98, Math.round(truthScore + presentationScore + mustHaveBoost));
  const maxAllowed = rawAts + 15;

  return Math.max(rawAts, Math.min(computed, maxAllowed));
}

function buildAtsWarnings(analysis: JobAnalysis): string[] {
  const warnings: string[] = [];
  if (analysis.missingKeywords.length) {
    warnings.push(`Lacunas detectadas na vaga e não afirmadas no currículo: ${analysis.missingKeywords.join(", ")}.`);
  }
  if (analysis.atsScore < 50) {
    warnings.push("A compatibilidade inicial está abaixo de 50%. Recomenda-se candidatura apenas se a vaga aceitar aprendizado ou requisitos flexíveis.");
  }
  if (analysis.seniority === "senior" && analysis.atsScore < 65) {
    warnings.push("Vaga sênior com aderência abaixo de 65%. Considere fortalecer as experiências listadas no perfil antes de candidatar.");
  }
  warnings.push("PDF gerado em layout simples, sem foto, sem ícones obrigatórios e com texto selecionável para favorecer leitura por ATS.");
  return warnings;
}

function buildChangeLog(analysis: JobAnalysis): string[] {
  const log = analysis.matchedKeywords.length === 0
    ? [
        "Nenhuma palavra-chave real do perfil foi encontrada para adaptação segura.",
        "Resumo e título do perfil foram preservados para evitar afirmar experiência inexistente.",
        "Termos da vaga que não existem no currículo mestre foram tratados como lacunas."
      ]
    : [
        `Resumo profissional adaptado para foco em ${analysis.focus.replace("_", " ")} (nível: ${analysis.seniority}).`,
        `Skills com maior aderência movidas para o começo: ${analysis.matchedKeywords.slice(0, 6).join(", ")}.`,
        "Todos os grupos de competências do currículo mestre foram preservados, incluindo Soft Skills.",
        "Descrições de experiências e projetos reorganizadas para evidenciar requisitos reais da vaga.",
        "Projetos selecionados por relevância para a vaga (máximo 5, mínimo 1).",
        "Termos não existentes no currículo mestre foram tratados como lacunas, não como experiência."
      ];

  if (analysis.baselineAtsScore !== undefined && analysis.optimizationLift !== undefined && analysis.optimizationLift > 0) {
    log.unshift(`Aderência estimada evoluiu de ${analysis.baselineAtsScore}% para ${analysis.atsScore}% após a transformação.`);
  }

  if (analysis.notes.length > 0) log.push(...analysis.notes);
  return log;
}

export function generateTailoredResume(profile: ResumeProfile, jobDescription: string): TailoredResume {
  const analysis = analyzeJobDescription(jobDescription, profile);
  const id = crypto.randomUUID();
  const headerTitle = buildHeaderTitle(profile, analysis);
  const rankedExps = rankExperiences(profile.experiences, analysis);
  const rankedExperiences = emphasizeDescriptions(rankedExps, analysis);
  const rankedRawProjects = rankProjects(profile.projects, analysis);
  const selectedProjects = selectProjects(rankedRawProjects, analysis);
  const rankedProjects = emphasizeProjects(selectedProjects, analysis);
  const skillGroups = tailorSkillGroups(profile.skillGroups, analysis);
  const summary = buildSummary(profile, analysis);
  const optimizedScore = optimizedAtsScore({
    analysis,
    headerTitle,
    summary,
    experiences: rankedExperiences,
    projects: rankedProjects,
    skillGroups
  });
  const optimizedAnalysis: JobAnalysis = {
    ...analysis,
    baselineAtsScore: analysis.atsScore,
    optimizationLift: Math.max(0, optimizedScore - analysis.atsScore),
    atsScore: optimizedScore
  };
  const baseName = `curriculo-${slugify(profile.fullName)}-${slugify(analysis.jobTitle)}${analysis.company ? `-${slugify(analysis.company)}` : ""}.pdf`;

  return {
    id,
    fileName: baseName,
    profileFingerprint: profileFingerprint(profile),
    profileFullName: profile.fullName,
    profileEmail: profile.contact.email,
    sourceJobTitle: analysis.jobTitle,
    company: analysis.company,
    createdAt: new Date().toISOString(),
    fullName: profile.fullName,
    headerTitle,
    summary,
    contact: profile.contact,
    education: profile.education,
    experiences: rankedExperiences,
    projects: rankedProjects,
    skillGroups,
    languages: profile.languages,
    analysis: optimizedAnalysis,
    changeLog: buildChangeLog(optimizedAnalysis),
    atsWarnings: buildAtsWarnings(optimizedAnalysis)
  };
}
