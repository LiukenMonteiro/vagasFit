import puppeteer from "puppeteer";
import { TailoredResume } from "../models";
import { renderResumeHtml } from "./resumeHtml";

export async function renderResumePdf(resume: TailoredResume): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(renderResumeHtml(resume), { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
