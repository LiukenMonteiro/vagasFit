from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import storage
from ..services.job_analyzer import analyze_job_description

router = APIRouter(prefix="/api/jobs")

MIN_DESCRIPTION = 20


class JobRequest(BaseModel):
    description: str = ""


@router.post("/analyze")
def analyze_job(body: JobRequest):
    if len(body.description.strip()) < MIN_DESCRIPTION:
        raise HTTPException(400, "Cole uma descrição de vaga com pelo menos 20 caracteres.")
    return analyze_job_description(body.description, storage.get_profile()).to_json()
