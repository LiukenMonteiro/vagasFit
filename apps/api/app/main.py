import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .routes import jobs, profile, reports, resumes

logger = logging.getLogger("vagafit")

app = FastAPI(title="VagaFit API")

app.add_middleware(CORSMiddleware, allow_origins=[config.WEB_ORIGIN], allow_methods=["*"], allow_headers=["*"])

app.include_router(profile.router)
app.include_router(jobs.router)
app.include_router(resumes.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"ok": True, "name": "VagaFit API"}


# O frontend lê o texto do erro em "message" (não no "detail" padrão do FastAPI).

@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"message": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return JSONResponse({"message": "Dados inválidos na requisição."}, status_code=400)


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception):
    logger.exception("Erro não tratado")
    return JSONResponse({"message": str(exc) or "Erro interno"}, status_code=500)
