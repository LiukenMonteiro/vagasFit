import express from "express";
import { analyzeJobDescription } from "../services/jobAnalyzer";
import { getProfile } from "../storage";

export const jobsRouter = express.Router();

jobsRouter.post("/analyze", async (req, res, next) => {
  try {
    const description = String(req.body.description || "");
    if (description.trim().length < 20) {
      res.status(400).json({ message: "Cole uma descrição de vaga com pelo menos 20 caracteres." });
      return;
    }

    const profile = await getProfile();
    const analysis = analyzeJobDescription(description, profile);
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});
