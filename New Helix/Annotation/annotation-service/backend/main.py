"""
HelixMind — ResFinder Worker Entrypoint

This is the FastAPI app that runs inside the resfinder-worker container.
It exposes the annotation endpoints on port 8001.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.annotation import router as annotation_router

app = FastAPI(
    title="HelixMind ResFinder Worker",
    description="Self-hosted resistance gene annotation service",
    version="1.0.0",
)

# Allow the main API (and local dev) to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # internal service — tighten this once behind the main API proxy
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(annotation_router)


@app.get("/")
async def root():
    return {"service": "helixmind-resfinder-worker", "status": "running"}