from fastapi import APIRouter

from .. import storage

router = APIRouter(prefix="/api/reports")


@router.get("/resumes")
def resumes_by_focus():
    """Relatório vindo da view V_RESUME_REPORT: currículos gerados e ATS médio por foco de vaga."""
    return storage.resume_report()
