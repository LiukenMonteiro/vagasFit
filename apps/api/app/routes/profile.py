import uuid

from fastapi import APIRouter, HTTPException, UploadFile

from .. import config, storage
from ..models import ResumeProfile
from ..services.profile_parser import parse_profile_from_pdf

router = APIRouter(prefix="/api/profile")


@router.get("")
def read_profile():
    return storage.get_profile().to_json()


@router.put("")
def update_profile(profile: ResumeProfile):
    return storage.save_profile(profile).to_json()


@router.post("/from-pdf")
def profile_from_pdf(file: UploadFile | None = None):
    if file is None:
        raise HTTPException(400, "Envie um arquivo PDF no campo 'file'.")

    # O PDF só é necessário durante a leitura; o perfil extraído vai para o banco.
    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = config.UPLOADS_DIR / uuid.uuid4().hex
    try:
        temp_path.write_bytes(file.file.read())
        parsed, raw_text, warnings = parse_profile_from_pdf(temp_path, storage.get_profile())
    finally:
        temp_path.unlink(missing_ok=True)

    profile = storage.save_profile(parsed)
    return {"profile": profile.to_json(), "warnings": warnings, "rawTextPreview": raw_text[:1800]}
