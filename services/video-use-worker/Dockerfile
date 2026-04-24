# video-use-worker — FastAPI wrapper around the browser-use/video-use skill.
#
# Runs on a RunPod pod (or any host with Node + Python + ffmpeg).
# The Claude CLI is installed so the video-use skill can drive ffmpeg/moviepy
# through a Claude agent.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# System dependencies: ffmpeg for video, git to clone the skill, curl for
# healthchecks, node for the Claude CLI.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      git \
      curl \
      ca-certificates \
      gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Claude Code CLI — drives the video-use skill.
RUN npm install -g @anthropic-ai/claude-code

# Clone the video-use skill into /opt/video-use at build time so job startup
# is fast. Pinned to main — re-build the image to update.
ARG VIDEO_USE_REF=main
RUN git clone --depth 1 --branch ${VIDEO_USE_REF} \
      https://github.com/browser-use/video-use.git /opt/video-use || \
    echo "WARNING: failed to clone video-use; service will run in passthrough mode"

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY main.py worker.py ./

ENV PORT=8000 \
    VIDEO_USE_DIR=/opt/video-use

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
