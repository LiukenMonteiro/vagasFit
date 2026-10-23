"""Configuração lida do ambiente (.env na raiz do monorepo ou do próprio apps/api)."""
import os
from pathlib import Path

from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent

load_dotenv(REPO_ROOT / ".env")
load_dotenv(API_ROOT / ".env")

API_PORT = int(os.getenv("API_PORT", "3333"))
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:5173")

FIREBIRD_HOST = os.getenv("FIREBIRD_HOST", "localhost")
FIREBIRD_PORT = int(os.getenv("FIREBIRD_PORT", "3050"))
# Caminho do arquivo .fdb *no servidor* Firebird.
FIREBIRD_DATABASE = os.getenv("FIREBIRD_DATABASE", "/var/lib/firebird/data/vagafit.fdb")
FIREBIRD_USER = os.getenv("FIREBIRD_USER", "vagafit")
FIREBIRD_PASSWORD = os.getenv("FIREBIRD_PASSWORD", "vagafit")
# Opcional: caminho da libfbclient quando ela não está no sistema.
FIREBIRD_CLIENT_LIB = os.getenv("FIREBIRD_CLIENT_LIB") or None

UPLOADS_DIR = API_ROOT / "data" / "uploads"
