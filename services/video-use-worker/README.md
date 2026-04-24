# video-use-worker

FastAPI microservice that wraps the [browser-use/video-use](https://github.com/browser-use/video-use)
Claude Code skill so the ShortStack OS Node app can request AI-assisted video edits over HTTP.

## License warning

**video-use has no license file specified on its repo as of the initial integration.**
Verify the license before using this worker in production. Treat the skill as "all rights
reserved" until confirmed otherwise — open a GitHub issue on `browser-use/video-use` to
request clarification, or fork with permission.

## Architecture

```
ShortStack Node  --POST /edit-->  video-use-worker  --invokes-->  Claude CLI + video-use skill
                                         |                                |
                                         +-- download input               +-- ffmpeg / moviepy
                                         +-- upload output to Supabase
                                         +-- POST callback
```

Jobs are tracked in an in-memory dict scoped to the worker process. The Node side
keeps the authoritative record in `public.ai_video_jobs`, so a pod restart only
loses in-flight jobs (they can be re-submitted).

## Endpoints

| Method | Path                | Purpose                                     |
| ------ | ------------------- | ------------------------------------------- |
| GET    | `/health`           | Liveness probe                              |
| POST   | `/edit`             | Queue a job; returns 202 + job_id           |
| GET    | `/status/{job_id}`  | Poll status (also useful during dev)        |

All requests except `/health` require `Authorization: Bearer $RUNPOD_VIDEO_USE_SECRET`.

### POST /edit body

```json
{
  "job_id": "uuid-from-node",
  "input_url": "https://.../raw.mp4",
  "style_hints": {
    "style_preset": "vlog",
    "cut_filler_words": true,
    "auto_color_grade": true,
    "audio_fades": true,
    "burn_subtitles": false
  },
  "callback_url": "https://shortstack.app/api/video/callback",
  "callback_secret": "…"
}
```

On completion the worker POSTs to `{callback_url}/{callback_secret}` with:

```json
{
  "job_id": "…",
  "status": "complete",
  "output_url": "https://…supabase.co/storage/v1/object/public/ai-video-outputs/…/output.mp4",
  "duration_seconds": 123.4,
  "cost_usd": 0.0,
  "error": null
}
```

## Environment variables

| Name                         | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `RUNPOD_VIDEO_USE_SECRET`    | Shared secret for inbound auth + outbound callback         |
| `ANTHROPIC_API_KEY`          | Passed to Claude CLI invoked by the video-use skill        |
| `SUPABASE_URL`               | Supabase project URL (service role)                        |
| `SUPABASE_SERVICE_ROLE_KEY`  | For uploading outputs                                      |
| `VIDEO_USE_DIR`              | Path to cloned video-use repo (default `/opt/video-use`)   |
| `VIDEO_USE_OUTPUT_BUCKET`    | Storage bucket name (default `ai-video-outputs`)           |
| `PORT`                       | HTTP port (default 8000)                                   |

## Local development

```bash
cd services/video-use-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
RUNPOD_VIDEO_USE_SECRET=dev \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
uvicorn main:app --reload
```

If the Claude CLI and the video-use skill aren't installed locally, the worker
falls back to pass-through mode (copies input → output unchanged). This lets
smoke tests of the HTTP contract run without GPU infrastructure.

## Build and deploy to RunPod

```bash
# 1. Build image locally (or via a RunPod serverless build)
docker build -t video-use-worker:latest .

# 2. Push to your registry
docker tag video-use-worker:latest <registry>/video-use-worker:latest
docker push <registry>/video-use-worker:latest

# 3. On RunPod:
#    - Create a new Pod (CPU is fine for ffmpeg; GPU only needed if your
#      video-use workflows run LLMs locally)
#    - Set the container image to <registry>/video-use-worker:latest
#    - Expose port 8000
#    - Configure env vars (RUNPOD_VIDEO_USE_SECRET, ANTHROPIC_API_KEY,
#      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
#    - Copy the proxy URL (e.g. https://<pod-id>-8000.proxy.runpod.net)
#      into the Node side .env as RUNPOD_VIDEO_USE_URL

# 4. Health check
curl https://<pod-id>-8000.proxy.runpod.net/health
```

## Storage bucket

Create `ai-video-outputs` in Supabase Storage (public read, service-role write)
before the first job runs.
