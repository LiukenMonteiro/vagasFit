import { pdfUrl } from "../api";
import { TailoredResume } from "../types";

type Props = {
  resumes: TailoredResume[];
  onSelect: (resume: TailoredResume) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export function History({ resumes, onSelect, onDelete, onClear }: Props) {
  function handleDelete(resume: TailoredResume) {
    const shouldDelete = window.confirm(`Excluir "${resume.fileName}" do histórico?`);
    if (shouldDelete) {
      onDelete(resume.id);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Histórico</span>
          <h2>Currículos salvos</h2>
          <p className="muted">Reabra versões anteriores ou baixe o PDF final.</p>
        </div>
        {resumes.length > 0 && (
          <button className="danger small-button" onClick={onClear}>Limpar histórico</button>
        )}
      </div>

      {resumes.length === 0 && (
        <div className="quiet-empty">
          <strong>Nenhum currículo gerado ainda.</strong>
          <span>As versões por vaga aparecem aqui automaticamente.</span>
        </div>
      )}

      <div className="history-list">
        {resumes.map((resume) => (
          <div className="history-item" key={resume.id}>
            <button className="link-button" onClick={() => onSelect(resume)}>
              <strong>{resume.sourceJobTitle}</strong>
              <span>{resume.fileName}</span>
            </button>
            <span>{resume.analysis.atsScore}% ATS · {new Date(resume.createdAt).toLocaleDateString("pt-BR")}</span>
            <a href={pdfUrl(resume.id)} target="_blank" rel="noreferrer">PDF</a>
            <button className="danger small-button" onClick={() => handleDelete(resume)}>Excluir</button>
          </div>
        ))}
      </div>
    </section>
  );
}
