"""Renderiza o HTML do currículo em PDF A4 usando Chromium (Playwright)."""
from playwright.sync_api import sync_playwright

from ..models import TailoredResume
from .resume_html import render_resume_html


def render_resume_pdf(resume: TailoredResume) -> bytes:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        try:
            page = browser.new_page()
            page.set_content(render_resume_html(resume), wait_until="domcontentloaded")
            return page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "14mm", "right": "12mm", "bottom": "14mm", "left": "12mm"},
            )
        finally:
            browser.close()
