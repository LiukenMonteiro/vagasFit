export type ContactInfo = {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  location?: string;
};

export type Education = {
  degree: string;
  institution: string;
  start?: string;
  end?: string;
  description?: string;
};

export type Experience = {
  role: string;
  company: string;
  start?: string;
  end?: string;
  description: string;
  skills: string[];
};

export type Project = {
  name: string;
  description: string;
  skills: string[];
  url?: string;
};

export type SkillGroup = {
  title: string;
  items: string[];
};

export type Language = {
  name: string;
  level: string;
};

export type ResumeProfile = {
  id: string;
  fullName: string;
  targetTitle: string;
  summary: string;
  contact: ContactInfo;
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
  languages: Language[];
  createdAt: string;
  updatedAt: string;
};

export type JobAnalysis = {
  jobTitle: string;
  company?: string;
  seniority: "junior" | "pleno" | "senior" | "estagio" | "nao_informado";
  focus: "frontend" | "backend" | "fullstack" | "suporte_ti" | "infra" | "misto";
  keywords: string[];
  mustHave: string[];
  niceToHave: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  atsScore: number;
  baselineAtsScore?: number;
  optimizationLift?: number;
  notes: string[];
};

export type TailoredResume = {
  id: string;
  fileName: string;
  profileFingerprint?: string;
  profileFullName?: string;
  profileEmail?: string;
  sourceJobTitle: string;
  company?: string;
  createdAt: string;
  fullName: string;
  headerTitle: string;
  summary: string;
  contact: ContactInfo;
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
  languages: Language[];
  analysis: JobAnalysis;
  changeLog: string[];
  atsWarnings: string[];
};
