import path from "node:path";
import express from "express";
import multer from "multer";
import { getProfile, saveProfile } from "../storage";
import { parseProfileFromPdf } from "../services/profileParser";

const uploadDir = path.resolve(__dirname, "../../data/uploads");
const upload = multer({ dest: uploadDir });

export const profileRouter = express.Router();

profileRouter.get("/", async (_req, res, next) => {
  try {
    const profile = await getProfile();
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

profileRouter.put("/", async (req, res, next) => {
  try {
    const profile = await saveProfile(req.body);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

profileRouter.post("/from-pdf", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "Envie um arquivo PDF no campo 'file'." });
      return;
    }

    const existingProfile = await getProfile();
    const parsed = await parseProfileFromPdf(req.file.path, existingProfile);
    const profile = await saveProfile(parsed.profile);
    res.json({ profile, warnings: parsed.warnings, rawTextPreview: parsed.rawText.slice(0, 1800) });
  } catch (error) {
    next(error);
  }
});
