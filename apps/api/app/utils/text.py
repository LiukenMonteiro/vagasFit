"""Helpers de texto compartilhados (porta de utils/text.ts)."""
import re
import unicodedata


def normalize_text(value: str) -> str:
    """Minúsculas, sem acentos e só com [a-z0-9+#./-] e espaços simples."""
    decomposed = unicodedata.normalize("NFD", value)
    without_accents = re.sub(r"[̀-ͯ]", "", decomposed).lower()
    cleaned = re.sub(r"[^a-z0-9+#.\s/-]", " ", without_accents)
    return re.sub(r"\s+", " ", cleaned).strip()


def unique(items: list) -> list:
    """Remove duplicados preservando a ordem de entrada."""
    return list(dict.fromkeys(items))


def title_case(value: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() for w in value.split(" ") if w)


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def truncate_at_word(value: str, max_length: int) -> str:
    cleaned = compact(value)
    if len(cleaned) <= max_length:
        return cleaned

    boundary = cleaned.rfind(" ", 0, max_length + 1)
    cut = boundary if boundary > max_length * 0.7 else max_length
    truncated = cleaned[:cut].strip()
    return re.sub(r"[,\-–—;:]+$", "", truncated).strip()


def split_lines(value: str) -> list[str]:
    return [line.strip() for line in re.split(r"\r?\n", value) if line.strip()]


def js_round(value: float) -> int:
    """Math.round do JavaScript (0.5 arredonda para cima); round() do Python
    arredonda para o par mais próximo e daria resultados diferentes."""
    import math

    return math.floor(value + 0.5)
