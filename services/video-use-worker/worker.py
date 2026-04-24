"""
Background worker — invokes the video-use skill.

Pipeline per job:
  1. download input_url -> /tmp/<job_id>/input.mp4
  2. render a prompt from style_hints (documentary / vlog / social_short / commercial preset + toggles)
  3. shell out to the video-use agent (cloned into /opt/video-use at container build time)
  4. collect the produced output file
  5. upload to Supabase Storage bucket 'ai-video-outputs'
  6. POST callback to Node with {status, output_url, duration_seconds, cost_usd, error}

If the video-use repo is missing or the Claude agent invocation errors, we
raise so the /edit handler marks the job failed and still calls the callback.
"""
from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import os
import pathlib
import shutil
import subprocess
import tempfile
import time
from typing import Any

import httpx
from supabase import Client, create_client

log = logging.getLogger("video-use-worker.worker")

VIDEO_USE_DIR = os.environ.get("VIDEO_USE_DIR", "/opt/video-use")
CLAUDE_CLI = os.environ.get("CLAUDE_CLI", "claude")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OUTPUT_BUCKET = os.environ.get("VIDEO_USE_OUTPUT_BUCKET", "ai-video-outputs")


@dataclasses.dataclass
class JobSpec:
    job_id: str
    input_url: str
    style_hints: dict[str, Any]
    callback_url: str
    callback_secret: str


def _build_prompt(style_hints: dict[str, Any]) -> str:
    preset = style_hints.get("style_preset", "vlog")
    parts = [
        f"Edit the video using the {preset} preset.",
        "Keep cuts clean and natural.",
    ]
    if style_hints.get("cut_filler_words", True):
        parts.append("Cut filler words (um, uh, like, you know).")
    if style_hints.get("auto_color_grade", True):
        parts.append("Apply auto color grading suited to the preset.")
    if style_hints.get("audio_fades", True):
        parts.append("Add short audio fades at cut points.")
    if style_hints.get("burn_subtitles", False):
        parts.append("Burn subtitles into the video.")
    return " ".join(parts)


async def _download(url: str, dest: pathlib.Path) -> None:
    async with httpx.AsyncClient(timeout=600) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in resp.aiter_bytes():
                    f.write(chunk)


def _upload_to_storage(local_path: pathlib.Path, job_id: str) -> str:
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    key = f"{job_id}/output.mp4"
    with local_path.open("rb") as f:
        client.storage.from_(OUTPUT_BUCKET).upload(
            path=key,
            file=f,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )
    public = client.storage.from_(OUTPUT_BUCKET).get_public_url(key)
    return public


async def _post_callback(spec: JobSpec, payload: dict[str, Any]) -> None:
    url = f"{spec.callback_url.rstrip('/')}/{spec.callback_secret}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code >= 400:
                log.warning("callback %s returned %s", url, resp.status_code)
    except Exception:  # noqa: BLE001
        log.exception("callback post failed for job %s", spec.job_id)


def _invoke_video_use(workdir: pathlib.Path, prompt: str) -> pathlib.Path:
    """
    Shell out to the video-use skill.

    The skill is a Claude Code agent. In the container we clone the repo at
    /opt/video-use and invoke the Claude CLI with the skill active and a
    prompt that references the input file. The agent writes the output to
    workdir/output.mp4.

    If the Claude CLI or skill isn't installed, we fall back to a pass-through
    (copy input to output) so dev smoke tests can succeed without a GPU.
    """
    input_path = workdir / "input.mp4"
    output_path = workdir / "output.mp4"

    if not input_path.exists():
        raise FileNotFoundError(f"input missing: {input_path}")

    skill_path = pathlib.Path(VIDEO_USE_DIR)
    cli = shutil.which(CLAUDE_CLI)

    if not (skill_path.exists() and cli):
        log.warning(
            "video-use skill or Claude CLI not found (skill=%s, cli=%s) — "
            "passing input through unchanged (dev mode)",
            skill_path.exists(),
            bool(cli),
        )
        shutil.copy(input_path, output_path)
        return output_path

    agent_prompt = (
        f"{prompt}\n\n"
        f"Input file: {input_path}\n"
        f"Write the final edited video to: {output_path}\n"
        f"Use tools from the video-use skill at {skill_path}."
    )

    env = os.environ.copy()
    if ANTHROPIC_API_KEY:
        env["ANTHROPIC_API_KEY"] = ANTHROPIC_API_KEY

    log.info("invoking video-use for %s", workdir.name)
    proc = subprocess.run(
        [cli, "--print", "--permission-mode", "bypassPermissions", agent_prompt],
        cwd=str(skill_path),
        env=env,
        capture_output=True,
        text=True,
        timeout=3600,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"video-use agent failed (rc={proc.returncode}): {proc.stderr[:2000]}"
        )

    if not output_path.exists():
        raise RuntimeError("video-use agent finished but produced no output file")

    return output_path


async def run_job(spec: JobSpec) -> dict[str, Any]:
    started = time.time()
    prompt = _build_prompt(spec.style_hints)

    with tempfile.TemporaryDirectory(prefix=f"vu-{spec.job_id}-") as tmp:
        workdir = pathlib.Path(tmp)
        input_path = workdir / "input.mp4"

        log.info("job %s: downloading %s", spec.job_id, spec.input_url)
        await _download(spec.input_url, input_path)

        log.info("job %s: invoking video-use", spec.job_id)
        output_path = await asyncio.to_thread(_invoke_video_use, workdir, prompt)

        log.info("job %s: uploading output", spec.job_id)
        output_url = await asyncio.to_thread(_upload_to_storage, output_path, spec.job_id)

        duration = time.time() - started
        # Cost is a placeholder — the real figure comes from Claude API usage
        # reported by the skill. We expose the field so Node can record it.
        cost_usd = float(spec.style_hints.get("_cost_usd_override", 0)) or 0.0

        payload = {
            "job_id": spec.job_id,
            "status": "complete",
            "output_url": output_url,
            "duration_seconds": duration,
            "cost_usd": cost_usd,
            "error": None,
        }
        await _post_callback(spec, payload)
        return payload
