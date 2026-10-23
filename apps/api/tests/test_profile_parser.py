from app.services.profile_parser import (
    extract_contact,
    extract_languages,
    extract_skills,
    normalize_month_year,
    parse_date_range,
    section_lines,
)


def test_parse_date_range_variants():
    assert parse_date_range("Jan 2023 — Dez 2024") == {"start": "Jan 2023", "end": "Dez 2024"}
    assert parse_date_range("Janeiro 2023 - Atual") == {"start": "Jan 2023", "end": "Atual"}
    assert parse_date_range("2021 – Presente") == {"start": "2021", "end": "Atual"}
    assert parse_date_range("sem datas") == {}


def test_numeric_month_out_of_range_falls_back_to_jan():
    assert normalize_month_year("03/2022") == "Mar 2022"
    assert normalize_month_year("00/2022") == "Jan 2022"


def test_section_lines_stops_at_next_heading():
    lines = ["Nome", "Experiência", "a", "b", "Projetos", "c"]
    assert section_lines(lines, ["Experiência"], ["Projetos"]) == ["a", "b"]


def test_extract_contact_strips_pdf_label():
    contact = extract_contact("EmailFulana@Exemplo.com\nLinkedInfulana-dev\nPhone48 99999-1234")
    assert contact.email == "Fulana@Exemplo.com"
    assert contact.linkedin == "fulana-dev"
    assert contact.phone == "48 99999-1234"


def test_extract_skills_finds_known_terms():
    assert {"React", "Docker"} <= set(extract_skills("Trabalho com React e Docker no dia a dia"))


def test_extract_languages_reads_level():
    assert extract_languages("Inglês — intermediário")[0].level == "Intermediário"
