import { KeyboardEvent, useState } from "react";
import { Education, Experience, Language, Project, ResumeProfile, SkillGroup } from "../types";

type Props = {
  profile: ResumeProfile | null;
  onChange: (profile: ResumeProfile) => void;
  onSave: () => void;
  saving: boolean;
};

type TagInputProps = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
};

function uniqueItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function TagInput({ label, items, onChange, placeholder = "Digite uma skill e pressione Enter" }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addFromDraft(value: string) {
    const nextItems = value.split(",").map((item) => item.trim()).filter(Boolean);
    if (nextItems.length === 0) return;
    onChange(uniqueItems([...items, ...nextItems]));
    setDraft("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addFromDraft(draft);
  }

  return (
    <label>
      {label}
      <div className="tag-input">
        {items.map((item, index) => (
          <button className="tag-pill" type="button" key={`${item}-${index}`} onClick={() => removeItem(index)} title={`Remover ${item}`}>
            {item}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => addFromDraft(draft)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </label>
  );
}

export function ProfileEditor({ profile, onChange, onSave, saving }: Props) {
  if (!profile) {
    return <section className="card"><p>Carregando perfil...</p></section>;
  }

  const currentProfile = profile;

  function update<K extends keyof ResumeProfile>(key: K, value: ResumeProfile[K]) {
    onChange({ ...currentProfile, [key]: value });
  }

  function updateContact(key: string, value: string) {
    onChange({ ...currentProfile, contact: { ...currentProfile.contact, [key]: value } });
  }

  function updateExperience(index: number, value: Experience) {
    update("experiences", currentProfile.experiences.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateProject(index: number, value: Project) {
    update("projects", currentProfile.projects.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateEducation(index: number, value: Education) {
    update("education", currentProfile.education.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateSkillGroup(index: number, value: SkillGroup) {
    update("skillGroups", currentProfile.skillGroups.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateLanguage(index: number, value: Language) {
    update("languages", currentProfile.languages.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function removeItem<K extends "experiences" | "projects" | "education" | "skillGroups" | "languages">(key: K, index: number) {
    update(key, currentProfile[key].filter((_, itemIndex) => itemIndex !== index) as ResumeProfile[K]);
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Perfil</span>
          <h2>Dados extraídos/editáveis</h2>
        </div>
        <button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</button>
      </div>

      <div className="grid two">
        <label>
          Nome
          <input value={currentProfile.fullName} onChange={(event) => update("fullName", event.target.value)} />
        </label>
        <label>
          Título base
          <input value={currentProfile.targetTitle} onChange={(event) => update("targetTitle", event.target.value)} />
        </label>
        <label>
          E-mail
          <input value={currentProfile.contact.email || ""} onChange={(event) => updateContact("email", event.target.value)} />
        </label>
        <label>
          LinkedIn
          <input value={currentProfile.contact.linkedin || ""} onChange={(event) => updateContact("linkedin", event.target.value)} />
        </label>
        <label>
          Telefone
          <input value={currentProfile.contact.phone || ""} onChange={(event) => updateContact("phone", event.target.value)} />
        </label>
        <label>
          Localização
          <input value={currentProfile.contact.location || ""} onChange={(event) => updateContact("location", event.target.value)} />
        </label>
        <label>
          GitHub
          <input value={currentProfile.contact.github || ""} onChange={(event) => updateContact("github", event.target.value)} />
        </label>
        <label>
          Portfólio
          <input value={currentProfile.contact.portfolio || ""} onChange={(event) => updateContact("portfolio", event.target.value)} />
        </label>
      </div>

      <label>
        Resumo mestre
        <textarea
          rows={6}
          value={currentProfile.summary}
          onChange={(event) => update("summary", event.target.value)}
        />
      </label>

      <div className="editable-section">
        <div className="section-title">
          <h3>Experiências</h3>
          <button className="secondary small-button" onClick={() => update("experiences", [...currentProfile.experiences, { role: "", company: "", description: "", skills: [] }])}>Adicionar</button>
        </div>
        {currentProfile.experiences.map((experience, index) => (
          <div className="edit-item" key={`${experience.role}-${experience.company}-${index}`}>
            <div className="grid two">
              <label>Cargo<input value={experience.role} onChange={(event) => updateExperience(index, { ...experience, role: event.target.value })} /></label>
              <label>Empresa<input value={experience.company} onChange={(event) => updateExperience(index, { ...experience, company: event.target.value })} /></label>
              <label>Início<input value={experience.start || ""} onChange={(event) => updateExperience(index, { ...experience, start: event.target.value })} /></label>
              <label>Fim<input value={experience.end || ""} onChange={(event) => updateExperience(index, { ...experience, end: event.target.value })} /></label>
            </div>
            <label>Descrição<textarea rows={3} value={experience.description} onChange={(event) => updateExperience(index, { ...experience, description: event.target.value })} /></label>
            <TagInput label="Habilidades usadas" items={experience.skills} onChange={(skills) => updateExperience(index, { ...experience, skills })} />
            <button className="danger small-button" onClick={() => removeItem("experiences", index)}>Remover experiência</button>
          </div>
        ))}
      </div>

      <div className="editable-section">
        <div className="section-title">
          <h3>Projetos</h3>
          <button className="secondary small-button" onClick={() => update("projects", [...currentProfile.projects, { name: "", description: "", skills: [] }])}>Adicionar</button>
        </div>
        {currentProfile.projects.map((project, index) => (
          <div className="edit-item" key={`${project.name}-${index}`}>
            <div className="grid two">
              <label>Nome<input value={project.name} onChange={(event) => updateProject(index, { ...project, name: event.target.value })} /></label>
              <label>URL<input value={project.url || ""} onChange={(event) => updateProject(index, { ...project, url: event.target.value })} /></label>
            </div>
            <label>Descrição<textarea rows={3} value={project.description} onChange={(event) => updateProject(index, { ...project, description: event.target.value })} /></label>
            <TagInput label="Habilidades" items={project.skills} onChange={(skills) => updateProject(index, { ...project, skills })} />
            <button className="danger small-button" onClick={() => removeItem("projects", index)}>Remover projeto</button>
          </div>
        ))}
      </div>

      <div className="editable-section">
        <div className="section-title">
          <h3>Formação</h3>
          <button className="secondary small-button" onClick={() => update("education", [...currentProfile.education, { degree: "", institution: "" }])}>Adicionar</button>
        </div>
        {currentProfile.education.map((education, index) => (
          <div className="edit-item" key={`${education.degree}-${education.institution}-${index}`}>
            <div className="grid two">
              <label>Curso<input value={education.degree} onChange={(event) => updateEducation(index, { ...education, degree: event.target.value })} /></label>
              <label>Instituição<input value={education.institution} onChange={(event) => updateEducation(index, { ...education, institution: event.target.value })} /></label>
              <label>Início<input value={education.start || ""} onChange={(event) => updateEducation(index, { ...education, start: event.target.value })} /></label>
              <label>Fim<input value={education.end || ""} onChange={(event) => updateEducation(index, { ...education, end: event.target.value })} /></label>
            </div>
            <label>Descrição<textarea rows={2} value={education.description || ""} onChange={(event) => updateEducation(index, { ...education, description: event.target.value })} /></label>
            <button className="danger small-button" onClick={() => removeItem("education", index)}>Remover formação</button>
          </div>
        ))}
      </div>

      <div className="editable-section">
        <div className="section-title">
          <h3>Habilidades</h3>
          <button className="secondary small-button" onClick={() => update("skillGroups", [...currentProfile.skillGroups, { title: "", items: [] }])}>Adicionar</button>
        </div>
        {currentProfile.skillGroups.map((group, index) => (
          <div className="edit-item" key={`${group.title}-${index}`}>
            <div className="grid two">
              <label>Grupo<input value={group.title} onChange={(event) => updateSkillGroup(index, { ...group, title: event.target.value })} /></label>
              <TagInput label="Itens" items={group.items} onChange={(items) => updateSkillGroup(index, { ...group, items })} />
            </div>
            <button className="danger small-button" onClick={() => removeItem("skillGroups", index)}>Remover grupo</button>
          </div>
        ))}
      </div>

      <div className="editable-section">
        <div className="section-title">
          <h3>Idiomas</h3>
          <button className="secondary small-button" onClick={() => update("languages", [...currentProfile.languages, { name: "", level: "" }])}>Adicionar</button>
        </div>
        {currentProfile.languages.map((language, index) => (
          <div className="edit-item" key={`${language.name}-${index}`}>
            <div className="grid two">
              <label>Idioma<input value={language.name} onChange={(event) => updateLanguage(index, { ...language, name: event.target.value })} /></label>
              <label>Nível<input value={language.level} onChange={(event) => updateLanguage(index, { ...language, level: event.target.value })} /></label>
            </div>
            <button className="danger small-button" onClick={() => removeItem("languages", index)}>Remover idioma</button>
          </div>
        ))}
      </div>
    </section>
  );
}
