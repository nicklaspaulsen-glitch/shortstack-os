"""
video-use-worker FastAPI service.

Wraps the browser-use/video-use Claude Code skill (https://github.com/browser-use/video-use)
in an HTTP job-queue interface that the ShortStack OS Node app can call.

Endpoints:
- POST /edit   -> queue a job, returns 202 + job_id
- GET  /status/{job_id} -> poll status
- GET  /health -> liveness probe

Jobs are kept in an in-memory dict (process-local). If the pod restarts,
queued-but-unfinished jobs are lost — the Node side tolerates this because
the ai_video_jobs row is the source of truth, and callers can re-submit.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from typing import Any

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from worker import JobSpec, run_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("video-use-worker")

app = FastAPI(title="video-use-worker", version="0.1.0")

# In-memory job registry. {job_id: {"status": ..., "error": ..., "output_url": ...}}
JOBS: dict[str, dict[str, Any]] = {}

SHARED_SECRET = os.environ.get("RUNPOD_VIDEO_USE_SECRET", "")


class EditRequest(BaseModel):
    input_url: str = Field(..., description="Publicly fetchable URL of source video")
    style_hints: dict[str, Any] = Field(default_factory=dict)
    job_id: str = Field(..., description="Opaque job id from Node — we echo it back")
    callback_url: str = Field(..., description="Node endpoint to POST result to")
    callback_secret: str = Field(..., description="Secret to include in callback auth")


class EditResponse(BaseModel):
    job_id: str
    status: str


def _check_auth(auth_header: str | None) -> None:
    if not SHARED_SECRET:
        # Fail closed if not configured — prevents accidentally open pod.
        raise HTTPException(status_code=503, detail="service not configured")
    if auth_header != f"Bearer {SHARED_SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/edit", response_model=EditResponse, status_code=202)
async def edit(
    req: EditRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> EditResponse:
    _check_auth(authorization)

    if req.job_id in JOBS and JOBS[req.job_id].get("status") in ("processing", "queued"):
        raise HTTPException(status_code=409, detail="job already running")

    JOBS[req.job_id] = {"status": "queued", "error": None, "output_url": None}

    spec = JobSpec(
        job_id=req.job_id,
        input_url=req.input_url,
        style_hints=req.style_hints,
        callback_url=req.callback_url,
        callback_secret=req.callback_secret,
    )

    async def _run():
        try:
            JOBS[req.job_id]["status"] = "processing"
            result = await run_job(spec)
            JOBS[req.job_id].update(
                status="complete",
                output_url=result.get("output_url"),
                duration_seconds=result.get("duration_seconds"),
                cost_usd=result.get("cost_usd"),
            )
        except Exception as e:  # noqa: BLE001
            log.exception("job %s failed", req.job_id)
            JOBS[req.job_id]["status"] = "failed"
            JOBS[req.job_id]["error"] = str(e)

    background_tasks.add_task(_run)

    return EditResponse(job_id=req.job_id, status="queued")


@app.get("/status/{job_id}")
async def status(job_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _check_auth(authorization)
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return {"job_id": job_id, **job}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
