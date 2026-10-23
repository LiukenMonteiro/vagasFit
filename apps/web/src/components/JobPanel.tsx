import { CSSProperties } from "react";
import { JobAnalysis } from "../types";

type Props = {
  description: string;
  onDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  onClearAnalysis: () => void;
  analysis: JobAnalysis | null;
  loading: boolean;
};

export function JobPanel({
  description,
  onDescriptionChange,
  onAnalyze,
  onGenerate,
  onClearAnalysis,
  analysis,
  loading
}: Props) {
  const characterCount = description.trim().length;
  const hasOptimizedScore = analysis?.baselineAtsScore !== undefined;
  const analysisLabel = analysis
    ? hasOptimizedScore
      ? `Antes: ${analysis.baselineAtsScore}%`
      : `Diagnóstico: ${analysis.atsScore}%`
    : "Analisar aderência";

  return (
    <section className="card job-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">02</span>
          <h2>Descrição da vaga</h2>
          <p className="muted">Cole o anúncio completo para extrair requisitos, palavras-chave e lacunas.</p>
        </div>
        <span className="counter">{characterCount} caracteres</span>
      </div>

      <textarea
        className="job-textarea"
        rows={18}
        placeholder="Cole aqui a descrição da vaga..."
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
      />

      <div className="actions">
        <button className="secondary" onClick={onAnalyze} disabled={loading || description.trim().length < 20}>
          {analysisLabel}
        </button>
        <button className="generate" onClick={onGenerate} disabled={loading || description.trim().length < 20}>
          {loading ? "Gerando..." : "Gerar currículo"}
        </button>
      </div>

      {analysis && (
        <div className="analysis-box">
          <div className="analysis-tools">
            <span className="muted">Edite a descrição e limpe a análise para recomeçar.</span>
            <button className="secondary small-button" type="button" onClick={onClearAnalysis} disabled={loading}>
              Limpar análise
            </button>
          </div>

          <div className="analysis-summary">
            <div className="score-ring" style={{ "--score": `${analysis.atsScore}%` } as CSSProperties}>
              <strong>{analysis.atsScore}%</strong>
              <span>{hasOptimizedScore ? "FIT" : "ATS"}</span>
            </div>

            <div>
              <span className="eyebrow">{hasOptimizedScore ? "Resultado" : "Análise"}</span>
              <h3>{analysis.jobTitle}</h3>
              <p className="muted">
                {hasOptimizedScore
                  ? `Aderência otimizada: ${analysis.baselineAtsScore}% → ${analysis.atsScore}%${analysis.optimizationLift ? ` (+${analysis.optimizationLift})` : ""}`
                  : `${analysis.seniority.replace("_", " ")} · ${analysis.focus.replace("_", " ")}`}
              </p>
            </div>
          </div>

          <div className="grid two compact">
            <div>
              <small>Essenciais</small>
              <strong>{analysis.mustHave.length}</strong>
            </div>
            <div>
              <small>Diferenciais</small>
              <strong>{analysis.niceToHave.length}</strong>
            </div>
          </div>

          <h3>Matches</h3>
          <div className="chips">{analysis.matchedKeywords.map((item) => <span className="chip good" key={item}>{item}</span>)}</div>

          <h3>Lacunas</h3>
          <div className="chips">{analysis.missingKeywords.map((item) => <span className="chip warn" key={item}>{item}</span>)}</div>

          {analysis.notes.map((note) => <p className="muted" key={note}>{note}</p>)}
        </div>
      )}
    </section>
  );
}
