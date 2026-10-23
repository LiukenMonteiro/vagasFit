"""Persistência no Firebird (firebird-driver).

Toda função abre uma transação curta via db.transaction(). O perfil mestre é
salvo de forma "substitui tudo": atualiza a linha de PROFILES e recria as
tabelas filhas, o que mantém a ordem dos itens e evita diffs complicados.
"""
import json
import re
from datetime import datetime, timezone
from typing import Optional

from . import db
from .models import (
    ContactInfo,
    Education,
    Experience,
    Language,
    Project,
    ResumeProfile,
    SkillGroup,
    TailoredResume,
)
from .seed import PROFILE_SEED

DEFAULT_PROFILE_ID = "default-profile"

_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
_LABEL_RE = re.compile(
    r"^(e-?mail|email|telefone|phone|celular|linkedin|github|portfolio|portfólio|localização|localizacao|location)\s*:?\s*",
    re.I,
)


# ─── normalização de contato ────────────────────────────────────────────────

def clean_contact_label(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return _LABEL_RE.sub("", value).strip() or None


def clean_email(value: Optional[str]) -> Optional[str]:
    match = _EMAIL_RE.search(clean_contact_label(value) or "")
    return match.group(0).lower() if match else None


def normalize_profile(profile: ResumeProfile) -> ResumeProfile:
    c = profile.contact
    profile.contact = ContactInfo(
        email=clean_email(c.email) or c.email,
        phone=clean_contact_label(c.phone),
        linkedin=clean_contact_label(c.linkedin),
        github=clean_contact_label(c.github),
        portfolio=clean_contact_label(c.portfolio),
        location=clean_contact_label(c.location),
    )
    return profile


# ─── conversões de data ─────────────────────────────────────────────────────

def now_utc() -> datetime:
    """Timestamp sem fuso (o Firebird TIMESTAMP não guarda fuso), sempre em UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def to_iso(value: datetime) -> str:
    return value.isoformat(timespec="milliseconds") + "Z"


def from_iso(value: str) -> datetime:
    if not value:
        return now_utc()
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


# ─── perfil mestre ──────────────────────────────────────────────────────────

def _insert_returning_id(cur, sql: str, params: tuple) -> int:
    cur.execute(sql + " RETURNING ID", params)
    return cur.fetchone()[0]


def _text(value) -> str:
    """BLOB TEXT chega como str (ou None quando a coluna é NULL)."""
    return value or ""


def _load_profile(cur, profile_id: str) -> Optional[ResumeProfile]:
    cur.execute(
        "SELECT FULL_NAME, TARGET_TITLE, SUMMARY, EMAIL, PHONE, LINKEDIN, GITHUB, PORTFOLIO, LOCATION,"
        " CREATED_AT, UPDATED_AT FROM PROFILES WHERE ID = ?",
        (profile_id,),
    )
    row = cur.fetchone()
    if row is None:
        return None
    full_name, title, summary, email, phone, linkedin, github, portfolio, location, created, updated = row

    cur.execute(
        "SELECT ID, ROLE_TITLE, COMPANY, START_DATE, END_DATE, DESCRIPTION FROM EXPERIENCES"
        " WHERE PROFILE_ID = ? ORDER BY SEQ",
        (profile_id,),
    )
    experiences = []
    for exp_id, role, company, start, end, description in cur.fetchall():
        cur.execute("SELECT SKILL FROM EXPERIENCE_SKILLS WHERE EXPERIENCE_ID = ? ORDER BY SEQ", (exp_id,))
        experiences.append(Experience(
            role=role, company=company, start=start, end=end, description=_text(description),
            skills=[r[0] for r in cur.fetchall()],
        ))

    cur.execute("SELECT ID, NAME, DESCRIPTION, URL FROM PROJECTS WHERE PROFILE_ID = ? ORDER BY SEQ", (profile_id,))
    projects = []
    for proj_id, name, description, url in cur.fetchall():
        cur.execute("SELECT SKILL FROM PROJECT_SKILLS WHERE PROJECT_ID = ? ORDER BY SEQ", (proj_id,))
        projects.append(Project(
            name=name, description=_text(description), url=url, skills=[r[0] for r in cur.fetchall()],
        ))

    cur.execute("SELECT ID, TITLE FROM SKILL_GROUPS WHERE PROFILE_ID = ? ORDER BY SEQ", (profile_id,))
    skill_groups = []
    for group_id, group_title in cur.fetchall():
        cur.execute("SELECT SKILL FROM SKILL_GROUP_ITEMS WHERE GROUP_ID = ? ORDER BY SEQ", (group_id,))
        skill_groups.append(SkillGroup(title=group_title, items=[r[0] for r in cur.fetchall()]))

    cur.execute(
        "SELECT DEGREE, INSTITUTION, START_DATE, END_DATE, DESCRIPTION FROM EDUCATION"
        " WHERE PROFILE_ID = ? ORDER BY SEQ",
        (profile_id,),
    )
    education = [
        Education(degree=d, institution=i, start=s, end=e, description=desc if desc else None)
        for d, i, s, e, desc in cur.fetchall()
    ]

    cur.execute("SELECT NAME, LEVEL_NAME FROM LANGUAGES WHERE PROFILE_ID = ? ORDER BY SEQ", (profile_id,))
    languages = [Language(name=n, level=lv) for n, lv in cur.fetchall()]

    return ResumeProfile(
        id=profile_id,
        full_name=full_name,
        target_title=title,
        summary=_text(summary),
        contact=ContactInfo(email=email, phone=phone, linkedin=linkedin, github=github,
                            portfolio=portfolio, location=location),
        education=education,
        experiences=experiences,
        projects=projects,
        skill_groups=skill_groups,
        languages=languages,
        created_at=to_iso(created),
        updated_at=to_iso(updated),
    )


def _write_profile(cur, profile: ResumeProfile) -> None:
    c = profile.contact
    # UPDATE OR INSERT ... MATCHING é o "upsert" nativo do Firebird.
    cur.execute(
        "UPDATE OR INSERT INTO PROFILES (ID, FULL_NAME, TARGET_TITLE, SUMMARY, EMAIL, PHONE, LINKEDIN,"
        " GITHUB, PORTFOLIO, LOCATION, CREATED_AT, UPDATED_AT)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) MATCHING (ID)",
        (profile.id, profile.full_name, profile.target_title, profile.summary, c.email, c.phone,
         c.linkedin, c.github, c.portfolio, c.location,
         from_iso(profile.created_at), from_iso(profile.updated_at)),
    )

    # ON DELETE CASCADE limpa as tabelas netas (skills) junto com as filhas.
    for table in ("EXPERIENCES", "PROJECTS", "SKILL_GROUPS", "EDUCATION", "LANGUAGES"):
        cur.execute(f"DELETE FROM {table} WHERE PROFILE_ID = ?", (profile.id,))

    for seq, exp in enumerate(profile.experiences):
        exp_id = _insert_returning_id(
            cur,
            "INSERT INTO EXPERIENCES (PROFILE_ID, SEQ, ROLE_TITLE, COMPANY, START_DATE, END_DATE, DESCRIPTION)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (profile.id, seq, exp.role, exp.company, exp.start, exp.end, exp.description),
        )
        for pos, skill in enumerate(exp.skills):
            cur.execute("INSERT INTO EXPERIENCE_SKILLS (EXPERIENCE_ID, SEQ, SKILL) VALUES (?, ?, ?)",
                        (exp_id, pos, skill))

    for seq, proj in enumerate(profile.projects):
        proj_id = _insert_returning_id(
            cur,
            "INSERT INTO PROJECTS (PROFILE_ID, SEQ, NAME, DESCRIPTION, URL) VALUES (?, ?, ?, ?, ?)",
            (profile.id, seq, proj.name, proj.description, proj.url),
        )
        for pos, skill in enumerate(proj.skills):
            cur.execute("INSERT INTO PROJECT_SKILLS (PROJECT_ID, SEQ, SKILL) VALUES (?, ?, ?)",
                        (proj_id, pos, skill))

    for seq, group in enumerate(profile.skill_groups):
        group_id = _insert_returning_id(
            cur,
            "INSERT INTO SKILL_GROUPS (PROFILE_ID, SEQ, TITLE) VALUES (?, ?, ?)",
            (profile.id, seq, group.title),
        )
        for pos, skill in enumerate(group.items):
            cur.execute("INSERT INTO SKILL_GROUP_ITEMS (GROUP_ID, SEQ, SKILL) VALUES (?, ?, ?)",
                        (group_id, pos, skill))

    for seq, edu in enumerate(profile.education):
        cur.execute(
            "INSERT INTO EDUCATION (PROFILE_ID, SEQ, DEGREE, INSTITUTION, START_DATE, END_DATE, DESCRIPTION)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (profile.id, seq, edu.degree, edu.institution, edu.start, edu.end, edu.description),
        )

    for seq, lang in enumerate(profile.languages):
        cur.execute("INSERT INTO LANGUAGES (PROFILE_ID, SEQ, NAME, LEVEL_NAME) VALUES (?, ?, ?, ?)",
                    (profile.id, seq, lang.name, lang.level))


def save_profile(profile: ResumeProfile) -> ResumeProfile:
    now = to_iso(now_utc())
    profile = normalize_profile(profile.model_copy(update={
        "id": profile.id or DEFAULT_PROFILE_ID,
        "created_at": profile.created_at or now,
        "updated_at": now,
    }))
    with db.transaction() as con:
        _write_profile(con.cursor(), profile)
    return profile


def get_profile() -> ResumeProfile:
    with db.transaction() as con:
        profile = _load_profile(con.cursor(), DEFAULT_PROFILE_ID)
    if profile is not None:
        return normalize_profile(profile)

    # Banco vazio: grava o perfil inicial.
    return save_profile(ResumeProfile.model_validate(PROFILE_SEED))


# ─── currículos gerados ─────────────────────────────────────────────────────

def save_tailored_resume(resume: TailoredResume, profile_id: str = DEFAULT_PROFILE_ID) -> TailoredResume:
    analysis = resume.analysis
    with db.transaction() as con:
        con.cursor().execute(
            "INSERT INTO TAILORED_RESUMES (ID, PROFILE_ID, FILE_NAME, JOB_TITLE, COMPANY, FOCUS, SENIORITY,"
            " ATS_BASELINE, ATS_SCORE, CREATED_AT, CONTENT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (resume.id, profile_id, resume.file_name, resume.source_job_title, resume.company,
             analysis.focus, analysis.seniority,
             analysis.baseline_ats_score if analysis.baseline_ats_score is not None else analysis.ats_score,
             analysis.ats_score, from_iso(resume.created_at),
             json.dumps(resume.to_json(), ensure_ascii=False)),
        )
    return resume


def get_tailored_resume(resume_id: str) -> Optional[TailoredResume]:
    with db.transaction() as con:
        cur = con.cursor()
        cur.execute("SELECT CONTENT FROM TAILORED_RESUMES WHERE ID = ?", (resume_id,))
        row = cur.fetchone()
    return TailoredResume.model_validate(json.loads(row[0])) if row else None


def list_tailored_resumes() -> list[TailoredResume]:
    with db.transaction() as con:
        cur = con.cursor()
        cur.execute("SELECT CONTENT FROM TAILORED_RESUMES ORDER BY CREATED_AT DESC")
        rows = cur.fetchall()
    return [TailoredResume.model_validate(json.loads(r[0])) for r in rows]


def delete_tailored_resume(resume_id: str) -> bool:
    with db.transaction() as con:
        cur = con.cursor()
        cur.execute("DELETE FROM TAILORED_RESUMES WHERE ID = ?", (resume_id,))
        return cur.rowcount > 0


def clear_tailored_resumes() -> int:
    with db.transaction() as con:
        cur = con.cursor()
        cur.execute("DELETE FROM TAILORED_RESUMES")
        return cur.rowcount


# ─── relatório ──────────────────────────────────────────────────────────────

def resume_report() -> list[dict]:
    """Lê a view V_RESUME_REPORT: desempenho médio dos currículos por foco de vaga."""
    with db.transaction() as con:
        cur = con.cursor()
        cur.execute(
            "SELECT FOCUS, TOTAL, AVG_BASELINE, AVG_SCORE, BEST_SCORE, LAST_GENERATED"
            " FROM V_RESUME_REPORT ORDER BY TOTAL DESC, FOCUS"
        )
        return [
            {
                "focus": focus,
                "total": total,
                "avgBaseline": float(avg_base),
                "avgScore": float(avg_score),
                "bestScore": best,
                "lastGenerated": to_iso(last),
            }
            for focus, total, avg_base, avg_score, best, last in cur.fetchall()
        ]
