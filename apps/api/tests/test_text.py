from app.utils.slug import slugify
from app.utils.text import js_round, normalize_text, truncate_at_word, unique


def test_normalize_text_removes_accents_and_symbols():
    assert normalize_text("  Manutenção de Computadores! ") == "manutencao de computadores"
    assert normalize_text("C# / Node.js") == "c# / node.js"


def test_truncate_at_word_cuts_on_word_boundary():
    assert truncate_at_word("um dois três quatro cinco", 14) == "um dois três"
    assert truncate_at_word("curto", 50) == "curto"


def test_unique_keeps_order():
    assert unique(["b", "a", "b", "c", "a"]) == ["b", "a", "c"]


def test_slugify():
    assert slugify("Desenvolvedor Full Stack — Acme") == "desenvolvedor-full-stack-acme"
    assert slugify("???") == "curriculo"


def test_js_round_rounds_half_up():
    assert js_round(0.5) == 1
    assert js_round(2.5) == 3  # round() do Python daria 2
