import fs from "node:fs/promises";
import path from "node:path";
import { ResumeProfile, TailoredResume } from "./models";
import { profileSeed } from "./data/profileSeed";

const dataRoot = path.resolve(__dirname, "../data");
const resumesDir = path.join(dataRoot, "resumes");
const profilePath = path.join(dataRoot, "profile.json");

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

function normalizeProfile(profile: ResumeProfile): ResumeProfile {
  return {
    ...profile,
    contact: {
      ...profile.contact,
      email: cleanEmail(profile.contact.email) || profile.contact.email,
      phone: cleanContactLabel(profile.contact.phone),
      linkedin: cleanContactLabel(profile.contact.linkedin),
      github: cleanContactLabel(profile.contact.github),
      portfolio: cleanContactLabel(profile.contact.portfolio),
      location: cleanContactLabel(profile.contact.location)
    }
  };
}

async function ensureDataDirs() {
  await fs.mkdir(dataRoot, { recursive: true });
  await fs.mkdir(resumesDir, { recursive: true });
}

export async function getProfile(): Promise<ResumeProfile> {
  await ensureDataDirs();

  try {
    const raw = await fs.readFile(profilePath, "utf8");
    const profile = JSON.parse(raw) as ResumeProfile;
    const normalized = normalizeProfile(profile);
    if (JSON.stringify(profile.contact) !== JSON.stringify(normalized.contact)) {
      await saveProfile(normalized);
    }
    return normalized;
  } catch {
    await saveProfile(profileSeed);
    return profileSeed;
  }
}

export async function saveProfile(profile: ResumeProfile): Promise<ResumeProfile> {
  await ensureDataDirs();
  const now = new Date().toISOString();
  const normalized = normalizeProfile({
    ...profile,
    id: profile.id || "default-profile",
    createdAt: profile.createdAt || now,
    updatedAt: now
  });
  await fs.writeFile(profilePath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function saveTailoredResume(resume: TailoredResume): Promise<TailoredResume> {
  await ensureDataDirs();
  const filePath = path.join(resumesDir, `${resume.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(resume, null, 2), "utf8");
  return resume;
}

export async function getTailoredResume(id: string): Promise<TailoredResume | null> {
  await ensureDataDirs();
  try {
    const raw = await fs.readFile(path.join(resumesDir, `${id}.json`), "utf8");
    return JSON.parse(raw) as TailoredResume;
  } catch {
    return null;
  }
}

export async function listTailoredResumes(): Promise<TailoredResume[]> {
  await ensureDataDirs();
  const files = await fs.readdir(resumesDir);
  const resumes = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const raw = await fs.readFile(path.join(resumesDir, file), "utf8");
        return JSON.parse(raw) as TailoredResume;
      })
  );

  return resumes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteTailoredResume(id: string): Promise<boolean> {
  await ensureDataDirs();
  try {
    await fs.unlink(path.join(resumesDir, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function clearTailoredResumes(): Promise<number> {
  await ensureDataDirs();
  const files = await fs.readdir(resumesDir);
  const resumeFiles = files.filter((file) => file.endsWith(".json"));

  await Promise.all(resumeFiles.map((file) => fs.unlink(path.join(resumesDir, file))));
  return resumeFiles.length;
}
