"""Sobe a API: python run.py (porta e origem do frontend vêm do .env)."""
import uvicorn

from app import config

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=config.API_PORT, reload=True)
