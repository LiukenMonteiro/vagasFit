import { useRef, useState } from "react";
import { uploadProfilePdf } from "../api";
import { ResumeProfile } from "../types";

type Props = {
  onProfileLoaded: (profile: ResumeProfile) => void;
  onCreateProfile: () => void;
  onEditProfile: () => void;
};

export function FileUpload({ onProfileLoaded, onCreateProfile, onEditProfile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setMessage("");

    try {
      const result = await uploadProfilePdf(file);
      onProfileLoaded(result.profile);
      const warningText = result.warnings.length ? ` Avisos: ${result.warnings.join(" ")}` : "";
      setMessage(`PDF lido e perfil atualizado.${warningText}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ler o PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card profile-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">01</span>
          <h2>Currículo mestre</h2>
          <p className="muted">Base única para todas as versões adaptadas.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" onClick={onEditProfile}>Editar</button>
          <button className="secondary" onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? "Lendo..." : "Subir PDF"}
          </button>
        </div>
      </div>

      <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={loading}>
        <span className="dropzone-icon">PDF</span>
        <strong>{loading ? "Extraindo dados..." : "Enviar PDF do currículo"}</strong>
        <small>Ou crie manualmente e revise antes de gerar uma versão final.</small>
      </button>

      <button className="secondary full-button" onClick={onCreateProfile}>Criar currículo mestre manualmente</button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {message && <div className="notice">{message}</div>}
    </section>
  );
}
