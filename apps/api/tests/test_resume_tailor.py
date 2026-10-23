from app.models import Experience, Project, ResumeProfile, SkillGroup
from app.services.resume_tailor import generate_tailored_resume, optimized_ats_score
from app.services.job_analyzer import analyze_job_description

PROFILE = ResumeProfile(
    full_name="Fulana de Tal",
    target_title="Desenvolvedora Web",
    summary="Desenvolvedora web com experiência em aplicações usando React e Node.js, integrando APIs e bancos de dados SQL em produção.",
    experiences=[
        Experience(role="Suporte", company="A", start="Jan 2020", end="Dez 2021", description="Suporte a usuários e redes.", skills=["Linux"]),
        Experience(role="Dev", company="B", start="Jan 2022", end="Atual", description="Apps com React. APIs em Node.js.", skills=["React", "Node.js"]),
    ],
    projects=[Project(name="Loja", description="Loja virtual com React.", skills=["React"])],
    skill_groups=[SkillGroup(title="Desenvolvimento Web", items=["HTML5", "React"])],
)
JOB = "Desenvolvedor Full Stack. Requisitos: experiência com React, Node.js e Kubernetes."


def test_never_claims_skills_missing_from_profile():
    resume = generate_tailored_resume(PROFILE, JOB)
    everything = " ".join(
        [resume.summary, resume.header_title]
        + [e.description for e in resume.experiences]
        + [s for g in resume.skill_groups for s in g.items]
    )
    assert "Kubernetes" not in everything
    assert "Kubernetes" in resume.analysis.missing_keywords


def test_most_relevant_experience_comes_first():
    resume = generate_tailored_resume(PROFILE, JOB)
    assert resume.experiences[0].role == "Dev"


def test_score_never_drops_below_raw_and_is_capped():
    analysis = analyze_job_description(JOB, PROFILE)
    resume = generate_tailored_resume(PROFILE, JOB)
    assert resume.analysis.baseline_ats_score == analysis.ats_score
    assert analysis.ats_score <= resume.analysis.ats_score <= analysis.ats_score + 15


def test_file_name_uses_person_and_job():
    resume = generate_tailored_resume(PROFILE, JOB)
    assert resume.file_name.startswith("curriculo-fulana-de-tal-desenvolvedor-full-stack")
    assert resume.file_name.endswith(".pdf")
