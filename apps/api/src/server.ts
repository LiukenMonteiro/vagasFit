import "dotenv/config";
import express from "express";
import cors from "cors";
import { profileRouter } from "./routes/profile";
import { jobsRouter } from "./routes/jobs";
import { resumesRouter } from "./routes/resumes";

const app = express();
const port = Number(process.env.API_PORT || 3333);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: webOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "VagaFit API" });
});

app.use("/api/profile", profileRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/resumes", resumesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Erro interno";
  res.status(500).json({ message });
});

app.listen(port, () => {
  console.log(`VagaFit API rodando em http://localhost:${port}`);
});
