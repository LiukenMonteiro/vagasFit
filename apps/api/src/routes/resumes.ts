import express from "express";
import { generateTailoredResume } from "../services/resumeTailor";
import { clearTailoredResumes, deleteTailoredResume, getProfile, getTailoredResume, listTailoredResumes, saveTailoredResume } from "../storage";
import { renderResumePdf } from "../services/pdfService";

export const resumesRouter = express.Router();

resumesRouter.get("/", async (_req, res, next) => {
  try {
    const resumes = await listTailoredResumes();
    res.json(resumes);
  } catch (error) {
    next(error);
  }
});

resumesRouter.delete("/", async (_req, res, next) => {
  try {
    const deleted = await clearTailoredResumes();
    res.json({ ok: true, deleted });
  } catch (error) {
    next(error);
  }
});

resumesRouter.post("/generate", async (req, res, next) => {
  try {
    const description = String(req.body.description || "");
    if (description.trim().length < 20) {
      res.status(400).json({ message: "Cole uma descrição de vaga com pelo menos 20 caracteres." });
      return;
    }

    const profile = await getProfile();
    const resume = generateTailoredResume(profile, description);
    await saveTailoredResume(resume);
    res.status(201).json(resume);
  } catch (error) {
    next(error);
  }
});

resumesRouter.get("/:id", async (req, res, next) => {
  try {
    const resume = await getTailoredResume(req.params.id);
    if (!resume) {
      res.status(404).json({ message: "Currículo não encontrado." });
      return;
    }

    res.json(resume);
  } catch (error) {
    next(error);
  }
});

resumesRouter.get("/:id/pdf", async (req, res, next) => {
  try {
    const resume = await getTailoredResume(req.params.id);
    if (!resume) {
      res.status(404).json({ message: "Currículo não encontrado." });
      return;
    }

    const pdf = await renderResumePdf(resume);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${resume.fileName}"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

resumesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteTailoredResume(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Currículo não encontrado." });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
