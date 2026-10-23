"""Modelos de dados. Os campos são snake_case no Python e camelCase no JSON,
para manter o contrato com o frontend React."""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")

    def to_json(self) -> dict:
        """Dict em camelCase, sem campos None (como o JSON.stringify do JS)."""
        return self.model_dump(by_alias=True, exclude_none=True)


class ContactInfo(CamelModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    location: Optional[str] = None


class Education(CamelModel):
    degree: str = ""
    institution: str = ""
    start: Optional[str] = None
    end: Optional[str] = None
    description: Optional[str] = None


class Experience(CamelModel):
    role: str = ""
    company: str = ""
    start: Optional[str] = None
    end: Optional[str] = None
    description: str = ""
    skills: list[str] = Field(default_factory=list)


class Project(CamelModel):
    name: str = ""
    description: str = ""
    skills: list[str] = Field(default_factory=list)
    url: Optional[str] = None


class SkillGroup(CamelModel):
    title: str = ""
    items: list[str] = Field(default_factory=list)


class Language(CamelModel):
    name: str = ""
    level: str = ""


class ResumeProfile(CamelModel):
    id: str = "default-profile"
    full_name: str = ""
    target_title: str = ""
    summary: str = ""
    contact: ContactInfo = Field(default_factory=ContactInfo)
    education: list[Education] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    skill_groups: list[SkillGroup] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


Seniority = Literal["junior", "pleno", "senior", "estagio", "nao_informado"]
Focus = Literal["frontend", "backend", "fullstack", "suporte_ti", "infra", "misto"]


class JobAnalysis(CamelModel):
    job_title: str
    company: Optional[str] = None
    seniority: Seniority
    focus: Focus
    keywords: list[str]
    must_have: list[str]
    nice_to_have: list[str]
    matched_keywords: list[str]
    missing_keywords: list[str]
    ats_score: int
    baseline_ats_score: Optional[int] = None
    optimization_lift: Optional[int] = None
    notes: list[str]


class TailoredResume(CamelModel):
    id: str
    file_name: str
    profile_fingerprint: Optional[str] = None
    profile_full_name: Optional[str] = None
    profile_email: Optional[str] = None
    source_job_title: str
    company: Optional[str] = None
    created_at: str
    full_name: str
    header_title: str
    summary: str
    contact: ContactInfo
    education: list[Education]
    experiences: list[Experience]
    projects: list[Project]
    skill_groups: list[SkillGroup]
    languages: list[Language]
    analysis: JobAnalysis
    change_log: list[str]
    ats_warnings: list[str]
