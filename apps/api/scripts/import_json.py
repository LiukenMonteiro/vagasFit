"""Importa os dados antigos (arquivos JSON da versão em Node) para o Firebird.

Uso (dentro de apps/api):
    python -m scripts.import_json
Lê data/profile.json e data/resumes/*.json, se existirem.
"""
import json

from app import config, storage
from app.models import ResumeProfile, TailoredResume

DATA = config.API_ROOT / "data"


def main() -> None:
    profile_file = DATA / "profile.json"
    if profile_file.exists():
        profile = ResumeProfile.model_validate(json.loads(profile_file.read_text(encoding="utf-8")))
        storage.save_profile(profile)
        print(f"Perfil importado: {profile.full_name}")
    else:
        print("Nenhum data/profile.json encontrado; perfil mantido.")

    imported = 0
    for path in sorted((DATA / "resumes").glob("*.json")):
        resume = TailoredResume.model_validate(json.loads(path.read_text(encoding="utf-8")))
        if storage.get_tailored_resume(resume.id) is None:
            storage.save_tailored_resume(resume)
            imported += 1
    print(f"Currículos importados: {imported}")


if __name__ == "__main__":
    main()
