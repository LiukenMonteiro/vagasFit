import { JobAnalysis, ResumeProfile, TailoredResume } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3333/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...(init?.headers || {}) }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
    throw new Error(error.message || "Erro na requisição");
  }

  return response.json() as Promise<T>;
}

export function getProfile() {
  return request<ResumeProfile>("/profile");
}

export function saveProfile(profile: ResumeProfile) {
  return request<ResumeProfile>("/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  });
}

export async function uploadProfilePdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ profile: ResumeProfile; warnings: string[]; rawTextPreview: string }>("/profile/from-pdf", {
    method: "POST",
    body: formData
  });
}

export function analyzeJob(description: string) {
  return request<JobAnalysis>("/jobs/analyze", {
    method: "POST",
    body: JSON.stringify({ description })
  });
}

export function generateResume(description: string) {
  return request<TailoredResume>("/resumes/generate", {
    method: "POST",
    body: JSON.stringify({ description })
  });
}

export function listResumes() {
  return request<TailoredResume[]>("/resumes");
}

export function deleteResume(id: string) {
  return request<{ ok: true }>(`/resumes/${id}`, {
    method: "DELETE"
  });
}

export function clearResumes() {
  return request<{ ok: true; deleted: number }>("/resumes", {
    method: "DELETE"
  });
}

export function pdfUrl(id: string) {
  return `${API_BASE}/resumes/${id}/pdf`;
}
