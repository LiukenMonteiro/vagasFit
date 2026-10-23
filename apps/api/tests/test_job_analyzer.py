from app.models import Experience, ResumeProfile, SkillGroup
from app.services.job_analyzer import analyze_job_description, detect_keywords, detect_seniority

PROFILE = ResumeProfile(
    full_name="Fulana de Tal",
    target_title="Desenvolvedora Web",
    summary="Desenvolvedora com React e Node.js.",
    experiences=[Experience(role="Dev", company="X", description="Apps com React e SQL", skills=["React", "Node.js", "SQL"])],
    skill_groups=[SkillGroup(title="Web", items=["JavaScript", "React"])],
)


def test_detects_keywords_by_alias():
    assert {"React", "Node.js", "PostgreSQL"} <= set(detect_keywords("Precisamos de reactjs, nodejs e postgres."))


def test_negation_removes_keyword():
    assert "Python" not in detect_keywords("Sem necessidade de experiência com Python.")


def test_short_alias_needs_whole_word():
    assert "Go" not in detect_keywords("Trabalhamos com algoritmos e gogh.")
    assert "Go" in detect_keywords("Diferencial: golang.")


def test_seniority_from_years():
    assert detect_seniority("Pedimos 5 anos de experiência com vendas") == "senior"
    assert detect_seniority("Vaga para estagiário") == "estagio"


def test_matches_and_gaps_come_from_profile_only():
    analysis = analyze_job_description("Vaga Backend. Requisitos: React, SQL, Kubernetes e Terraform.", PROFILE)
    assert analysis.matched_keywords == ["React", "SQL"]
    assert set(analysis.missing_keywords) == {"Kubernetes", "Terraform"}
    assert analysis.ats_score == 50
