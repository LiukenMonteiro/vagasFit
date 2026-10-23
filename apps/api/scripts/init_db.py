"""Cria as tabelas do VagasFit no Firebird a partir de scripts/schema.sql.

Uso (dentro de apps/api):
    python -m scripts.init_db          # cria, se ainda não existir
    python -m scripts.init_db --reset  # apaga tudo e recria (perde dados!)
"""
import argparse
import re
from pathlib import Path

from app.db import open_connection

SCHEMA = Path(__file__).with_name("schema.sql")

# Ordem de remoção respeita as chaves estrangeiras (filhas primeiro).
DROP_ORDER = [
    ("VIEW", "V_RESUME_REPORT"),
    ("TABLE", "TAILORED_RESUMES"),
    ("TABLE", "LANGUAGES"),
    ("TABLE", "SKILL_GROUP_ITEMS"),
    ("TABLE", "SKILL_GROUPS"),
    ("TABLE", "PROJECT_SKILLS"),
    ("TABLE", "PROJECTS"),
    ("TABLE", "EXPERIENCE_SKILLS"),
    ("TABLE", "EXPERIENCES"),
    ("TABLE", "EDUCATION"),
    ("TABLE", "PROFILES"),
]


def split_statements(sql: str) -> list[str]:
    """Separa o script em comandos. Basta cortar em ';' porque o esquema não
    tem triggers nem procedures (que exigiriam SET TERM)."""
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)
    return [s.strip() for s in sql.split(";") if s.strip()]


def relation_exists(cur, name: str) -> bool:
    cur.execute("SELECT 1 FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?", (name,))
    return cur.fetchone() is not None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="apaga e recria todas as tabelas")
    args = parser.parse_args()

    con = open_connection()
    try:
        cur = con.cursor()

        if args.reset:
            for kind, name in DROP_ORDER:
                if relation_exists(cur, name):
                    cur.execute(f"DROP {kind} {name}")
                    print(f"removido: {name}")
            con.commit()
        elif relation_exists(cur, "PROFILES"):
            print("Banco já inicializado. Use --reset para recriar.")
            return

        statements = split_statements(SCHEMA.read_text(encoding="utf-8"))
        for statement in statements:
            cur.execute(statement)
        con.commit()
        print(f"Esquema criado ({len(statements)} comandos).")
    finally:
        con.close()


if __name__ == "__main__":
    main()
