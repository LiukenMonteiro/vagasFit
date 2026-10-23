import { useEffect, useState } from "react";
import { analyzeJob, clearResumes, deleteResume, generateResume, getProfile, listResumes, saveProfile } from "./api";
import { FileUpload } from "./components/FileUpload";
import { History } from "./components/History";
import { JobPanel } from "./components/JobPanel";
import { ProfileEditor } from "./components/ProfileEditor";
import { ResumePreview } from "./components/ResumePreview";
import { JobAnalysis, ResumeProfile, TailoredResume } from "./types";

type AppView = "generator" | "profile";
type ThemeMode = "light" | "dark";
type BusyMode = "analyze" | "generate" | null;

function createBlankProfile(): ResumeProfile {
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

export default function App() {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [history, setHistory] = useState<TailoredResume[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyMode, setBusyMode] = useState<BusyMode>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<AppView>("generator");
  const [logoBurst, setLogoBurst] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("vagafit-theme") === "light" ? "light" : "dark";
  });

  async function refreshHistory() {
    const items = await listResumes();
    setHistory(items);
  }

  useEffect(() => {
    getProfile().then(setProfile).catch((error) => setToast(error.message));
    refreshHistory().catch(() => undefined);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem("vagafit-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!logoBurst) return;

    const timeoutId = window.setTimeout(() => setLogoBurst(false), 850);
    return () => window.clearTimeout(timeoutId);
  }, [logoBurst]);

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setToast("");
    try {
      const updated = await saveProfile(profile);
      setProfile(updated);
      setToast("Perfil salvo com sucesso.");
      setView("generator");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    setLoading(true);
    setBusyMode("analyze");
    setToast("");
    try {
      const result = await analyzeJob(description);
      setAnalysis(result);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Erro ao analisar vaga.");
    } finally {
      setLoading(false);
      setBusyMode(null);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setBusyMode("generate");
    setToast("");
    try {
      const result = await generateResume(description);
      setResume(result);
      setAnalysis(result.analysis);
      await refreshHistory();
      setToast("Currículo gerado e salvo no histórico.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Erro ao gerar currículo.");
    } finally {
      setLoading(false);
      setBusyMode(null);
    }
  }

  async function handleDeleteResume(id: string) {
    setToast("");
    try {
      await deleteResume(id);
      setHistory((items) => items.filter((item) => item.id !== id));
      setResume((current) => current?.id === id ? null : current);
      setToast("Currículo removido do histórico.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Erro ao excluir currículo.");
    }
  }

  async function handleClearHistory() {
    const shouldClear = window.confirm("Apagar todos os currículos salvos do histórico?");
    if (!shouldClear) return;

    setToast("");
    try {
      await clearResumes();
      setHistory([]);
      setResume(null);
      setToast("Histórico de currículos limpo.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Erro ao limpar histórico.");
    }
  }

  function handleCreateProfile() {
    setProfile(createBlankProfile());
    setToast("");
    setView("profile");
  }

  function handleProfileLoaded(loadedProfile: ResumeProfile) {
    setProfile(loadedProfile);
    setView("profile");
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (analysis || resume) {
      setAnalysis(null);
      setResume(null);
    }
  }

  function handleClearAnalysis() {
    setAnalysis(null);
    setResume(null);
    setToast("Análise limpa. Ajuste a descrição e rode de novo.");
  }

  const profileCompleteness = profile
    ? [
      profile.fullName,
      profile.targetTitle,
      profile.summary,
      profile.contact.email,
      profile.experiences.length,
      profile.skillGroups.length
    ].filter(Boolean).length
    : 0;

  const totalGenerated = history.length;
  const latestResume = history[0];
  const bestScore = Math.max(analysis?.atsScore ?? 0, ...history.map((item) => item.analysis.atsScore), 0);
  const isDarkTheme = theme === "dark";

  return (
    <main>
      <header className="app-header">
        <div className="brand-lockup">
          <button
            className={`brand-mark ${logoBurst ? "is-active" : ""}`}
            type="button"
            aria-label="Girar o símbolo"
            onClick={() => setLogoBurst(true)}
          >
            <img src="/simbolo.svg" alt="" width="68" height="68" />
          </button>
          <div>
            <span className="badge">Currículo ATS</span>
            <h1>Vagas<span>Fit</span></h1>
            <p>Um currículo mestre, uma versão para cada vaga. Só com o que você já fez.</p>
          </div>
        </div>

        <div className="header-panel">
          <button
            className="theme-toggle"
            type="button"
            aria-label={isDarkTheme ? "Mudar para modo claro" : "Mudar para modo escuro"}
            aria-pressed={isDarkTheme}
            title={isDarkTheme ? "Modo claro" : "Modo escuro"}
            onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
          >
            {isDarkTheme ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

      {view === "profile" ? (
        <div className="page-stack">
          <div className="page-toolbar">
            <button className="secondary" onClick={() => setView("generator")}>Voltar</button>
          </div>
          <ProfileEditor profile={profile} onChange={setProfile} onSave={handleSaveProfile} saving={saving} />
        </div>
      ) : (
        <>
          <section className="insight-strip" aria-label="Resumo do workspace">
            <div className="metric-card">
              <span>Perfil</span>
              <strong>{profile ? `${profileCompleteness}/6` : "--"}</strong>
              <small>campos essenciais preenchidos</small>
            </div>
            <div className="metric-card">
              <span>Melhor ATS</span>
              <strong>{bestScore || "--"}{bestScore ? "%" : ""}</strong>
              <small>maior compatibilidade vista</small>
            </div>
            <div className="metric-card">
              <span>Histórico</span>
              <strong>{totalGenerated}</strong>
              <small>{latestResume ? `último: ${latestResume.sourceJobTitle}` : "nenhuma versão gerada"}</small>
            </div>
          </section>

          <div className="layout">
            <div className="left-column">
            <FileUpload
              onProfileLoaded={handleProfileLoaded}
              onCreateProfile={handleCreateProfile}
              onEditProfile={() => setView("profile")}
            />
            <History resumes={history} onSelect={setResume} onDelete={handleDeleteResume} onClear={handleClearHistory} />
            </div>

            <div className="right-column">
            <JobPanel
              description={description}
              onDescriptionChange={handleDescriptionChange}
              onAnalyze={handleAnalyze}
              onGenerate={handleGenerate}
              onClearAnalysis={handleClearAnalysis}
              analysis={analysis}
              loading={loading}
            />
            <ResumePreview resume={resume} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
