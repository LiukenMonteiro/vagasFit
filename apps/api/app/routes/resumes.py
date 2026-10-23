from fastapi import APIRouter, HTTPException, Response

from .. import storage
from ..services.pdf_service import render_resume_pdf
from ..services.resume_tailor import generate_tailored_resume
from .jobs import MIN_DESCRIPTION, JobRequest

router = APIRouter(prefix="/api/resumes")

NOT_FOUND = "Currículo não encontrado."


@router.get("")
def list_resumes():
    return [resume.to_json() for resume in storage.list_tailored_resumes()]


@router.delete("")
def clear_resumes():
    return {"ok": True, "deleted": storage.clear_tailored_resumes()}


@router.post("/generate", status_code=201)
def generate_resume(body: JobRequest):
    if len(body.description.strip()) < MIN_DESCRIPTION:
        raise HTTPException(400, "Cole uma descrição de vaga com pelo menos 20 caracteres.")

    resume = generate_tailored_resume(storage.get_profile(), body.description)
    storage.save_tailored_resume(resume)
    return resume.to_json()


@router.get("/{resume_id}")
def read_resume(resume_id: str):
    resume = storage.get_tailored_resume(resume_id)
    if resume is None:
        raise HTTPException(404, NOT_FOUND)
    return resume.to_json()


@router.get("/{resume_id}/pdf")
def download_pdf(resume_id: str):
    resume = storage.get_tailored_resume(resume_id)
    if resume is None:
        raise HTTPException(404, NOT_FOUND)

    return Response(
        render_resume_pdf(resume),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{resume.file_name}"'},
    )


@router.delete("/{resume_id}")
def delete_resume(resume_id: str):
    if not storage.delete_tailored_resume(resume_id):
        raise HTTPException(404, NOT_FOUND)
    return {"ok": True}
